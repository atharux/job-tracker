import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Edit2, X, Check, Download, LogOut, Trophy, Target, Flame, TrendingUp, Users, Award, Sprout, Flower2, Sun, Heart, Smile } from 'lucide-react';
import { supabase } from './supabaseClient';
import './App.css';

// Theme configurations
const THEMES = {
  battle: {
    name: 'Battle School',
    colors: {
      primary: 'blue',
      accent: 'purple',
      streak: 'orange'
    },
    terminology: {
      login: 'Deploy',
      signup: 'Enlist',
      roster: 'Battle School Roster',
      rosterSub: 'Command Rankings',
      monitor: 'Application Monitor',
      points: 'Points',
      streak: 'Streak',
      rank: 'Rank',
      operative: 'Operative',
      title: 'Title'
    },
    ranks: [
      { title: 'Launchman', points: 0, color: 'slate' },
      { title: 'Recruit', points: 100, color: 'blue' },
      { title: 'Soldier', points: 500, color: 'green' },
      { title: 'Veteran', points: 1000, color: 'yellow' },
      { title: 'Toon Leader', points: 2500, color: 'orange' },
      { title: 'Commander', points: 5000, color: 'purple' }
    ],
    icon: Target
  },
  garden: {
    name: 'Career Garden',
    colors: {
      primary: 'green',
      accent: 'emerald',
      streak: 'yellow'
    },
    terminology: {
      login: 'Enter Garden',
      signup: 'Plant Seeds',
      roster: 'Growth Collective',
      rosterSub: 'Community Garden',
      monitor: 'Career Garden',
      points: 'Growth',
      streak: 'Bloom Streak',
      rank: 'Growth Stage',
      operative: 'Gardener',
      title: 'Stage'
    },
    ranks: [
      { title: 'Seed', points: 0, color: 'slate' },
      { title: 'Sprout', points: 100, color: 'green' },
      { title: 'Seedling', points: 500, color: 'emerald' },
      { title: 'Sapling', points: 1000, color: 'lime' },
      { title: 'Flowering', points: 2500, color: 'yellow' },
      { title: 'Full Bloom', points: 5000, color: 'pink' }
    ],
    icon: Flower2
  }
};

export default function App() {
  const [theme, setTheme] = useState('garden'); // Default to peaceful theme
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [currentView, setCurrentView] = useState('tracker');

  const [applications, setApplications] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [allUserStats, setAllUserStats] = useState([]);
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
    difficulty: 'standard',
    notes: ''
  });

  const currentTheme = THEMES[theme];

  // Load theme preference from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme && THEMES[savedTheme]) {
      setTheme(savedTheme);
    }
  }, []);

  // Save theme preference
  const switchTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('appTheme', newTheme);
  };

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadApplications();
      loadUserStats();
      loadAllUserStats();
    }
  }, [user]);

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
      setUserStats(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
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

  const loadUserStats = async () => {
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Stats load error:', error);
        return;
      }

      setUserStats(data);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  };

  const loadAllUserStats = async () => {
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select(`
          *,
          users:user_id (email)
        `)
        .order('total_points', { ascending: false });

      if (error) {
        console.error('All stats load error:', error);
        return;
      }

      setAllUserStats(data || []);
    } catch (e) {
      console.error('Failed to load all stats:', e);
    }
  };

  const handleAddNew = () => {
    setFormData({
      company: '',
      position: '',
      date_applied: new Date().toISOString().split('T')[0],
      contact_person: '',
      status: 'applied',
      difficulty: 'standard',
      notes: ''
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
      difficulty: app.difficulty || 'standard',
      notes: app.notes
    });
    setEditingId(app.id);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.company.trim() || !formData.position.trim()) {
      alert('Company and position are required');
      return;
    }

    setIsSyncing(true);
    try {
      if (editingId) {
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
      await loadUserStats();
      await loadAllUserStats();
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
      await loadUserStats();
      await loadAllUserStats();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const exportToCSV = () => {
    const headers = ['Company', 'Position', 'Date Applied', 'Contact Person', 'Status', 'Difficulty', 'Notes'];
    const rows = applications.map(app => [
      app.company,
      app.position,
      app.date_applied,
      app.contact_person,
      app.status,
      app.difficulty,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    const ThemeIcon = currentTheme.icon;
    
    return (
      <div className="min-h-screen bg-gradient flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-3">
                <ThemeIcon className={`text-${currentTheme.colors.primary}-400`} size={32} />
                <h1 className="text-3xl font-bold text-slate-50">{currentTheme.name}</h1>
              </div>
              <p className="text-slate-400">
                {theme === 'battle' ? 'Career Command Center' : 'Nurture your career journey together'}
              </p>
            </div>

            {/* Theme Switcher */}
            <div className="mb-6 flex gap-2 bg-slate-900/50 p-1 rounded-lg">
              <button
                onClick={() => switchTheme('garden')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                  theme === 'garden'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Flower2 size={16} />
                <span className="text-sm">Garden</span>
              </button>
              <button
                onClick={() => switchTheme('battle')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                  theme === 'battle'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Target size={16} />
                <span className="text-sm">Battle</span>
              </button>
            </div>

            <div className="flex gap-2 mb-6">
              <button
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
                className={`flex-1 py-2 rounded-lg transition-colors ${
                  authMode === 'login'
                    ? `bg-${currentTheme.colors.primary}-600 text-white`
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {currentTheme.terminology.login}
              </button>
              <button
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                }}
                className={`flex-1 py-2 rounded-lg transition-colors ${
                  authMode === 'signup'
                    ? `bg-${currentTheme.colors.primary}-600 text-white`
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {currentTheme.terminology.signup}
              </button>
            </div>

            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup}>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className={`w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-${currentTheme.colors.primary}-500`}
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={`w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-${currentTheme.colors.primary}-500`}
                  />
                </div>

                {authError && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                    <p className="text-red-400 text-sm">{authError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  className={`w-full bg-${currentTheme.colors.primary}-600 hover:bg-${currentTheme.colors.primary}-700 text-white py-3 rounded-lg font-medium transition-colors`}
                >
                  {authMode === 'login' ? currentTheme.terminology.login : currentTheme.terminology.signup}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Roster/Community View
  if (currentView === 'roster') {
    const userRank = allUserStats.findIndex(stat => stat.user_id === user.id) + 1;
    const ThemeIcon = currentTheme.icon;
    const StreakIcon = theme === 'battle' ? Flame : Sun;
    const PointsIcon = theme === 'battle' ? Trophy : Sprout;
    
    return (
      <div className="min-h-screen bg-gradient">
        <div className="fixed inset-0 opacity-5 pointer-events-none grid-bg"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-1 h-12 bg-gradient-to-b from-${currentTheme.colors.primary}-500 to-${currentTheme.colors.accent}-600 rounded`}></div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-50">{currentTheme.terminology.roster}</h1>
                  <p className="text-slate-400 text-sm">{currentTheme.terminology.rosterSub}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Theme Switcher */}
                <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg">
                  <button
                    onClick={() => switchTheme('garden')}
                    className={`p-2 rounded transition-all ${
                      theme === 'garden' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-slate-300'
                    }`}
                    title="Garden Theme"
                  >
                    <Flower2 size={16} />
                  </button>
                  <button
                    onClick={() => switchTheme('battle')}
                    className={`p-2 rounded transition-all ${
                      theme === 'battle' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-300'
                    }`}
                    title="Battle Theme"
                  >
                    <Target size={16} />
                  </button>
                </div>
                
                <button
                  onClick={() => setCurrentView('tracker')}
                  className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  ← Back to Tracker
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>
          </div>

          {/* Your Stats Card */}
          {userStats && (
            <div className={`mb-8 bg-gradient-to-br from-${currentTheme.colors.primary}-900/30 to-${currentTheme.colors.accent}-900/30 border border-${currentTheme.colors.primary}-500/30 rounded-xl p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-50">{user.email}</h2>
                  <p className={`text-${currentTheme.colors.primary}-400 font-semibold text-lg`}>{userStats.rank_title}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-sm">Overall {currentTheme.terminology.rank}</p>
                  <p className={`text-4xl font-bold text-${currentTheme.colors.primary}-400`}>#{userRank}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <PointsIcon className={`text-${theme === 'battle' ? 'yellow' : 'green'}-400`} size={20} />
                    <p className="text-slate-400 text-sm">{currentTheme.terminology.points}</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-50">{userStats.total_points}</p>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <StreakIcon className={`text-${theme === 'battle' ? 'orange' : 'yellow'}-400`} size={20} />
                    <p className="text-slate-400 text-sm">{currentTheme.terminology.streak}</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-50">{userStats.current_streak} days</p>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="text-green-400" size={20} />
                    <p className="text-slate-400 text-sm">Applications</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-50">{userStats.applications_count}</p>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className={`text-${theme === 'battle' ? 'purple' : 'pink'}-400`} size={20} />
                    <p className="text-slate-400 text-sm">Offers</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-50">{userStats.offers_count}</p>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700/50">
              <h3 className="text-xl font-bold text-slate-50">
                {theme === 'battle' ? 'Command Rankings' : 'Growth Leaderboard'}
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/30 border-b border-slate-700/50">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{currentTheme.terminology.rank}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{currentTheme.terminology.operative}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{currentTheme.terminology.title}</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">{currentTheme.terminology.points}</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">{currentTheme.terminology.streak}</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Applications</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Interviews</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Offers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {allUserStats.map((stat, index) => {
                    const isCurrentUser = stat.user_id === user.id;
                    const rankColor = index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-orange-400' : 'text-slate-500';
                    const rankEmoji = index === 0 ? '🌟' : index === 1 ? '⭐' : index === 2 ? '✨' : '';
                    
                    return (
                      <tr 
                        key={stat.id} 
                        className={`${isCurrentUser ? `bg-${currentTheme.colors.primary}-900/20 border-l-4 border-${currentTheme.colors.primary}-500` : 'hover:bg-slate-700/20'} transition-colors`}
                      >
                        <td className="px-6 py-4">
                          <span className={`text-2xl font-bold ${rankColor}`}>
                            {rankEmoji} {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-10 h-10 rounded-full ${isCurrentUser ? `bg-${currentTheme.colors.primary}-600` : 'bg-slate-700'} flex items-center justify-center`}>
                              <span className="text-white font-bold">
                                {stat.users?.email?.charAt(0).toUpperCase() || '?'}
                              </span>
                            </div>
                            <span className={`${isCurrentUser ? `text-${currentTheme.colors.primary}-400 font-semibold` : 'text-slate-300'}`}>
                              {stat.users?.email || 'Unknown'}
                              {isCurrentUser && <span className={`ml-2 text-xs text-${currentTheme.colors.primary}-500`}>(You)</span>}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 bg-gradient-to-r from-${currentTheme.colors.primary}-500/20 to-${currentTheme.colors.accent}-500/20 border border-${currentTheme.colors.primary}-500/30 rounded-full text-${currentTheme.colors.primary}-300 text-sm font-medium`}>
                            {stat.rank_title}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-lg font-bold text-slate-50">{stat.total_points}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {stat.current_streak > 0 && <StreakIcon className={`text-${theme === 'battle' ? 'orange' : 'yellow'}-400`} size={16} />}
                            <span className="text-slate-300">{stat.current_streak}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-300">{stat.applications_count}</td>
                        <td className="px-6 py-4 text-right text-slate-300">{stat.interviews_count}</td>
                        <td className="px-6 py-4 text-right text-slate-300">{stat.offers_count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rank Progression Guide */}
          <div className="mt-8 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-slate-50 mb-4">
              {theme === 'battle' ? 'Rank Progression' : 'Growth Stages'}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {currentTheme.ranks.map(rank => (
                <div key={rank.title} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <p className={`text-${rank.color}-400 font-semibold text-sm mb-1`}>{rank.title}</p>
                  <p className="text-slate-500 text-xs">{rank.points}+ pts</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Tracker View
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

  const statusConfig = {
    applied: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Applied' },
    interview: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', label: 'Interview' },
    offered: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'Offered' },
    rejected: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Rejected' },
    accepted: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Accepted' }
  };

  const difficultyConfig = {
    easy: { bg: 'bg-green-500/10', text: 'text-green-500', label: '★ Easy', points: 10 },
    standard: { bg: 'bg-blue-500/10', text: 'text-blue-500', label: '★★ Standard', points: 25 },
    hard: { bg: 'bg-orange-500/10', text: 'text-orange-500', label: '★★★ Hard', points: 50 },
    nightmare: { bg: 'bg-red-500/10', text: 'text-red-500', label: '★★★★ Nightmare', points: 100 }
  };

  const stats = {
    total: applications.length,
    applied: applications.filter(a => a.status === 'applied').length,
    interview: applications.filter(a => a.status === 'interview').length,
    offered: applications.filter(a => a.status === 'offered').length
  };

  const ThemeIcon = currentTheme.icon;
  const StreakIcon = theme === 'battle' ? Flame : Sun;
  const PointsIcon = theme === 'battle' ? Trophy : Sprout;

  return (
    <div className="min-h-screen bg-gradient">
      <div className="fixed inset-0 opacity-5 pointer-events-none grid-bg"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="header-accent"></div>
              <div>
                <h1 className="text-3xl font-bold text-slate-50">{currentTheme.terminology.monitor}</h1>
                {userStats && (
                  <p className={`text-${currentTheme.colors.primary}-400 text-sm font-semibold`}>
                    {userStats.rank_title} • {userStats.total_points} {currentTheme.terminology.points}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Theme Switcher */}
              <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg">
                <button
                  onClick={() => switchTheme('garden')}
                  className={`p-2 rounded transition-all ${
                    theme === 'garden' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-slate-300'
                  }`}
                  title="Garden Theme"
                >
                  <Flower2 size={16} />
                </button>
                <button
                  onClick={() => switchTheme('battle')}
                  className={`p-2 rounded transition-all ${
                    theme === 'battle' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-300'
                  }`}
                  title="Battle Theme"
                >
                  <Target size={16} />
                </button>
              </div>
              
              <button
                onClick={() => setCurrentView('roster')}
                className={`flex items-center gap-2 px-4 py-2 bg-${currentTheme.colors.primary}-600 hover:bg-${currentTheme.colors.primary}-700 text-white rounded-lg transition-colors`}
              >
                <Users size={16} /> {currentTheme.terminology.roster}
              </button>
              <span className="text-slate-400 text-sm">{user.email}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">
              {theme === 'battle' ? 'Track job applications across your pipeline' : 'Nurture your career opportunities'}
            </p>
            <p className="text-slate-400 text-xs">{isSyncing ? '● Syncing...' : '● Synced to cloud'}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="stat-card stat-card-total">
            <p className="stat-label">Total</p>
            <p className="stat-value">{stats.total}</p>
          </div>
          <div className="stat-card stat-card-applied">
            <p className="stat-label">Applied</p>
            <p className="stat-value">{stats.applied}</p>
          </div>
          <div className="stat-card stat-card-interview">
            <p className="stat-label">Interviews</p>
            <p className="stat-value">{stats.interview}</p>
          </div>
          <div className="stat-card stat-card-offered">
            <p className="stat-label">Offers</p>
            <p className="stat-value">{stats.offered}</p>
          </div>
          {userStats && (
            <>
              <div className={`bg-gradient-to-br from-${theme === 'battle' ? 'orange' : 'yellow'}-900/20 to-${theme === 'battle' ? 'orange' : 'yellow'}-700/20 border border-${theme === 'battle' ? 'orange' : 'yellow'}-500/30 rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <StreakIcon className={`text-${theme === 'battle' ? 'orange' : 'yellow'}-400`} size={18} />
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{currentTheme.terminology.streak}</p>
                </div>
                <p className="text-2xl font-bold text-slate-50">{userStats.current_streak}</p>
              </div>
              <div className={`bg-gradient-to-br from-${theme === 'battle' ? 'yellow' : 'green'}-900/20 to-${theme === 'battle' ? 'yellow' : 'green'}-700/20 border border-${theme === 'battle' ? 'yellow' : 'green'}-500/30 rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <PointsIcon className={`text-${theme === 'battle' ? 'yellow' : 'green'}-400`} size={18} />
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{currentTheme.terminology.points}</p>
                </div>
                <p className="text-2xl font-bold text-slate-50">{userStats.total_points}</p>
              </div>
            </>
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
            <button 
              onClick={exportToCSV}
              className="btn-export"
              disabled={applications.length === 0}
            >
              <Download size={16} /> CSV
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
                <th>Difficulty</th>
                <th>Applied</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No applications found. {filterStatus !== 'all' && 'Try changing the filter.'}
                  </td>
                </tr>
              ) : (
                filteredApplications.map(app => (
                  <tr key={app.id}>
                    <td className="company-name">{app.company}</td>
                    <td className="position-name">{app.position}</td>
                    <td>
                      <span className={`status-badge ${difficultyConfig[app.difficulty || 'standard'].bg} ${difficultyConfig[app.difficulty || 'standard'].text}`}>
                        {difficultyConfig[app.difficulty || 'standard'].label}
                      </span>
                    </td>
                    <td className="date">
                      {new Date(app.date_applied).toLocaleDateString()}
                    </td>
                    <td className="contact">{app.contact_person || '—'}</td>
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
                <label>Difficulty Level</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                >
                  <option value="easy">★ Easy ({difficultyConfig.easy.points} pts)</option>
                  <option value="standard">★★ Standard ({difficultyConfig.standard.points} pts)</option>
                  <option value="hard">★★★ Hard ({difficultyConfig.hard.points} pts)</option>
                  <option value="nightmare">★★★★ Nightmare ({difficultyConfig.nightmare.points} pts)</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  {theme === 'battle' ? 'Higher difficulty = more points earned' : 'Acknowledge the challenge of your growth'}
                </p>
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
                  <option value="interview">Interview (+50 pts bonus)</option>
                  <option value="offered">Offered (+150 pts bonus)</option>
                  <option value="accepted">Accepted (+300 pts bonus)</option>
                  <option value="rejected">Rejected</option>
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
    </div>
  );
}
