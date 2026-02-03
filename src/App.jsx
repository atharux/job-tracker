import React, { useState, useEffect } from 'react';
import {
  Trash2,
  Plus,
  Edit2,
  X,
  Check,
  Download,
  LogOut,
  Upload,
} from 'lucide-react';
import { supabase } from './supabaseClient';
import MilestoneToast from './MilestoneToast.jsx';
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

  const [theme, setTheme] = useState('dark'); // 'dark' or 'garden'

  const [applications, setApplications] = useState([]);
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
  });

  const [gamificationState, setGamificationState] = useState(null);
  const [activeMilestone, setActiveMilestone] = useState(null);
  const [milestoneQueue, setMilestoneQueue] = useState([]);

  // Central gamification helper
  const applyGamification = async (action, actionData = {}, freshApplications = null) => {
    if (!gamificationState || !user) return;

    const oldState = gamificationState;
    const newState = gamification.computeNewState(
      oldState,
      action,
      actionData,
    );

    const milestones = gamification.detectMilestones(
      oldState,
      newState,
      freshApplications || applications,
    );

    setGamificationState(newState);

    await supabase
      .from('gamification_state')
      .update(newState)
      .eq('user_id', user.id);

    if (milestones.length > 0) {
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
    }
  }, [user]);



  // Milestone queue handler
  useEffect(() => {
    if (milestoneQueue.length > 0 && !activeMilestone) {
      setActiveMilestone(milestoneQueue[0]);
      setMilestoneQueue(prev => prev.slice(1));
    }
  }, [milestoneQueue, activeMilestone]);

  const checkUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRetroactivePoints = applications => {
    let points = 0;

    // 10 points per application
    points += applications.length * 10;

    // 25 points per interview (status = interview, offered, or accepted)
    const interviews = applications.filter(
      a =>
        a.status === 'interview' ||
        a.status === 'offered' ||
        a.status === 'accepted',
    ).length;
    points += interviews * 25;

    // 50 points per offer (status = offered or accepted)
    const offers = applications.filter(
      a => a.status === 'offered' || a.status === 'accepted',
    ).length;
    points += offers * 50;

    return points;
  };

  const loadGamificationState = async () => {
    console.log('[GAMIFICATION] Starting loadGamificationState...');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log('[GAMIFICATION] No user found, skipping');
        return;
      }

      console.log('[GAMIFICATION] User ID:', user.id);

      const { data, error } = await supabase
        .from('gamification_state')
        .select('*')
        .eq('user_id', user.id)
        .single();

      console.log('[GAMIFICATION] Query result:', { data, error });

      if (error && error.code === 'PGRST116') {
        console.log(
          '[GAMIFICATION] No existing state found, creating initial state...',
        );

        // Load existing applications for this user to calculate retro points
        const { data: existingApps } = await supabase
          .from('applications')
          .select('*')
          .eq('user_id', user.id);

        console.log(
          '[GAMIFICATION] Existing apps:',
          existingApps?.length || 0,
        );

        const retroPoints = calculateRetroactivePoints(
          existingApps || [],
        );
        const initialRank = gamification.calculateRank(retroPoints);

        console.log(
          '[GAMIFICATION] Retroactive points:',
          retroPoints,
          'Initial rank:',
          initialRank,
        );

        const initialState = {
          ...gamification.getInitialState(),
          points: retroPoints,
          rank: initialRank,
        };

        const { data: newData, error: insertError } = await supabase
          .from('gamification_state')
          .insert([{ user_id: user.id, ...initialState }])
          .select()
          .single();

        console.log('[GAMIFICATION] Insert result:', {
          newData,
          insertError,
        });

        if (!insertError) {
          setGamificationState(newData);
          console.log(
            '[GAMIFICATION] State set successfully:',
            newData,
          );
        } else {
          console.error(
            '[GAMIFICATION] Insert error:',
            insertError,
          );
        }
      } else if (!error) {
        setGamificationState(data);
        console.log('[GAMIFICATION] Loaded existing state:', data);
      } else {
        console.error('[GAMIFICATION] Unexpected error:', error);
      }
    } catch (error) {
      console.error(
        '[GAMIFICATION] Error in loadGamificationState:',
        error,
      );
    }
  };

  const handleLogin = async e => {
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

  const handleSignup = async e => {
    e.preventDefault();
    setAuthError('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        alert(
          'Account created! Please check your email to verify your account.',
        );
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
      setGamificationState(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'garden' : 'dark'));
  };

  const loadApplications = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id)
        .order('date_applied', { ascending: false });

      if (error) throw error;

      setApplications(data || []);
    } catch (error) {
      console.error('Error loading applications:', error);
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
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleEdit = app => {
    setFormData({
      company: app.company,
      position: app.position,
      date_applied: app.date_applied || '',
      contact_person: app.contact_person || '',
      status: app.status,
      notes: app.notes || '',
    });
    setEditingId(app.id);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.company?.trim() || !formData.position?.trim()) {
      alert('Company and Position are required.');
      return;
    }

    try {
      setIsSyncing(true);

      const dataToSave = {
        company: formData.company.trim(),
        position: formData.position.trim(),
        date_applied: formData.date_applied || null,
        contact_person: formData.contact_person?.trim() || null,
        status: formData.status,
        notes: formData.notes?.trim() || null,
        user_id: user.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from('applications')
          .update(dataToSave)
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Gamification: status_change
        const oldApp = applications.find(a => a.id === editingId);
        if (oldApp && oldApp.status !== formData.status) {
          await applyGamification('status_change', {
            from: oldApp.status,
            to: formData.status,
          });
        }
      } else {
        const { error } = await supabase
          .from('applications')
          .insert([dataToSave]);

        if (error) throw error;

        // Gamification: new_application
        await applyGamification('new_application');
      }

      await loadApplications();
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        company: '',
        position: '',
        date_applied: '',
        contact_person: '',
        status: 'applied',
        notes: '',
      });
    } catch (error) {
      console.error('Error saving application:', error);
      alert('Failed to save application. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async id => {
    if (!confirm('Are you sure you want to delete this application?'))
      return;

    try {
      setIsSyncing(true);
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadApplications();
    } catch (error) {
      console.error('Error deleting application:', error);
      alert('Failed to delete application. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({
      company: '',
      position: '',
      date_applied: '',
      contact_person: '',
      status: 'applied',
      notes: '',
    });
  };

  const exportToCSV = () => {
    if (applications.length === 0) return;

    const headers = [
      'Company',
      'Position',
      'Date Applied',
      'Contact Person',
      'Status',
      'Notes',
    ];
    const rows = applications.map(app => [
      app.company,
      app.position,
      app.date_applied || '',
      app.contact_person || '',
      app.status,
      app.notes || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-applications-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCSVUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSyncing(true);
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        alert('CSV file is empty or invalid.');
        return;
      }

      const dataLines = lines.slice(1);
      const imported = [];

      for (const line of dataLines) {
        const match = line.match(
          /(?:^|,)("(?:[^"]|"")*"|[^,]*)/g,
        );
        if (!match || match.length < 2) continue;

        const cells = match
          .map(cell =>
            cell
              .replace(/^,/, '')
              .replace(/^"|"$/g, '')
              .replace(/""/g, '"')
              .trim(),
          )
          .filter(Boolean);

        if (cells.length < 2) continue;

        const [company, position, date_applied, contact_person, status, notes] =
          cells;

        if (!company || !position) continue;

        const validStatuses = [
          'applied',
          'interview',
          'offered',
          'rejected',
          'accepted',
        ];
        const finalStatus = validStatuses.includes(status?.toLowerCase())
          ? status.toLowerCase()
          : 'applied';

        imported.push({
          company,
          position,
          date_applied: date_applied || null,
          contact_person: contact_person || null,
          status: finalStatus,
          notes: notes || null,
          user_id: user.id,
        });
      }

      if (imported.length === 0) {
        alert(
          'No valid rows found in CSV. Make sure you have Company and Position columns.',
        );
        return;
      }

      const { error } = await supabase
        .from('applications')
        .insert(imported);

      if (error) throw error;

      await loadApplications();

      // Gamification: bulk import
      await applyGamification('bulk_import', { count: imported.length });

      alert(`Successfully imported ${imported.length} applications!`);
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Failed to import CSV. Please check the file format.');
    } finally {
      setIsSyncing(false);
      e.target.value = '';
    }
  };

  const exportToPDF = async () => {
    if (applications.length === 0) return;

    try {
      const { jsPDF } = await import('jspdf');
      await import('jspdf-autotable');

      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text('Job Applications Tracker', 14, 20);

      doc.setFontSize(10);
      doc.text(
        `Generated on ${new Date().toLocaleDateString()}`,
        14,
        28,
      );

      const tableData = applications.map(app => [
        app.company,
        app.position,
        app.date_applied
          ? new Date(app.date_applied).toLocaleDateString()
          : 'â€"',
        app.contact_person || 'â€"',
        app.status.charAt(0).toUpperCase() + app.status.slice(1),
      ]);

      doc.autoTable({
        head: [['Company', 'Position', 'Applied', 'Contact', 'Status']],
        body: tableData,
        startY: 35,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      doc.save(
        `job-applications-${new Date().toISOString().split('T')[0]}.pdf`,
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const statusConfig = {
    applied: {
      label: 'Applied',
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      color: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
    },
    interview: {
      label: 'Interview',
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
    },
    offered: {
      label: 'Offered',
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      color: 'border-green-500/50 bg-green-500/10 text-green-400',
    },
    rejected: {
      label: 'Rejected',
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      color: 'border-red-500/50 bg-red-500/10 text-red-400',
    },
    accepted: {
      label: 'Accepted',
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      color: 'border-purple-500/50 bg-purple-500/10 text-purple-400',
    },
  };

  const filteredApplications =
    filterStatus === 'all'
      ? applications
      : applications.filter(app => app.status === filterStatus);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-100 mb-2">
              Job Tracker
            </h1>
            <p className="text-slate-400">
              Track your job applications in one place
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  authMode === 'login'
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  authMode === 'signup'
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form
              onSubmit={authMode === 'login' ? handleLogin : handleSignup}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>

                {authError && (
                  <div className="text-red-400 text-sm">{authError}</div>
                )}

                <button
                  type="submit"
                  className="w-full py-2 bg-sky-500 text-slate-950 rounded-lg font-medium hover:bg-sky-400 transition-colors"
                >
                  {authMode === 'login' ? 'Login' : 'Sign Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${theme === 'garden' ? 'garden' : ''}`}>
      <div className="container">
        {/* Header */}
        <div className="header">
          <div className="header-left">
            <h1 className="title">Job Application Tracker</h1>
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              title={theme === 'dark' ? 'Garden theme' : 'Dark theme'}
            >
              {theme === 'dark' ? '🌸' : '🌙'}
            </button>
          </div>
          <div className="header-actions">
            <button onClick={handleLogout} className="btn-logout">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats">
          <div className="stat-card">
            <div className="stat-value">{applications.length}</div>
            <div className="stat-label">Total Apps</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {applications.filter(a => a.status === 'applied').length}
            </div>
            <div className="stat-label">Applied</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {applications.filter(a => a.status === 'interview').length}
            </div>
            <div className="stat-label">Interview</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {applications.filter(a => a.status === 'offered').length}
            </div>
            <div className="stat-label">Offered</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {applications.filter(a => a.status === 'accepted').length}
            </div>
            <div className="stat-label">Accepted</div>
          </div>
          {gamificationState && (
            <div className="stat-card gamification">
              <div className="stat-value">{gamificationState.rank}</div>
              <p className="stat-label">
                {gamificationState.points} pts
                {gamificationState.streak_days > 0 && (
                  <span className="streak-badge" style={{ marginLeft: '0.5rem' }}>
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
          >
            <Plus size={18} /> New Application
          </button>

          <div className="export-buttons">
            <label 
              className="btn-upload"
              title="CSV Format: Company, Position, Date Applied, Contact Person, Status, Notes&#10;&#10;Required: Company and Position&#10;Status must be: applied, interview, offered, rejected, or accepted"
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
            >
              <Download size={16} /> CSV
            </button>
            <button 
              onClick={exportToPDF}
              className="btn-export"
              disabled={applications.length === 0}
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
                <th>Company</th>
                <th>Position</th>
                <th>Applied</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No applications found. {filterStatus !== 'all' && 'Try changing the filter.'}
                  </td>
                </tr>
              ) : (
                filteredApplications.map(app => (
                  <tr key={app.id}>
                    <td className="company-name">{app.company}</td>
                    <td className="position-name">{app.position}</td>
                    <td className="date">
                      {app.date_applied
                        ? new Date(app.date_applied).toLocaleDateString()
                        : 'â€"'}
                    </td>
                    <td className="contact">{app.contact_person || 'â€"'}</td>
                    <td>
                      <span className={`status-badge ${statusConfig[app.status].bg} ${statusConfig[app.status].text}`}>
                        {statusConfig[app.status].label}
                      </span>
                    </td>
                    <td className="action-buttons">
                      <button
                        onClick={() => handleEdit(app)}
                        className="btn-icon"
                        title="Edit"
                        disabled={isSyncing}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(app.id)}
                        className="btn-icon delete"
                        title="Delete"
                        disabled={isSyncing}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filteredApplications.length > 0 && (
          <div className="footer">
            <p>Showing {filteredApplications.length} of {applications.length} applications</p>
          </div>
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
    </div>
  );
}

