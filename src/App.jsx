import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Edit2, X, Check, Download, LogOut, Upload, FileText, HelpCircle, Settings } from 'lucide-react';
import { supabase } from './supabaseClient';
import ResumeBuilder from './components/ResumeBuilder.jsx';
import ResumeAssembly from './components/ResumeAssembly.jsx';
import ResumeManager from './components/ResumeManager.jsx';
import OnboardingTutorial from './components/OnboardingTutorial.jsx';
import ApiKeySettings from './components/ApiKeySettings.jsx';

import MilestoneToast from './MilestoneToast.jsx';
import CelebrationAnimation from './components/CelebrationAnimation.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import * as gamification from './gamification.js';
import './App.css';
import './animations.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [theme, setTheme] = useState('dark'); // 'dark' or 'garden'
  
  const [applications, setApplications] = useState([]);
  const [resumeVersions, setResumeVersions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [formData, setFormData] = useState({
    company: '',
    position: '',
    date_applied: '',
    contact_person: '',
    status: 'applied',
    notes: '',
    resume_version_id: null
  });

  const [gamificationState, setGamificationState] = useState(null);

  const [activeMilestone, setActiveMilestone] = useState(null);
  const [milestoneQueue, setMilestoneQueue] = useState([]);
  const [activeCelebration, setActiveCelebration] = useState(null);
  const [statusCelebration, setStatusCelebration] = useState(null); // For status-specific celebrations
  const [currentView, setCurrentView] = useState('applications'); // 'applications', 'leaderboard', 'assembly', or 'resumes'
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [sortColumn, setSortColumn] = useState('date_applied'); // 'company', 'position', 'date_applied'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'

  const applyGamification = async (action, actionData = {}) => {
    if (!gamificationState) return;

    const oldState = gamificationState;
    const newState = gamification.computeNewState(oldState, action, actionData);

    const milestones = gamification.detectMilestones(
      oldState,
      newState,
      applications
    );

    setGamificationState(newState);

    await supabase
      .from('gamification_state')
      .update(newState)
      .eq('user_id', user.id);

    if (milestones.length > 0) {
      // Filter milestones for celebration (rank-up, achievement, and standard tiers)
      const celebrationMilestones = milestones.filter(
        m => m.tier === 'rank-up' || m.tier === 'achievement' || m.tier === 'standard'
      );

      // Trigger celebration for the first qualifying milestone
      if (celebrationMilestones.length > 0 && !activeCelebration) {
        setActiveCelebration(celebrationMilestones[0]);
      }

      // Queue all milestones for toast notifications
      if (!activeMilestone) {
        setActiveMilestone(milestones[0]);
        setMilestoneQueue(milestones.slice(1));
      } else {
        setMilestoneQueue(prev => [...prev, ...milestones]);
      }
    }
  };

  // Check if user is logged in on mount
  useEffect(() => {
    checkUser();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load applications when user logs in
  useEffect(() => {
    if (user) {
      loadApplications();
      loadGamificationState();
      loadResumeVersions();
    }
  }, [user]);

  const loadResumeVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('resume_versions')
        .select('id, name')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Load resume versions error:', error);
        return;
      }

      setResumeVersions(data || []);
    } catch (e) {
      console.error('Failed to load resume versions:', e);
    }
  };

  // Milestone queue handler
  useEffect(() => {
    if (milestoneQueue.length > 0 && !activeMilestone) {
      setActiveMilestone(milestoneQueue[0]);
      setMilestoneQueue(prev => prev.slice(1));
    }
  }, [milestoneQueue, activeMilestone]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRetroactivePoints = (applications) => {
    let points = 0;
    
    // 10 points per application
    points += applications.length * 10;
    
    // 25 points per interview (status = interview, offered, or accepted)
    const interviews = applications.filter(a => 
      a.status === 'interview' || a.status === 'offered' || a.status === 'accepted'
    ).length;
    points += interviews * 25;
    
    // 50 points per offer (status = offered or accepted)
    const offers = applications.filter(a => 
      a.status === 'offered' || a.status === 'accepted'
    ).length;
    points += offers * 50;
    
    return points;
  };

  const loadGamificationState = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1️⃣ Load applications first
    const { data: apps, error: appsError } = await supabase
      .from('applications')
      .select('*');

    if (appsError) {
      console.error('Failed to load applications for gamification:', appsError);
      return;
    }

    const applications = apps || [];

    // 2️⃣ Compute retroactive points + rank
    const retroPoints = calculateRetroactivePoints(applications);
    const retroRank = gamification.calculateRank(retroPoints);

    // 3️⃣ Load existing gamification row
    const { data, error } = await supabase
      .from('gamification_state')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // 4️⃣ If no row exists → create one with correct values
    if (error && error.code === 'PGRST116') {
      const initialState = {
        ...gamification.getInitialState(),
        user_id: user.id,
        points: retroPoints,
        rank: retroRank,
        last_login_date: new Date().toISOString().split('T')[0]
      };

      const { data: inserted, error: insertError } = await supabase
        .from('gamification_state')
        .insert([initialState])
        .select()
        .single();

      if (insertError) {
        console.error('Failed to insert gamification state:', insertError);
        return;
      }

      setGamificationState(inserted);
      
      // Show onboarding for first-time users
      setShowOnboarding(true);
      
      // Trigger welcome celebration for first login
      const welcomeMilestones = gamification.detectMilestones(
        gamification.getInitialState(),
        inserted,
        applications,
        { isDailyLogin: true }
      );
      
      if (welcomeMilestones.length > 0) {
        const celebrationMilestones = welcomeMilestones.filter(
          m => m.tier === 'rank-up' || m.tier === 'achievement' || m.tier === 'standard'
        );
        
        if (celebrationMilestones.length > 0 && !activeCelebration) {
          setActiveCelebration(celebrationMilestones[0]);
        }
        
        if (!activeMilestone) {
          setActiveMilestone(welcomeMilestones[0]);
          setMilestoneQueue(welcomeMilestones.slice(1));
        } else {
          setMilestoneQueue(prev => [...prev, ...welcomeMilestones]);
        }
      }
      
      return;
    }

    // 5️⃣ Check if this is a daily login
    const isDailyLogin = gamification.checkDailyLogin(data.last_login_date);
    
    // 6️⃣ Normalize existing row if needed
    const needsUpdate =
      data.points !== retroPoints ||
      data.rank !== retroRank;

    if (needsUpdate || isDailyLogin) {
      const updated = {
        ...data,
        points: retroPoints,
        rank: retroRank,
        last_login_date: isDailyLogin ? new Date().toISOString().split('T')[0] : data.last_login_date
      };

      const updateFields = {
        points: retroPoints,
        rank: retroRank
      };
      
      if (isDailyLogin) {
        updateFields.last_login_date = new Date().toISOString().split('T')[0];
      }

      const { error: updateError } = await supabase
        .from('gamification_state')
        .update(updateFields)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Failed to update gamification state:', updateError);
        return;
      }

      setGamificationState(updated);
      
      // Trigger welcome celebration if daily login
      if (isDailyLogin) {
        const welcomeMilestones = gamification.detectMilestones(
          data,
          updated,
          applications,
          { isDailyLogin: true }
        );
        
        if (welcomeMilestones.length > 0) {
          const celebrationMilestones = welcomeMilestones.filter(
            m => m.tier === 'rank-up' || m.tier === 'achievement' || m.tier === 'standard'
          );
          
          if (celebrationMilestones.length > 0 && !activeCelebration) {
            setActiveCelebration(celebrationMilestones[0]);
          }
          
          if (!activeMilestone) {
            setActiveMilestone(welcomeMilestones[0]);
            setMilestoneQueue(welcomeMilestones.slice(1));
          } else {
            setMilestoneQueue(prev => [...prev, ...welcomeMilestones]);
          }
        }
      }
    } else {
      setGamificationState(data);
    }

  } catch (error) {
    console.error('[GAMIFICATION] load error:', error);
  }
};



  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      setUser(data.user);
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      
      if (data.user) {
        alert('Account created! Please check your email to verify your account.');
      }
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setApplications([]);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };
   const handlePasswordReset = async (e) => {
  e.preventDefault();
  setAuthError('');
  
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: 'https://job-tracker-3wd.pages.dev',
    });

    if (error) throw error;
    
    setResetSuccess(true);
    setTimeout(() => {
      setResetMode(false);
      setResetSuccess(false);
      setResetEmail('');
    }, 3000);
  } catch (error) {
    setAuthError(error.message);
  }
};
 
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'garden' : 'dark');
  };

  const loadApplications = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .order('date_applied', { ascending: false });

      if (error) {
        console.error('Load error:', error);
        return;
      }

      setApplications(data || []);
        
    } catch (e) {
      console.error('Failed to load:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNew = () => {
    setFormData({
      company: '',
      position: '',
      date_applied: new Date().toISOString().split('T')[0],
      contact_person: '',
      status: 'applied',
      notes: '',
      resume_version_id: null
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleEdit = (app) => {
    setFormData({
      company: app.company,
      position: app.position,
      date_applied: app.date_applied,
      contact_person: app.contact_person,
      status: app.status,
      notes: app.notes,
      resume_version_id: app.resume_version_id
    });
    setEditingId(app.id);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.company.trim() || !formData.position.trim()) {
      alert('Company and position are required');
      return;
    }

    // Capture oldStatus BEFORE any database operation
    const oldStatus = editingId 
      ? applications.find(a => a.id === editingId)?.status 
      : null;

    setIsSyncing(true);
    try {
      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('applications')
          .update(formData)
          .eq('id', editingId);

        if (error) {
          console.error('Update error:', error);
          alert('Failed to update application');
          return;
        }
      } else {
        // Insert new - with user_id and linked resume
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('applications')
          .insert([{
            ...formData,
            user_id: user.id
          }]);

        if (error) {
          console.error('Insert error:', error);
          alert('Failed to save application');
          return;
        }
      }
setIsModalOpen(false);
      await loadApplications();
      
      // Status-specific celebrations (immediate feedback)
      if (editingId && oldStatus !== formData.status) {
        if (formData.status === 'rejected') {
          // Butterfly celebration for rejection
          setStatusCelebration({ emoji: '🦋', type: 'rejected' });
        } else if (formData.status === 'interview') {
          // Dragon celebration for interview
          setStatusCelebration({ emoji: '🐲', type: 'interview' });
        }
      }
      
      // Gamification update - SINGLE CALL ONLY
      if (gamificationState) {
        const action = editingId ? 'update_status' : 'create_application';
        const actionData = editingId 
          ? { oldStatus, newStatus: formData.status }
          : {};
        
        await applyGamification(action, actionData);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this application?')) return;

    setIsSyncing(true);
    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete error:', error);
        alert('Failed to delete application');
        return;
      }

      await loadApplications();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const exportToCSV = () => {
    const headers = ['Company', 'Position', 'Date Applied', 'Contact Person', 'Status', 'Notes'];
    const rows = applications.map(app => [
      app.company,
      app.position,
      app.date_applied,
      app.contact_person,
      app.status,
      app.notes
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell || ''}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-applications-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Job Applications</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; padding: 0; }
            h1 { text-align: center; margin-bottom: 10px; }
            .date { text-align: center; color: #666; margin-bottom: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background-color: #f0f0f0; border: 1px solid #ddd; padding: 10px; text-align: left; font-weight: bold; }
            td { border: 1px solid #ddd; padding: 10px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .footer { text-align: right; font-size: 11px; color: #666; margin-top: 20px; }
            @media print { body { margin: 0; padding: 10px; } }
          </style>
        </head>
        <body>
          <h1>Job Application Tracker</h1>
          <div class="date">Generated on ${new Date().toLocaleDateString('de-DE')}</div>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Position</th>
                <th>Date Applied</th>
                <th>Contact Person</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${applications.map(app => `
                <tr>
                  <td>${app.company}</td>
                  <td>${app.position}</td>
                  <td>${new Date(app.date_applied).toLocaleDateString('de-DE')}</td>
                  <td>${app.contact_person || 'â€”'}</td>
                  <td>${app.status}</td>
                  <td>${app.notes}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">Total Applications: ${applications.length}</div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let current = '';
      let inQuotes = false;

      for (let char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));

      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header.toLowerCase().replace(/ /g, '_')] = values[index];
        });
        rows.push(row);
      }
    }

    return rows;
  };

  const validateAndFormatCSVData = (rows) => {
    const validStatuses = ['applied', 'interview', 'offered', 'rejected', 'accepted'];
    const formatted = [];

    for (const row of rows) {
      if (!row.company || !row.position) {
        continue;
      }

      const status = row.status?.toLowerCase();
      const formattedRow = {
        company: row.company,
        position: row.position,
        date_applied: row.date_applied || new Date().toISOString().split('T')[0],
        contact_person: row.contact_person || '',
        status: validStatuses.includes(status) ? status : 'applied',
        notes: row.notes || ''
      };

      formatted.push(formattedRow);
    }

    return formatted;
  };

  const findDuplicates = (newData) => {
    const duplicates = [];
    
    for (const newApp of newData) {
      const isDuplicate = applications.some(existingApp => 
        existingApp.company.toLowerCase() === newApp.company.toLowerCase() &&
        existingApp.position.toLowerCase() === newApp.position.toLowerCase()
      );
      
      if (isDuplicate) {
        duplicates.push(newApp);
      }
    }

    return duplicates;
  };

  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    event.target.value = '';

    setIsSyncing(true);
    try {
      const text = await file.text();
      const parsedData = parseCSV(text);
      
      if (parsedData.length === 0) {
        alert('No valid data found in CSV file. Please check the format.');
        return;
      }

      const validatedData = validateAndFormatCSVData(parsedData);
      
      if (validatedData.length === 0) {
        alert('No valid applications found. Make sure each row has Company and Position.');
        return;
      }

      const duplicates = findDuplicates(validatedData);
      
      if (duplicates.length > 0) {
        const duplicateList = duplicates
          .map(d => `${d.company} - ${d.position}`)
          .join('\n');
        
        const confirmed = confirm(
          `Found ${duplicates.length} potential duplicate(s):\n\n${duplicateList}\n\nDo you want to import them anyway?`
        );
        
        if (!confirmed) {
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();

      const dataToInsert = validatedData.map(app => ({
        ...app,
        user_id: user.id
      }));

      const { error } = await supabase
        .from('applications')
        .insert(dataToInsert);

      if (error) {
        console.error('CSV upload error:', error);
        alert('Failed to upload applications. Please try again.');
        return;
      }

      alert(`Successfully imported ${validatedData.length} application(s)!`);
      await loadApplications();
    } catch (error) {
      console.error('CSV processing error:', error);
      alert('Failed to process CSV file. Please check the format.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

// Login/Signup screen
if (!user) {
  return (
    <div className="auth-container bg-gradient" data-theme={theme}>
      <div className="fixed inset-0 opacity-5 pointer-events-none grid-bg"></div>
      
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title" style={{ fontSize: '1.2rem' }}>Forge</h1>
          <p className="auth-subtitle">Track your job applications with style</p>
        </div>

        {!resetMode ? (
          <>
            <div className="auth-tabs">
              <button
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
                className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                }}
                className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="auth-form">
              <div className="auth-form-group">
                <label className="auth-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="auth-input"
                />
              </div>

              <div className="auth-form-group">
                <label className="auth-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="auth-input"
                />
              </div>

              {authError && (
                <div className="auth-error">
                  <span>⚠️</span>
                  <p>{authError}</p>
                </div>
              )}

              <button type="submit" className="auth-submit">
                {authMode === 'login' ? 'Login' : 'Sign Up'}
              </button>

              {authMode === 'login' && (
                <div className="auth-forgot">
                  <button
                    type="button"
                    onClick={() => {
                      setResetMode(true);
                      setAuthError('');
                    }}
                    className="auth-forgot-link"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </form>
          </>
        ) : (
          <>
            <form onSubmit={handlePasswordReset} className="auth-form">
              <div className="auth-form-group">
                <label className="auth-label">Email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="auth-input"
                />
              </div>

              {authError && (
                <div className="auth-error">
                  <span>⚠️</span>
                  <p>{authError}</p>
                </div>
              )}

              {resetSuccess && (
                <div className="auth-success">
                  <span>✓</span>
                  <p>Password reset email sent! Check your inbox.</p>
                </div>
              )}

              <button type="submit" className="auth-submit">
                Send Reset Link
              </button>

              <div className="auth-back">
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(false);
                    setResetEmail('');
                    setAuthError('');
                  }}
                  className="auth-back-link"
                >
                  ← Back to Login
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

  // Main app (when logged in)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">Loading your applications...</p>
        </div>
      </div>
    );
  }

  const filteredApplications = filterStatus === 'all'
    ? applications
    : applications.filter(app => app.status === filterStatus);

  // Sort applications
  const sortedApplications = [...filteredApplications].sort((a, b) => {
    let comparison = 0;
    
    if (sortColumn === 'company') {
      comparison = a.company.localeCompare(b.company);
    } else if (sortColumn === 'position') {
      comparison = a.position.localeCompare(b.position);
    } else if (sortColumn === 'date_applied') {
      comparison = new Date(a.date_applied) - new Date(b.date_applied);
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const statusConfig = {
    applied: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Applied' },
    interview: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'Interview' },
    offered: { bg: 'status-gold', text: 'text-yellow-600', label: 'Offered' },
    rejected: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Rejected' },
    accepted: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Accepted' }
  };

  const stats = {
    total: applications.length,
    applied: applications.filter(a => a.status === 'applied').length,
    interview: applications.filter(a => a.status === 'interview').length,
    offered: applications.filter(a => a.status === 'offered').length
  };

  return (
    <div className="min-h-screen bg-gradient" data-theme={theme}>
      <div className="fixed inset-0 opacity-5 pointer-events-none grid-bg"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="header-row mb-4">
            <div className="header-title-group">
              <div className="header-accent"></div>
              <h1 className="text-3xl font-bold text-slate-50" style={{ fontSize: '1.2rem' }}>Forge</h1>
            </div>
            <div className="header-actions">
              <span className="text-slate-400 text-sm">{user.email}</span>
              <button
                onClick={() => setCurrentView('applications')}
                className={`btn-header-action ${currentView === 'applications' ? 'active' : ''}`}
                title="Track your job applications"
              >
                Applications
              </button>
              <button
                onClick={() => setCurrentView('resumes')}
                className={`btn-header-action ${currentView === 'resumes' ? 'active' : ''}`}
                title="Manage your resume versions"
              >
                Resumes
              </button>
              <button
                onClick={() => setCurrentView('assembly')}
                className={`btn-header-action ${currentView === 'assembly' ? 'active' : ''}`}
                title="AI-powered resume customization"
              >
                Assembly
              </button>
              <button
                onClick={() => setCurrentView('leaderboard')}
                className={`btn-header-action ${currentView === 'leaderboard' ? 'active' : ''}`}
                title="View leaderboard and achievements"
              >
                Leaderboard
              </button>
              <button
                onClick={() => setShowOnboarding(true)}
                className="btn-header-action"
                title="Show tutorial"
              >
                <HelpCircle size={16} />
              </button>
              <button
                onClick={() => setShowApiSettings(true)}
                className="btn-header-action"
                title="Configure API keys (optional)"
              >
                <Settings size={16} />
              </button>
              <button
                onClick={toggleTheme}
                className="theme-toggle px-3 py-2 rounded-lg transition-colors"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <button
                onClick={handleLogout}
                className="btn-header-action"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">Track job applications across your pipeline</p>
            <p className="text-slate-400 text-xs">{isSyncing ? '● Syncing...' : '● Synced to cloud'}</p>
          </div>
        </div>

        {/* Conditional View Rendering */}
        {currentView === 'leaderboard' ? (
          <Leaderboard currentUserId={user.id} />
        ) : currentView === 'assembly' ? (
          <ResumeAssembly user={user} />
        ) : currentView === 'resumes' ? (
          <ResumeManager user={user} />
        ) : (
          <>
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card stat-card-total" title="Total number of job applications tracked">
            <p className="stat-label">Total</p>
            <p className="stat-value">{stats.total}</p>
          </div>
          <div className="stat-card stat-card-applied" title="Applications with 'Applied' status">
            <p className="stat-label">Applied</p>
            <p className="stat-value">{stats.applied}</p>
          </div>
          <div className="stat-card stat-card-interview" title="Applications that reached interview stage">
            <p className="stat-label">Interviews</p>
            <p className="stat-value">{stats.interview}</p>
          </div>
          <div className="stat-card stat-card-offered" title="Applications with job offers">
            <p className="stat-label">Offers</p>
            <p className="stat-value">{stats.offered}</p>
          </div>
          {gamificationState !== null && (
            <div className="stat-card stat-card-total" title="Your current rank based on activity points. Earn points by adding applications, getting interviews, and receiving offers!">
              <p className="stat-label">Rank</p>
              <p className="stat-value" style={{ fontSize: '1.25rem' }}>{gamificationState.rank}</p>
              <div className="rank-progress-bar">
                <div 
                  className="rank-progress-fill" 
                  style={{ '--progress-width': `${gamification.getRankProgress(gamificationState.points)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400" style={{ marginTop: '0.5rem' }}>
                {gamificationState.points} pts
                {gamificationState.streak_days > 0 && (
                  <span className="streak-badge" style={{ marginLeft: '0.5rem' }} title="Daily login streak">
                    🔥 {gamificationState.streak_days} day{gamificationState.streak_days !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="controls">
          <button 
            onClick={handleAddNew}
            className="btn-primary"
            disabled={isSyncing}
            title="Add a new job application to track"
          >
            <Plus size={18} /> New Application
          </button>
          <div className="export-buttons">
            <label 
              className="btn-upload"
              title="Import multiple applications from a CSV file&#10;&#10;Format: Company, Position, Date Applied, Contact Person, Status, Notes&#10;Required: Company and Position&#10;Status: applied, interview, offered, rejected, or accepted"
            >
              <Upload size={16} /> Import CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                style={{ display: 'none' }}
                disabled={isSyncing}
              />
            </label>
            <button 
              onClick={exportToCSV}
              className="btn-export"
              disabled={applications.length === 0}
              title="Export all applications to CSV file"
            >
              <Download size={16} /> CSV
            </button>
            <button 
              onClick={exportToPDF}
              className="btn-export"
              disabled={applications.length === 0}
              title="Export all applications to PDF (opens print dialog)"
            >
              <Download size={16} /> PDF
            </button>
          </div>
          
          <div className="filter-buttons">
            {['all', 'applied', 'interview', 'offered', 'rejected', 'accepted'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`filter-btn ${filterStatus === status ? 'active' : ''}`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Applications Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th 
                  onClick={() => handleSort('company')} 
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  title="Click to sort by company"
                >
                  Company {sortColumn === 'company' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('position')} 
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  title="Click to sort by position"
                >
                  Position {sortColumn === 'position' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('date_applied')} 
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  title="Click to sort by date"
                >
                  Applied {sortColumn === 'date_applied' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedApplications.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    {filterStatus !== 'all' ? (
                      <>No {filterStatus} applications found. Try changing the filter or add a new application.</>
                    ) : (
                      <>No applications yet. Click "New Application" above to start tracking your job search!</>
                    )}
                  </td>
                </tr>
              ) : (
                                sortedApplications.map(app => (
                  <tr key={app.id}>
                    <td className="company-name">{app.company}</td>
                    <td className="position-name">{app.position}</td>
                    <td className="date">
                      {new Date(app.date_applied).toLocaleDateString()}
                    </td>
                    <td className="contact">{app.contact_person || 'â€"'}</td>
                    <td>
                      <span className={`status-badge ${statusConfig[app.status].bg} ${statusConfig[app.status].text}`}>
                        {statusConfig[app.status].label}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button onClick={() => handleEdit(app)} className="btn-icon" title="Edit" disabled={isSyncing}>
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(app.id)} className="btn-icon delete" title="Delete" disabled={isSyncing}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))

              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {sortedApplications.length > 0 && (
          <div className="footer">
            <p>Showing {sortedApplications.length} of {applications.length} applications</p>
          </div>
        )}
          </>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={handleCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingId ? 'Edit Application' : 'New Application'}
              </h2>
              <button
                onClick={handleCancel}
                className="modal-close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Company *</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g., Acme Corp"
                />
              </div>

              <div className="form-group">
                <label>Position *</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="e.g., Senior Engineer"
                />
              </div>

              <div className="form-group">
                <label>Date Applied</label>
                <input
                  type="date"
                  value={formData.date_applied}
                  onChange={(e) => setFormData({ ...formData, date_applied: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Contact Person</label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="e.g., John Doe, Hiring Manager"
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="applied">Applied</option>
                  <option value="interview">Interview</option>
                  <option value="offered">Offered</option>
                  <option value="rejected">Rejected</option>
                  <option value="accepted">Accepted</option>
                </select>
              </div>

              <div className="form-group">
                <label>Resume Version</label>
                <select
                  value={formData.resume_version_id || ''}
                  onChange={(e) => setFormData({ ...formData, resume_version_id: e.target.value || null })}
                >
                  <option value="">No resume linked</option>
                  {resumeVersions.map(version => (
                    <option key={version.id} value={version.id}>
                      {version.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Interview date, follow-up info, etc."
                  rows={4}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={handleCancel}
                className="btn-cancel"
                disabled={isSyncing}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-save"
                disabled={isSyncing}
              >
                <Check size={18} /> {isSyncing ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeMilestone && (
        <MilestoneToast
          milestone={activeMilestone}
          onDismiss={() => {
            setActiveMilestone(null);
            if (milestoneQueue.length > 0) {
              const [next, ...rest] = milestoneQueue;
              setMilestoneQueue(rest);
              setActiveMilestone(next);
            }
          }}
        />
      )}

      {showOnboarding && (
        <OnboardingTutorial onComplete={() => setShowOnboarding(false)} />
      )}

      {showApiSettings && (
        <ApiKeySettings isOpen={showApiSettings} onClose={() => setShowApiSettings(false)} />
      )}

      {activeCelebration && (
        <CelebrationAnimation
          milestone={activeCelebration}
          onComplete={() => setActiveCelebration(null)}
        />
      )}

      {statusCelebration && (
        <CelebrationAnimation
          milestone={{ tier: 'standard', type: statusCelebration.type }}
          emoji={statusCelebration.emoji}
          onComplete={() => setStatusCelebration(null)}
        />
      )}
    </div>
  );
}