import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Edit2, X, Check, Download } from 'lucide-react';
import { supabase } from './supabaseClient';
import './App.css';

export default function App() {
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

  // Load from Supabase on mount
  useEffect(() => {
    loadApplications();
  }, []);

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
        // Insert new
        const { error } = await supabase
          .from('applications')
          .insert([formData]);

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
                  <td>${app.contact_person || '—'}</td>
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
          <div className="flex items-center gap-3 mb-4">
            <div className="header-accent"></div>
            <h1 className="text-3xl font-bold text-slate-50">Application Monitor</h1>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">Track job applications across your pipeline</p>
            <p className="text-slate-400 text-xs">{isSyncing ? '● Syncing...' : '● Synced to cloud'}</p>
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
