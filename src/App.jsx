import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Edit2, X, Check, Download, LogOut, Upload } from 'lucide-react';
import { supabase } from './supabaseClient';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

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
    notes: ''
  });

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

  const handleAddNew = () => {
    setFormData({
      company: '',
      position: '',
      date_applied: new Date().toISOString().split('T')[0],
      contact_person: '',
      status: 'applied',
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
        // Insert new - with user_id
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
      <div className="min-h-screen bg-gradient flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-slate-50 mb-2">Application Monitor</h1>
              <p className="text-slate-400">Track your job applications</p>
            </div>

            <div className="flex gap-2 mb-6">
              <button
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
                className={`flex-1 py-2 rounded-lg transition-colors ${
                  authMode === 'login'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                }}
                className={`flex-1 py-2 rounded-lg transition-colors ${
                  authMode === 'signup'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Sign Up
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
                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    required
                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {authError && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                    <p className="text-red-400 text-sm">{authError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
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

  const statusConfig = {
    applied: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Applied' },
    interview: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', label: 'Interview' },
    offered: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'Offered' },
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
    <div className="min-h-screen bg-gradient">
      <div className="fixed inset-0 opacity-5 pointer-events-none grid-bg"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="header-accent"></div>
              <h1 className="text-3xl font-bold text-slate-50">Application Monitor</h1>
            </div>
            <div className="flex items-center gap-4">
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
            <p className="text-slate-400 text-sm">Track job applications across your pipeline</p>
            <p className="text-slate-400 text-xs">{isSyncing ? 'â— Syncing...' : 'â— Synced to cloud'}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
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
                      {new Date(app.date_applied).toLocaleDateString()}
                    </td>
                    <td className="contact">{app.contact_person || 'â€”'}</td>
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
    </div>
  );
}