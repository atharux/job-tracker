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
  const applyGamification = async (action, actionData = {}) => {
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
      applications,
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

  // Streaks (optional): once per load of gamification state
  useEffect(() => {
    if (gamificationState && user) {
      applyGamification('streak_bonus');
    }
  }, [gamificationState?.id, user?.id]);

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
      setActiveMilestone(null);
      setMilestoneQueue([]);
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
      if (!user) {
        setApplications([]);
        return;
      }

      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id)
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
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleEdit = app => {
    setFormData({
      company: app.company,
      position: app.position,
      date_applied: app.date_applied,
      contact_person: app.contact_person,
      status: app.status,
      notes: app.notes,
    });
    setEditingId(app.id);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.company.trim() || !formData.position.trim()) {
      alert('Company and position are required');
      return;
    }

    const oldStatus = applications.find(a => a.id === editingId)?.status;

    setIsSyncing(true);

    try {
      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('applications')
          .update(formData)
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Update error:', error);
          alert('Failed to update application');
          return;
        }

        // Status change gamification
        if (oldStatus && oldStatus !== formData.status) {
          await applyGamification('update_status', {
            oldStatus,
            newStatus: formData.status,
          });
        }
      } else {
        // Insert new - with user_id
        const { error } = await supabase
          .from('applications')
          .insert([{ ...formData, user_id: user.id }]);

        if (error) {
          console.error('Insert error:', error);
          alert('Failed to save application');
          return;
        }

        // New application gamification
        await applyGamification('create_application');
      }

      setIsModalOpen(false);
      await loadApplications();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this application?')) return;

    setIsSyncing(true);

    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

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
      app.date_applied,
      app.contact_person,
      app.status,
      app.notes,
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell || ''}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `job-applications-${new Date()
      .toISOString()
      .split('T')[0]}.csv`;

    document.body.appendChild(a);
    a.click();

    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    const html = `
      <html>
      <head>
        <title>Job Applications</title>
      </head>
      <body>
        <h1>Job Applications</h1>
        <table border="1" cellspacing="0" cellpadding="4">
          <tr>
            <th>Company</th>
            <th>Position</th>
            <th>Date Applied</th>
            <th>Contact Person</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
          ${applications
            .map(
              app => `
            <tr>
              <td>${app.company}</td>
              <td>${app.position}</td>
              <td>${new Date(
                app.date_applied,
              ).toLocaleDateString('de-DE')}</td>
              <td>${app.contact_person || '—'}</td>
              <td>${app.status}</td>
              <td>${app.notes || ''}</td>
            </tr>
          `,
            )
            .join('')}
        </table>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const exportToJSON = () => {
    const json = JSON.stringify(applications, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `job-applications-${new Date()
      .toISOString()
      .split('T')[0]}.json`;

    document.body.appendChild(a);
    a.click();

    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleFileUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      if (!Array.isArray(imported)) {
        alert('Invalid JSON format: expected an array of applications.');
        return;
      }

      setIsSyncing(true);

      const rows = imported.map(app => ({
        company: app.company || '',
        position: app.position || '',
        date_applied:
          app.date_applied ||
          new Date().toISOString().split('T')[0],
        contact_person: app.contact_person || '',
        status: app.status || 'applied',
        notes: app.notes || '',
        user_id: user.id,
      }));

      const { error } = await supabase
        .from('applications')
        .insert(rows);

      if (error) {
        console.error('Import error:', error);
        alert('Failed to import applications');
        return;
      }

      await loadApplications();
      alert(`Imported ${rows.length} applications.`);
    } catch (err) {
      console.error('Import parse error:', err);
      alert('Failed to parse JSON file.');
    } finally {
      setIsSyncing(false);
      e.target.value = '';
    }
  };

  const statusConfig = {
    applied: {
      label: 'Applied',
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/40',
    },
    interview: {
      label: 'Interview',
      color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/40',
    },
    offered: {
      label: 'Offer',
      color: 'bg-green-500/10 text-green-400 border-green-500/40',
    },
    rejected: {
      label: 'Rejected',
      color: 'bg-red-500/10 text-red-400 border-red-500/40',
    },
    accepted: {
      label: 'Accepted',
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40',
    },
  };

  const filteredApplications =
    filterStatus === 'all'
      ? applications
      : applications.filter(app => app.status === filterStatus);

  const stats = {
    total: applications.length,
    applied: applications.filter(a => a.status === 'applied').length,
    interview: applications.filter(a => a.status === 'interview').length,
    offered: applications.filter(a => a.status === 'offered').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-slate-700 border-t-sky-500 rounded-full animate-spin mx-auto" />
          <div className="text-slate-400 text-sm">
            Loading your applications...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="w-full max-w-md p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl shadow-sky-500/10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold tracking-tight">
              Track your job applications
            </h1>
            <div className="px-2 py-1 rounded-full border border-slate-700 text-[11px] uppercase tracking-wide text-slate-400">
              Beta
            </div>
          </div>

          <div className="flex mb-4 rounded-full bg-slate-900 p-1 border border-slate-800">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-1.5 text-xs rounded-full transition-all ${
                authMode === 'login'
                  ? 'bg-slate-100 text-slate-950 font-medium shadow'
                  : 'text-slate-400'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-1.5 text-xs rounded-full transition-all ${
                authMode === 'signup'
                  ? 'bg-slate-100 text-slate-950 font-medium shadow'
                  : 'text-slate-400'
              }`}
            >
              Sign up
            </button>
          </div>

          <form
            className="space-y-4"
            onSubmit={authMode === 'login' ? handleLogin : handleSignup}
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 mt-1 px-3 py-2 rounded-lg text-sm font-medium bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors"
            >
              <Check className="w-4 h-4" />
              {authMode === 'login' ? 'Login' : 'Create account'}
            </button>

            <p className="text-[11px] text-slate-500 mt-2">
              Your applications are securely stored in the cloud and synced
              across devices.
            </p>
          </form>
        </div>
      </div>
    );
  }

  const themeClasses =
    theme === 'dark'
      ? 'bg-slate-950 text-slate-100'
      : 'bg-emerald-50 text-emerald-950';

  return (
    <div
      className={`min-h-screen ${themeClasses} transition-colors duration-300`}
    >
      <div className="max-w-5xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              Track job applications across your pipeline
            </h1>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                  isSyncing
                    ? 'border-yellow-500/40 text-yellow-400'
                    : 'border-emerald-500/40 text-emerald-400'
                } bg-slate-900/60`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSyncing ? 'bg-yellow-400' : 'bg-emerald-400'
                  }`}
                />
                {isSyncing ? 'Syncing...' : 'Synced to cloud'}
              </span>
              {gamificationState && (
                <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                  Rank{' '}
                  <span className="px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/60 text-[10px] uppercase tracking-wide">
                    {gamificationState.rank}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {gamificationState.points} pts
                    {gamificationState.streak_days > 0 && (
                      <>
                        {' '}
                        🔥 {gamificationState.streak_days} day
                        {gamificationState.streak_days !== 1 ? 's' : ''}
                      </>
                    )}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800/90 transition-colors"
            >
              {theme === 'dark' ? '🌿 Garden' : '🌘 Dark'}
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-700 bg-slate-900/80 text-[11px] text-slate-300 hover:bg-slate-800/90 transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Logout
            </button>
          </div>
        </header>

        <div className="grid grid-cols-[1fr_auto] gap-4 items-start mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors shadow shadow-sky-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Add application
            </button>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span>Keep track of every role you apply for</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-slate-700 bg-slate-900/80 text-[11px] text-slate-300 hover:bg-slate-800/90 transition-colors"
            >
              <Download className="w-3 h-3" />
              CSV
            </button>
            <button
              onClick={exportToJSON}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-slate-700 bg-slate-900/80 text-[11px] text-slate-300 hover:bg-slate-800/90 transition-colors"
            >
              <Download className="w-3 h-3" />
              JSON
            </button>
            <button
              onClick={exportToPDF}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-slate-700 bg-slate-900/80 text-[11px] text-slate-300 hover:bg-slate-800/90 transition-colors"
            >
              <Download className="w-3 h-3" />
              PDF
            </button>
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-slate-700 bg-slate-900/80 text-[11px] text-slate-300 hover:bg-slate-800/90 transition-colors cursor-pointer">
              <Upload className="w-3 h-3" />
              Import
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-[11px] text-slate-500 mb-1">Total</div>
            <div className="text-xl font-semibold">{stats.total}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-[11px] text-slate-500 mb-1">Applied</div>
            <div className="text-xl font-semibold">{stats.applied}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-[11px] text-slate-500 mb-1">Interviews</div>
            <div className="text-xl font-semibold">{stats.interview}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-[11px] text-slate-500 mb-1">Offers</div>
            <div className="text-xl font-semibold">{stats.offered}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-[11px] text-slate-500 mb-1">Rank</div>
            {gamificationState ? (
              <>
                <div className="text-sm font-semibold">
                  {gamificationState.rank}
                </div>
                <div className="text-[11px] text-slate-500">
                  {gamificationState.points} pts
                  {gamificationState.streak_days > 0 && (
                    <>
                      {' '}
                      🔥 {gamificationState.streak_days} day
                      {gamificationState.streak_days !== 1 ? 's' : ''}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="text-[11px] text-slate-600">Loading…</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1.5 text-[11px]">
            {[
              'all',
              'applied',
              'interview',
              'offered',
              'rejected',
              'accepted',
            ].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
                  filterStatus === status
                    ? 'bg-sky-500 text-slate-950 border-sky-500'
                    : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800/90'
                }`}
              >
                {status === 'all'
                  ? 'All'
                  : statusConfig[status].label}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-slate-500">
            Showing {filteredApplications.length} of {applications.length}{' '}
            applications
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 border-b border-slate-800">
              <tr>
                <th className="text-left px-3 py-2 text-[11px] font-medium text-slate-400">
                  Company
                </th>
                <th className="text-left px-3 py-2 text-[11px] font-medium text-slate-400">
                  Position
                </th>
                <th className="text-left px-3 py-2 text-[11px] font-medium text-slate-400">
                  Applied
                </th>
                <th className="text-left px-3 py-2 text-[11px] font-medium text-slate-400">
                  Contact
                </th>
                <th className="text-left px-3 py-2 text-[11px] font-medium text-slate-400">
                  Status
                </th>
                <th className="text-right px-3 py-2 text-[11px] font-medium text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-sm text-slate-500"
                  >
                    Loading...
                  </td>
                </tr>
              ) : filteredApplications.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-sm text-slate-500"
                  >
                    No applications found.{` `}
                    {filterStatus !== 'all' &&
                      'Try changing the filter.'}
                  </td>
                </tr>
              ) : (
                filteredApplications.map(app => (
                  <tr
                    key={app.id}
                    className="border-t border-slate-900/80 hover:bg-slate-900/60"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-100">
                        {app.company}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      {app.position}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {app.date_applied
                        ? new Date(
                            app.date_applied,
                          ).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {app.contact_person || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${
                          statusConfig[app.status]?.color ||
                          statusConfig.applied.color
                        }`}
                      >
                        {statusConfig[app.status]?.label ||
                          statusConfig.applied.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleEdit(app)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800/90 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(app.id)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-red-900/60 bg-red-950/60 text-red-300 hover:bg-red-900/80 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl shadow-sky-500/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">
                  {editingId ? 'Edit application' : 'New application'}
                </h2>
                <button
                  onClick={handleCancel}
                  className="w-7 h-7 inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800/90 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs text-slate-300">
                    Company
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        company: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    placeholder="Acme Corp"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs text-slate-300">
                    Position
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        position: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    placeholder="Frontend Engineer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs text-slate-300">
                      Date applied
                    </label>
                    <input
                      type="date"
                      value={formData.date_applied}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          date_applied: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-slate-300">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          status: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="applied">Applied</option>
                      <option value="interview">Interview</option>
                      <option value="offered">Offered</option>
                      <option value="rejected">Rejected</option>
                      <option value="accepted">Accepted</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs text-slate-300">
                    Contact person
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        contact_person: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    placeholder="Hiring manager, recruiter, etc."
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs text-slate-300">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        notes: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    rows={3}
                    placeholder="Anything relevant about this application..."
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900/80 text-xs text-slate-300 hover:bg-slate-800/90 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500 text-xs font-medium text-slate-950 hover:bg-sky-400 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
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
    </div>
  );
}
