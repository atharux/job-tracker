// ============================================================================
// Forge — Job Application Tracker (App_v2.jsx)
/
//
// WHAT'S NEW IN THIS VERSION
// --------------------------
//  1.  Full WCAG 2.1 AA accessibility pass:
//       - High-contrast status badges (>= 4.5:1, most >= 7:1)
//       - All icon-only buttons get aria-label
//       - Modal: role="dialog", aria-modal, focus trap, Esc to close, focus restore
//       - Sortable headers use <button> with aria-sort
//       - Form labels properly associated via htmlFor
//       - Skip link to main content
//       - Live region announces toasts/sync status (aria-live)
//       - 44x44 minimum touch targets
//       - prefers-reduced-motion respected
//       - External links announce "(opens in new tab)" via sr-only text
//  2.  High-contrast mode toggle (persisted in localStorage)
//  3.  Dark / Light theme with proper contrast in both
//  4.  Bulk select + bulk delete + bulk status change
//  5.  Kanban board view (toggle with Table view)
//  6.  Upcoming interviews reminder banner
//  7.  Analytics dashboard view (apps/week, response rate, status distribution)
//  8.  Attachments per application (resume/cover letter URL list)
//  9.  Saved search presets as chips
// 10.  Activity timeline per application (auto-logs status changes)
// 11.  Mobile-friendly card view below md breakpoint (auto-switch)
//
// All companion CSS is in `accessibility.css` — import it from main.jsx or App.jsx.
// ============================================================================

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Trash2, Plus, Edit2, X, Check, Download, LogOut, Upload,
  FileText, HelpCircle, Settings, Search, ExternalLink,
  LayoutGrid, List, BarChart3, Clock, Paperclip, Bell, Sun, Moon, Contrast
} from 'lucide-react';
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
import './accessibility.css'; // NEW — see file delivered alongside this one

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const STATUS_OPTIONS = ['applied', 'interview', 'offered', 'rejected', 'accepted'];

// WCAG AA-compliant status badges (white text on dark color, 7:1+ contrast).
// Each also has a distinct shape/icon prefix so status is not color-only.
const STATUS_BADGE = {
  applied:  { className: 'badge badge-applied',  label: 'Applied',  symbol: '●' },
  interview:{ className: 'badge badge-interview',label: 'Interview',symbol: '◆' },
  offered:  { className: 'badge badge-offered',  label: 'Offered',  symbol: '★' },
  rejected: { className: 'badge badge-rejected', label: 'Rejected', symbol: '✕' },
  accepted: { className: 'badge badge-accepted', label: 'Accepted', symbol: '✓' },
};

const SAVED_SEARCHES = [
  { label: 'This week\'s interviews', query: 'status:interview this week' },
  { label: 'Pending follow-ups',     query: 'status:applied last 30 days' },
  { label: 'Recent offers',          query: 'status:offered last month' },
  { label: 'This month',             query: 'this month' },
];

// ----------------------------------------------------------------------------
// Reusable a11y helpers
// ----------------------------------------------------------------------------
const SkipLink = () => (
  <a href="#main-content" className="skip-link">Skip to main content</a>
);

const VisuallyHidden = ({ children }) => (
  <span className="sr-only">{children}</span>
);

// Live region used to announce sync state, errors, and milestones to screen readers.
const LiveRegion = ({ message }) => (
  <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
    {message}
  </div>
);

// Focus trap hook — used by modal.
function useFocusTrap(ref, isOpen, onClose) {
  useEffect(() => {
    if (!isOpen || !ref.current) return;

    const previouslyFocused = document.activeElement;
    const root = ref.current;
    const focusables = root.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first?.focus();

    const handleKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, ref, onClose]);
}

// ----------------------------------------------------------------------------
// Main App component
// ----------------------------------------------------------------------------
export default function App() {
  // ---------- Auth state ----------
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // ---------- Theme + a11y prefs ----------
  const [theme, setTheme] = useState(() => localStorage.getItem('forge.theme') || 'dark');
  const [highContrast, setHighContrast] = useState(
    () => localStorage.getItem('forge.hc') === '1'
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('forge.theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('hc-mode', highContrast);
    localStorage.setItem('forge.hc', highContrast ? '1' : '0');
  }, [highContrast]);

  // ---------- Data ----------
  const [applications, setApplications] = useState([]);
  const [resumeVersions, setResumeVersions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const [formData, setFormData] = useState(emptyForm());
  const [selectedIds, setSelectedIds] = useState(new Set()); // bulk select
  const [tableView, setTableView] = useState(
    () => localStorage.getItem('forge.view') || 'table' // 'table' | 'kanban'
  );
  useEffect(() => { localStorage.setItem('forge.view', tableView); }, [tableView]);

  const [timelineFor, setTimelineFor] = useState(null); // application id whose timeline is open
  const [timelineEvents, setTimelineEvents] = useState([]);

  // ---------- Gamification ----------
  const [gamificationState, setGamificationState] = useState(null);
  const [activeMilestone, setActiveMilestone] = useState(null);
  const [milestoneQueue, setMilestoneQueue] = useState([]);
  const [activeCelebration, setActiveCelebration] = useState(null);
  const [statusCelebration, setStatusCelebration] = useState(null);

  // ---------- View ----------
  const [currentView, setCurrentView] = useState('applications');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [sortColumn, setSortColumn] = useState('date_applied');
  const [sortDirection, setSortDirection] = useState('desc');

  // Modal focus trap
  const modalRef = useRef(null);
  useFocusTrap(modalRef, isModalOpen, () => handleCancel());

  function emptyForm() {
    return {
      company: '',
      position: '',
      date_applied: '',
      contact_person: '',
      status: 'applied',
      notes: '',
      resume_version_id: null,
      interview_date: '',
      job_posting_url: '',
      attachments: [], // [{ name, url, type }]
    };
  }

  // Announce a transient message to screen readers.
  const announce = useCallback((msg) => {
    setLiveMessage(msg);
    // Clear after a moment so re-announcement works.
    setTimeout(() => setLiveMessage(''), 2000);
  }, []);

  // --------------------------------------------------------------------------
  // Gamification (unchanged from v1 — kept brief)
  // --------------------------------------------------------------------------
  const applyGamification = async (action, actionData = {}) => {
    if (!gamificationState) return;
    const oldState = gamificationState;
    const newState = gamification.computeNewState(oldState, action, actionData);
    const milestones = gamification.detectMilestones(oldState, newState, applications);
    setGamificationState(newState);
    await supabase.from('gamification_state').update(newState).eq('user_id', user.id);
    if (milestones.length > 0) {
      const celebrationMilestones = milestones.filter(
        m => m.tier === 'rank-up' || m.tier === 'achievement' || m.tier === 'standard'
      );
      if (celebrationMilestones.length > 0 && !activeCelebration) {
        setActiveCelebration(celebrationMilestones[0]);
      }
      if (!activeMilestone) {
        setActiveMilestone(milestones[0]);
        setMilestoneQueue(milestones.slice(1));
      } else {
        setMilestoneQueue(prev => [...prev, ...milestones]);
      }
    }
  };

  // --------------------------------------------------------------------------
  // Bootstrap
  // --------------------------------------------------------------------------
  useEffect(() => {
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadApplications();
      loadGamificationState();
      loadResumeVersions();
    }
  }, [user]);

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
    } catch (e) {
      console.error('Error checking user:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadResumeVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('resume_versions').select('id, name').order('updated_at', { ascending: false });
      if (error) { console.error(error); return; }
      setResumeVersions(data || []);
    } catch (e) { console.error(e); }
  };

  const calculateRetroactivePoints = (apps) => {
    let p = 0;
    p += apps.length * 10;
    p += apps.filter(a => ['interview','offered','accepted'].includes(a.status)).length * 25;
    p += apps.filter(a => ['offered','accepted'].includes(a.status)).length * 50;
    return p;
  };

  const loadGamificationState = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: apps } = await supabase.from('applications').select('*');
      const allApps = apps || [];
      const retroPoints = calculateRetroactivePoints(allApps);
      const retroRank = gamification.calculateRank(retroPoints);
      const { data, error } = await supabase
        .from('gamification_state').select('*').eq('user_id', user.id).single();
      if (error && error.code === 'PGRST116') {
        const initial = {
          ...gamification.getInitialState(),
          user_id: user.id, points: retroPoints, rank: retroRank,
          last_login_date: new Date().toISOString().split('T')[0],
        };
        const { data: inserted } = await supabase
          .from('gamification_state').insert([initial]).select().single();
        setGamificationState(inserted);
        setShowOnboarding(true);
        return;
      }
      const isDailyLogin = gamification.checkDailyLogin(data.last_login_date);
      const updateFields = { points: retroPoints, rank: retroRank };
      if (isDailyLogin) updateFields.last_login_date = new Date().toISOString().split('T')[0];
      await supabase.from('gamification_state').update(updateFields).eq('user_id', user.id);
      setGamificationState({ ...data, ...updateFields });
    } catch (e) {
      console.error('[GAMIFICATION] load error:', e);
    }
  };

  // --------------------------------------------------------------------------
  // Auth handlers
  // --------------------------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault(); setAuthError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setUser(data.user);
    } catch (err) { setAuthError(err.message); }
  };

  const handleSignup = async (e) => {
    e.preventDefault(); setAuthError('');
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) alert('Account created! Please check your email to verify your account.');
    } catch (err) { setAuthError(err.message); }
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); setUser(null); setApplications([]); }
    catch (e) { console.error(e); }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault(); setAuthError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: 'https://job-tracker-3wd.pages.dev',
      });
      if (error) throw error;
      setResetSuccess(true);
      setTimeout(() => { setResetMode(false); setResetSuccess(false); setResetEmail(''); }, 3000);
    } catch (err) { setAuthError(err.message); }
  };

  // --------------------------------------------------------------------------
  // Applications CRUD
  // --------------------------------------------------------------------------
  const loadApplications = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('applications').select('*').order('date_applied', { ascending: false });
      if (error) { console.error(error); return; }
      setApplications(data || []);
    } finally { setIsLoading(false); }
  };

  const logEvent = async (applicationId, payload) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('application_events').insert([{
        application_id: applicationId,
        user_id: user.id,
        ...payload,
      }]);
    } catch (e) { console.error('Failed to log event:', e); }
  };

  const handleAddNew = () => {
    setFormData({ ...emptyForm(), date_applied: new Date().toISOString().split('T')[0] });
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
      resume_version_id: app.resume_version_id,
      interview_date: app.interview_date || '',
      job_posting_url: app.job_posting_url || '',
      attachments: app.attachments || [],
    });
    setEditingId(app.id);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.company.trim() || !formData.position.trim()) {
      announce('Company and position are required');
      alert('Company and position are required');
      return;
    }
    const payload = {
      ...formData,
      interview_date: formData.interview_date || null,
      job_posting_url: formData.job_posting_url ? formData.job_posting_url.trim() : null,
      attachments: formData.attachments || [],
    };
    const oldStatus = editingId ? applications.find(a => a.id === editingId)?.status : null;

    setIsSyncing(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('applications').update(payload).eq('id', editingId);
        if (error) { alert('Failed to update'); return; }
        if (oldStatus !== formData.status) {
          await logEvent(editingId, {
            event_type: 'status_change', from_status: oldStatus, to_status: formData.status,
            message: `Status changed from ${oldStatus} to ${formData.status}`,
          });
        } else {
          await logEvent(editingId, { event_type: 'edit', message: 'Application edited' });
        }
        announce('Application updated');
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: inserted, error } = await supabase
          .from('applications').insert([{ ...payload, user_id: user.id }]).select().single();
        if (error) { alert('Failed to save'); return; }
        if (inserted) {
          await logEvent(inserted.id, {
            event_type: 'created', to_status: payload.status,
            message: `Application created for ${payload.company} — ${payload.position}`,
          });
        }
        announce('Application created');
      }
      setIsModalOpen(false);
      await loadApplications();

      if (editingId && oldStatus !== formData.status) {
        if (formData.status === 'rejected')  setStatusCelebration({ emoji: '🦋', type: 'rejected' });
        else if (formData.status === 'interview') setStatusCelebration({ emoji: '🐲', type: 'interview' });
      }

      if (gamificationState) {
        const action = editingId ? 'update_status' : 'create_application';
        const actionData = editingId ? { oldStatus, newStatus: formData.status } : {};
        await applyGamification(action, actionData);
      }
    } finally { setIsSyncing(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this application?')) return;
    setIsSyncing(true);
    try {
      const { error } = await supabase.from('applications').delete().eq('id', id);
      if (error) { alert('Failed to delete'); return; }
      announce('Application deleted');
      await loadApplications();
    } finally { setIsSyncing(false); }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  // --------------------------------------------------------------------------
  // Bulk actions
  // --------------------------------------------------------------------------
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selectAllVisible = (ids) => setSelectedIds(new Set(ids));

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} application(s)?`)) return;
    setIsSyncing(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from('applications').delete().in('id', ids);
      if (error) { alert('Bulk delete failed'); return; }
      announce(`${ids.length} applications deleted`);
      clearSelection();
      await loadApplications();
    } finally { setIsSyncing(false); }
  };

  const bulkStatus = async (status) => {
    if (selectedIds.size === 0) return;
    setIsSyncing(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from('applications').update({ status }).in('id', ids);
      if (error) { alert('Bulk update failed'); return; }
      // Log events for each
      await Promise.all(ids.map(id => {
        const old = applications.find(a => a.id === id)?.status;
        return logEvent(id, {
          event_type: 'status_change', from_status: old, to_status: status,
          message: `Bulk status change to ${status}`,
        });
      }));
      announce(`${ids.length} applications updated to ${status}`);
      clearSelection();
      await loadApplications();
    } finally { setIsSyncing(false); }
  };

  // --------------------------------------------------------------------------
  // CSV import / export (kept from v1)
  // --------------------------------------------------------------------------
  const exportToCSV = () => {
    const headers = ['Company','Position','Date Applied','Contact Person','Status','Interview Date','Job Posting URL','Notes'];
    const rows = applications.map(a => [
      a.company, a.position, a.date_applied, a.contact_person, a.status,
      a.interview_date || '', a.job_posting_url || '', a.notes,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${(c ?? '').toString().replace(/"/g,'""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `job-applications-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
  };

  const exportToPDF = () => {
    const w = window.open('', '', 'height=600,width=800');
    const html = `<!DOCTYPE html><html><head><title>Job Applications</title>
      <style>body{font-family:Arial;margin:20px}h1{text-align:center}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#222;color:#fff;border:1px solid #000;padding:8px;text-align:left}
      td{border:1px solid #444;padding:8px}
      tr:nth-child(even){background:#f4f4f4}</style></head><body>
      <h1>Job Application Tracker</h1>
      <p style="text-align:center;color:#444">Generated ${new Date().toLocaleDateString()}</p>
      <table><thead><tr><th>Company</th><th>Position</th><th>Applied</th><th>Interview</th>
      <th>Contact</th><th>Status</th><th>Link</th><th>Notes</th></tr></thead><tbody>
      ${applications.map(a => `<tr>
        <td>${esc(a.company)}</td><td>${esc(a.position)}</td>
        <td>${a.date_applied ? new Date(a.date_applied).toLocaleDateString() : '—'}</td>
        <td>${a.interview_date ? new Date(a.interview_date).toLocaleDateString() : '—'}</td>
        <td>${esc(a.contact_person) || '—'}</td><td>${esc(a.status)}</td>
        <td>${a.job_posting_url ? `<a href="${esc(a.job_posting_url)}">link</a>` : '—'}</td>
        <td>${esc(a.notes)}</td></tr>`).join('')}
      </tbody></table></body></html>`;
    w.document.write(html); w.document.close(); w.print();
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const values = []; let cur = ''; let q = false;
      for (const ch of lines[i]) {
        if (ch === '"') q = !q;
        else if (ch === ',' && !q) { values.push(cur.trim().replace(/^"|"$/g,'')); cur = ''; }
        else cur += ch;
      }
      values.push(cur.trim().replace(/^"|"$/g,''));
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((h, idx) => { row[h.toLowerCase().replace(/ /g,'_')] = values[idx]; });
        out.push(row);
      }
    }
    return out;
  };

  const validateAndFormatCSV = (rows) => rows
    .filter(r => r.company && r.position)
    .map(r => ({
      company: r.company,
      position: r.position,
      date_applied: r.date_applied || new Date().toISOString().split('T')[0],
      contact_person: r.contact_person || '',
      status: STATUS_OPTIONS.includes((r.status || '').toLowerCase()) ? r.status.toLowerCase() : 'applied',
      notes: r.notes || '',
      interview_date: r.interview_date || null,
      job_posting_url: r.job_posting_url || null,
    }));

  const handleCSVUpload = async (event) => {
    const file = event.target.files[0]; if (!file) return;
    event.target.value = '';
    setIsSyncing(true);
    try {
      const text = await file.text();
      const data = validateAndFormatCSV(parseCSV(text));
      if (data.length === 0) { alert('No valid rows found'); return; }
      const dupes = data.filter(d => applications.some(a =>
        a.company.toLowerCase() === d.company.toLowerCase() &&
        a.position.toLowerCase() === d.position.toLowerCase()
      ));
      if (dupes.length > 0) {
        const list = dupes.map(d => `${d.company} - ${d.position}`).join('\n');
        if (!confirm(`Found ${dupes.length} duplicates:\n${list}\n\nImport anyway?`)) return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('applications')
        .insert(data.map(a => ({ ...a, user_id: user.id })));
      if (error) { alert('Import failed'); return; }
      announce(`Imported ${data.length} applications`);
      await loadApplications();
    } catch (e) {
      console.error(e); alert('CSV processing failed');
    } finally { setIsSyncing(false); }
  };

  // --------------------------------------------------------------------------
  // Smart search (kept + augmented)
  // --------------------------------------------------------------------------
  const parseSearchQuery = (raw) => {
    const q = (raw || '').toLowerCase().trim();
    const tokens = { status: null, dateRange: null, text: [] };
    if (!q) return tokens;
    let remaining = q;
    const statusRe = /status:(\w+)/g;
    let m;
    while ((m = statusRe.exec(q)) !== null) tokens.status = m[1];
    remaining = remaining.replace(statusRe, ' ');
    const phrases = ['last 30 days','last 7 days','this week','last week','this month','last month','yesterday','today'];
    for (const p of phrases) {
      if (remaining.includes(p)) { tokens.dateRange = p; remaining = remaining.replace(p,' '); break; }
    }
    tokens.text = remaining.split(/\s+/).map(s => s.trim()).filter(Boolean);
    return tokens;
  };

  const getDateRangeBounds = (phrase) => {
    if (!phrase) return null;
    const now = new Date();
    const sod = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
    const eod = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
    const map = {
      'today': () => ({ from: sod(now), to: eod(now) }),
      'yesterday': () => { const y = new Date(now); y.setDate(y.getDate()-1); return { from: sod(y), to: eod(y) }; },
      'this week': () => { const d = (now.getDay()+6)%7; const f = new Date(now); f.setDate(now.getDate()-d); return { from: sod(f), to: eod(now) }; },
      'last week': () => {
        const d = (now.getDay()+6)%7;
        const tm = new Date(now); tm.setDate(now.getDate()-d);
        const lm = new Date(tm); lm.setDate(tm.getDate()-7);
        const ls = new Date(tm); ls.setDate(tm.getDate()-1);
        return { from: sod(lm), to: eod(ls) };
      },
      'this month': () => ({ from: sod(new Date(now.getFullYear(), now.getMonth(), 1)), to: eod(now) }),
      'last month': () => ({
        from: sod(new Date(now.getFullYear(), now.getMonth()-1, 1)),
        to: eod(new Date(now.getFullYear(), now.getMonth(), 0)),
      }),
      'last 7 days': () => { const f = new Date(now); f.setDate(now.getDate()-7); return { from: sod(f), to: eod(now) }; },
      'last 30 days': () => { const f = new Date(now); f.setDate(now.getDate()-30); return { from: sod(f), to: eod(now) }; },
    };
    return map[phrase]?.() ?? null;
  };

  const matchesSearch = (app, parsed) => {
    if (parsed.status && app.status !== parsed.status) return false;
    if (parsed.dateRange) {
      const b = getDateRangeBounds(parsed.dateRange);
      if (!b || !app.date_applied) return false;
      const d = new Date(app.date_applied);
      if (d < b.from || d > b.to) return false;
    }
    if (parsed.text.length > 0) {
      const hay = [app.company, app.position, app.notes, app.contact_person, app.job_posting_url]
        .filter(Boolean).join(' ').toLowerCase();
      for (const w of parsed.text) if (!hay.includes(w)) return false;
    }
    return true;
  };

  // --------------------------------------------------------------------------
  // Activity timeline
  // --------------------------------------------------------------------------
  const openTimeline = async (app) => {
    setTimelineFor(app);
    const { data, error } = await supabase
      .from('application_events').select('*')
      .eq('application_id', app.id).order('created_at', { ascending: false });
    if (error) { console.error(error); setTimelineEvents([]); return; }
    setTimelineEvents(data || []);
  };

  // --------------------------------------------------------------------------
  // Loading / login screens
  // --------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient flex items-center justify-center">
        <p className="text-slate-400" role="status" aria-live="polite">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-container bg-gradient" data-theme={theme}>
        <SkipLink />
        <div className="fixed inset-0 opacity-5 pointer-events-none grid-bg" aria-hidden="true"></div>
        <main id="main-content" className="auth-card">
          <header className="auth-header">
            <h1 className="auth-title" style={{ fontSize: '1.2rem' }}>Forge</h1>
            <p className="auth-subtitle">Track your job applications with style</p>
          </header>
          {!resetMode ? (
            <>
              <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
                <button
                  role="tab" aria-selected={authMode === 'login'}
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}>Login</button>
                <button
                  role="tab" aria-selected={authMode === 'signup'}
                  onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                  className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}>Sign Up</button>
              </div>
              <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="auth-form" noValidate>
                <div className="auth-form-group">
                  <label className="auth-label" htmlFor="auth-email">Email</label>
                  <input id="auth-email" type="email" autoComplete="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com" className="auth-input" />
                </div>
                <div className="auth-form-group">
                  <label className="auth-label" htmlFor="auth-password">Password</label>
                  <input id="auth-password" type="password" required
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" className="auth-input" />
                </div>
                {authError && (
                  <div className="auth-error" role="alert">
                    <span aria-hidden="true">⚠️</span><p>{authError}</p>
                  </div>
                )}
                <button type="submit" className="auth-submit">
                  {authMode === 'login' ? 'Login' : 'Sign Up'}
                </button>
                {authMode === 'login' && (
                  <div className="auth-forgot">
                    <button type="button" onClick={() => { setResetMode(true); setAuthError(''); }} className="auth-forgot-link">
                      Forgot Password?
                    </button>
                  </div>
                )}
              </form>
            </>
          ) : (
            <form onSubmit={handlePasswordReset} className="auth-form">
              <div className="auth-form-group">
                <label className="auth-label" htmlFor="reset-email">Email</label>
                <input id="reset-email" type="email" required value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="your@email.com" className="auth-input" />
              </div>
              {authError && <div className="auth-error" role="alert"><span aria-hidden="true">⚠️</span><p>{authError}</p></div>}
              {resetSuccess && <div className="auth-success" role="status"><span aria-hidden="true">✓</span><p>Password reset email sent!</p></div>}
              <button type="submit" className="auth-submit">Send Reset Link</button>
              <div className="auth-back">
                <button type="button" onClick={() => { setResetMode(false); setResetEmail(''); setAuthError(''); }} className="auth-back-link">
                  ← Back to Login
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient flex items-center justify-center">
        <p className="text-slate-400" role="status" aria-live="polite">Loading your applications…</p>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Derived data
  // --------------------------------------------------------------------------
  const parsedSearch = parseSearchQuery(searchQuery);
  const filteredApplications = applications
    .filter(a => filterStatus === 'all' ? true : a.status === filterStatus)
    .filter(a => matchesSearch(a, parsedSearch));

  const sortedApplications = [...filteredApplications].sort((a, b) => {
    let cmp = 0;
    if (sortColumn === 'company') cmp = a.company.localeCompare(b.company);
    else if (sortColumn === 'position') cmp = a.position.localeCompare(b.position);
    else if (sortColumn === 'date_applied') cmp = new Date(a.date_applied) - new Date(b.date_applied);
    else if (sortColumn === 'interview_date') {
      cmp = (a.interview_date ? new Date(a.interview_date).getTime() : 0) -
            (b.interview_date ? new Date(b.interview_date).getTime() : 0);
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const handleSort = (column) => {
    if (sortColumn === column) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(column); setSortDirection('asc'); }
  };

  // Upcoming interviews in next 7 days (incl. today)
  const upcomingInterviews = applications
    .filter(a => a.interview_date)
    .map(a => ({ ...a, _d: new Date(a.interview_date) }))
    .filter(a => {
      const now = new Date(); now.setHours(0,0,0,0);
      const max = new Date(now); max.setDate(now.getDate() + 7);
      return a._d >= now && a._d <= max;
    })
    .sort((a, b) => a._d - b._d);

  const stats = {
    total: applications.length,
    applied: applications.filter(a => a.status === 'applied').length,
    interview: applications.filter(a => a.status === 'interview').length,
    offered: applications.filter(a => a.status === 'offered').length,
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient" data-theme={theme}>
      <SkipLink />
      <LiveRegion message={liveMessage || (isSyncing ? 'Syncing…' : '')} />
      <div className="fixed inset-0 opacity-5 pointer-events-none grid-bg" aria-hidden="true"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="header-row mb-4">
            <div className="header-title-group">
              <div className="header-accent" aria-hidden="true"></div>
              <h1 className="text-3xl font-bold text-slate-50" style={{ fontSize: '1.2rem' }}>Forge</h1>
            </div>
            <nav className="header-actions" aria-label="Primary">
              <span className="text-slate-400 text-sm" aria-label={`Signed in as ${user.email}`}>{user.email}</span>
              {[
                { id: 'applications', label: 'Applications' },
                { id: 'analytics',    label: 'Analytics' },
                { id: 'resumes',      label: 'Resumes' },
                { id: 'assembly',     label: 'Assembly' },
                { id: 'leaderboard',  label: 'Leaderboard' },
              ].map(t => (
                <button key={t.id}
                  onClick={() => setCurrentView(t.id)}
                  className={`btn-header-action ${currentView === t.id ? 'active' : ''}`}
                  aria-current={currentView === t.id ? 'page' : undefined}>
                  {t.label}
                </button>
              ))}
              <button onClick={() => setShowOnboarding(true)} className="btn-header-action" aria-label="Show tutorial">
                <HelpCircle size={16} aria-hidden="true" />
              </button>
              <button onClick={() => setShowApiSettings(true)} className="btn-header-action" aria-label="Configure API keys">
                <Settings size={16} aria-hidden="true" />
              </button>
              <button onClick={() => setHighContrast(v => !v)}
                className="btn-header-action"
                aria-pressed={highContrast}
                aria-label={`High contrast mode ${highContrast ? 'on' : 'off'}`}
                title="Toggle high-contrast mode">
                <Contrast size={16} aria-hidden="true" />
              </button>
              <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                className="theme-toggle px-3 py-2 rounded-lg"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
                {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
              </button>
              <button onClick={handleLogout} className="btn-header-action" aria-label="Logout">
                <LogOut size={16} aria-hidden="true" />
              </button>
            </nav>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">Track job applications across your pipeline</p>
            <p className="text-slate-400 text-xs" aria-live="polite">
              {isSyncing ? '● Syncing…' : '● Synced to cloud'}
            </p>
          </div>
        </header>

        <main id="main-content" tabIndex={-1}>
          {/* Conditional Views */}
          {currentView === 'leaderboard' ? (
            <Leaderboard currentUserId={user.id} />
          ) : currentView === 'assembly' ? (
            <ResumeAssembly user={user} />
          ) : currentView === 'resumes' ? (
            <ResumeManager user={user} />
          ) : currentView === 'analytics' ? (
            <AnalyticsView applications={applications} />
          ) : (
            <>
              {/* Stats */}
              <section aria-label="Summary statistics" className="stats-grid">
                <StatCard label="Total" value={stats.total} className="stat-card-total" />
                <StatCard label="Applied" value={stats.applied} className="stat-card-applied" />
                <StatCard label="Interviews" value={stats.interview} className="stat-card-interview" />
                <StatCard label="Offers" value={stats.offered} className="stat-card-offered" />
                {gamificationState && (
                  <div className="stat-card stat-card-total">
                    <p className="stat-label">Rank</p>
                    <p className="stat-value" style={{ fontSize: '1.25rem' }}>{gamificationState.rank}</p>
                    <div className="rank-progress-bar"
                      role="progressbar"
                      aria-valuenow={gamification.getRankProgress(gamificationState.points)}
                      aria-valuemin={0} aria-valuemax={100}
                      aria-label="Rank progress">
                      <div className="rank-progress-fill"
                        style={{ '--progress-width': `${gamification.getRankProgress(gamificationState.points)}%` }} />
                    </div>
                    <p className="text-xs text-slate-400" style={{ marginTop: '0.5rem' }}>
                      {gamificationState.points} pts
                      {gamificationState.streak_days > 0 && (
                        <span className="streak-badge" style={{ marginLeft: '0.5rem' }}>
                          <span aria-hidden="true">🔥</span> {gamificationState.streak_days} day{gamificationState.streak_days !== 1 ? 's' : ''}
                          <VisuallyHidden> daily login streak</VisuallyHidden>
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </section>

              {/* Upcoming interviews */}
              {upcomingInterviews.length > 0 && (
                <aside className="upcoming-banner" role="region" aria-label="Upcoming interviews">
                  <div className="upcoming-banner-icon" aria-hidden="true"><Bell size={18} /></div>
                  <div className="upcoming-banner-body">
                    <strong>{upcomingInterviews.length}</strong> interview{upcomingInterviews.length !== 1 ? 's' : ''} in the next 7 days:
                    <ul className="upcoming-list">
                      {upcomingInterviews.slice(0, 3).map(a => (
                        <li key={a.id}>
                          <button className="link-button" onClick={() => handleEdit(a)}>
                            {a.company} — {a.position}
                          </button>
                          {' '}on <time dateTime={a.interview_date}>{new Date(a.interview_date).toLocaleDateString()}</time>
                        </li>
                      ))}
                    </ul>
                  </div>
                </aside>
              )}

              {/* Smart Search */}
              <div className="smart-search" role="search">
                <Search size={16} aria-hidden="true" style={{ opacity: 0.6, flexShrink: 0 }} />
                <label htmlFor="smart-search-input" className="sr-only">Search applications</label>
                <input id="smart-search-input" type="search"
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='Search… try "google", "status:interview", "last week"'
                  aria-describedby="search-help" />
                <span id="search-help" className="sr-only">
                  Supports free text, status:value filters, and date phrases like "today" or "last week".
                </span>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="btn-icon" aria-label="Clear search">
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Saved searches */}
              <div className="saved-searches" role="group" aria-label="Saved searches">
                {SAVED_SEARCHES.map(p => (
                  <button key={p.label}
                    className={`chip ${searchQuery === p.query ? 'chip-active' : ''}`}
                    onClick={() => setSearchQuery(p.query)}
                    aria-pressed={searchQuery === p.query}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Controls */}
              <div className="controls">
                <button onClick={handleAddNew} className="btn-primary" disabled={isSyncing}>
                  <Plus size={18} aria-hidden="true" /> New Application
                </button>
                <div className="export-buttons">
                  <label className="btn-upload">
                    <Upload size={16} aria-hidden="true" /> Import CSV
                    <VisuallyHidden>(opens file picker)</VisuallyHidden>
                    <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} disabled={isSyncing} />
                  </label>
                  <button onClick={exportToCSV} className="btn-export" disabled={applications.length === 0}>
                    <Download size={16} aria-hidden="true" /> CSV
                  </button>
                  <button onClick={exportToPDF} className="btn-export" disabled={applications.length === 0}>
                    <Download size={16} aria-hidden="true" /> PDF
                  </button>
                </div>

                {/* View toggle */}
                <div className="view-toggle" role="group" aria-label="View mode">
                  <button onClick={() => setTableView('table')}
                    className={`view-btn ${tableView === 'table' ? 'active' : ''}`}
                    aria-pressed={tableView === 'table'} aria-label="Table view">
                    <List size={16} aria-hidden="true" /> Table
                  </button>
                  <button onClick={() => setTableView('kanban')}
                    className={`view-btn ${tableView === 'kanban' ? 'active' : ''}`}
                    aria-pressed={tableView === 'kanban'} aria-label="Kanban view">
                    <LayoutGrid size={16} aria-hidden="true" /> Kanban
                  </button>
                </div>

                <div className="filter-buttons" role="group" aria-label="Filter by status">
                  {['all', ...STATUS_OPTIONS].map(s => (
                    <button key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`filter-btn ${filterStatus === s ? 'active' : ''}`}
                      aria-pressed={filterStatus === s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bulk action bar */}
              {selectedIds.size > 0 && (
                <div className="bulk-bar" role="region" aria-label="Bulk actions">
                  <span><strong>{selectedIds.size}</strong> selected</span>
                  <button className="btn-secondary" onClick={clearSelection}>Clear</button>
                  <label htmlFor="bulk-status" className="sr-only">Bulk status change</label>
                  <select id="bulk-status" defaultValue=""
                    onChange={(e) => { if (e.target.value) { bulkStatus(e.target.value); e.target.value = ''; } }}>
                    <option value="" disabled>Change status to…</option>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button className="btn-danger" onClick={bulkDelete}>
                    <Trash2 size={14} aria-hidden="true" /> Delete selected
                  </button>
                </div>
              )}

              {/* Main content: Table or Kanban */}
              {tableView === 'table' ? (
                <ApplicationsTable
                  applications={sortedApplications}
                  allCount={applications.length}
                  searchQuery={searchQuery}
                  filterStatus={filterStatus}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  selectedIds={selectedIds}
                  toggleSelect={toggleSelect}
                  selectAllVisible={selectAllVisible}
                  clearSelection={clearSelection}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onTimeline={openTimeline}
                  isSyncing={isSyncing}
                />
              ) : (
                <KanbanBoard
                  applications={filteredApplications}
                  onEdit={handleEdit}
                  onChangeStatus={async (app, newStatus) => {
                    if (app.status === newStatus) return;
                    setIsSyncing(true);
                    try {
                      await supabase.from('applications').update({ status: newStatus }).eq('id', app.id);
                      await logEvent(app.id, {
                        event_type: 'status_change', from_status: app.status, to_status: newStatus,
                        message: `Moved to ${newStatus}`,
                      });
                      announce(`${app.company} moved to ${newStatus}`);
                      await loadApplications();
                    } finally { setIsSyncing(false); }
                  }}
                />
              )}

              {sortedApplications.length > 0 && (
                <p className="footer">
                  Showing {sortedApplications.length} of {applications.length} applications
                </p>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={handleCancel}>
          <div ref={modalRef}
            className="modal"
            role="dialog" aria-modal="true" aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="modal-title" className="modal-title">
                {editingId ? 'Edit Application' : 'New Application'}
              </h2>
              <button onClick={handleCancel} className="modal-close" aria-label="Close dialog">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="modal-body">
              <FormField id="f-company" label="Company" required>
                <input id="f-company" type="text" required value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g., Acme Corp" />
              </FormField>
              <FormField id="f-position" label="Position" required>
                <input id="f-position" type="text" required value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="e.g., Senior Engineer" />
              </FormField>
              <FormField id="f-applied" label="Date Applied">
                <input id="f-applied" type="date" value={formData.date_applied}
                  onChange={(e) => setFormData({ ...formData, date_applied: e.target.value })} />
              </FormField>
              <FormField id="f-interview" label="Interview Date">
                <input id="f-interview" type="date" value={formData.interview_date || ''}
                  onChange={(e) => setFormData({ ...formData, interview_date: e.target.value })} />
              </FormField>
              <FormField id="f-url" label="Job Posting URL">
                <input id="f-url" type="url" value={formData.job_posting_url || ''}
                  onChange={(e) => setFormData({ ...formData, job_posting_url: e.target.value })}
                  placeholder="https://company.com/careers/job-id" />
              </FormField>
              <FormField id="f-contact" label="Contact Person">
                <input id="f-contact" type="text" value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="e.g., John Doe, Hiring Manager" />
              </FormField>
              <FormField id="f-status" label="Status">
                <select id="f-status" value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </FormField>
              <FormField id="f-resume" label="Resume Version">
                <select id="f-resume" value={formData.resume_version_id || ''}
                  onChange={(e) => setFormData({ ...formData, resume_version_id: e.target.value || null })}>
                  <option value="">No resume linked</option>
                  {resumeVersions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </FormField>
              <AttachmentsField
                attachments={formData.attachments}
                onChange={(atts) => setFormData({ ...formData, attachments: atts })}
              />
              <FormField id="f-notes" label="Notes">
                <textarea id="f-notes" rows={4} value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Follow-up info, recruiter notes, etc." />
              </FormField>
            </div>

            <div className="modal-footer">
              <button onClick={handleCancel} className="btn-cancel" disabled={isSyncing}>Cancel</button>
              <button onClick={handleSave} className="btn-save" disabled={isSyncing}>
                <Check size={18} aria-hidden="true" /> {isSyncing ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline modal */}
      {timelineFor && (
        <TimelineModal
          application={timelineFor}
          events={timelineEvents}
          onClose={() => { setTimelineFor(null); setTimelineEvents([]); }}
        />
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

      {showOnboarding && <OnboardingTutorial onComplete={() => setShowOnboarding(false)} />}
      {showApiSettings && <ApiKeySettings isOpen={showApiSettings} onClose={() => setShowApiSettings(false)} />}
      {activeCelebration && <CelebrationAnimation milestone={activeCelebration} onComplete={() => setActiveCelebration(null)} />}
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

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({ label, value, className = '' }) {
  return (
    <div className={`stat-card ${className}`}>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
    </div>
  );
}

function FormField({ id, label, required, children }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>
        {label}{required && <span aria-hidden="true"> *</span>}
        {required && <VisuallyHidden> required</VisuallyHidden>}
      </label>
      {children}
    </div>
  );
}

function AttachmentsField({ attachments, onChange }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('resume');

  const add = () => {
    if (!name.trim() || !url.trim()) return;
    onChange([...(attachments || []), { name: name.trim(), url: url.trim(), type }]);
    setName(''); setUrl(''); setType('resume');
  };

  const remove = (i) => onChange(attachments.filter((_, idx) => idx !== i));

  return (
    <fieldset className="form-group attachments-field">
      <legend><Paperclip size={14} aria-hidden="true" /> Attachments</legend>
      {attachments?.length > 0 && (
        <ul className="attachment-list">
          {attachments.map((a, i) => (
            <li key={i}>
              <a href={a.url} target="_blank" rel="noopener noreferrer">
                {a.name} <VisuallyHidden>({a.type}, opens in new tab)</VisuallyHidden>
              </a>
              <span className="attachment-type">{a.type}</span>
              <button type="button" onClick={() => remove(i)} className="btn-icon" aria-label={`Remove ${a.name}`}>
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="attachment-add">
        <input type="text" placeholder="Label (e.g. Resume v3)" value={name}
          onChange={(e) => setName(e.target.value)} aria-label="Attachment label" />
        <input type="url" placeholder="https://…" value={url}
          onChange={(e) => setUrl(e.target.value)} aria-label="Attachment URL" />
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Attachment type">
          <option value="resume">Resume</option>
          <option value="cover_letter">Cover letter</option>
          <option value="other">Other</option>
        </select>
        <button type="button" onClick={add} className="btn-secondary">Add</button>
      </div>
    </fieldset>
  );
}

function SortableHeader({ label, column, sortColumn, sortDirection, onSort }) {
  const active = sortColumn === column;
  const ariaSort = active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th aria-sort={ariaSort} scope="col">
      <button type="button" onClick={() => onSort(column)} className="th-button">
        {label}
        <span aria-hidden="true">{active ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}</span>
      </button>
    </th>
  );
}

function ApplicationsTable({
  applications, allCount, searchQuery, filterStatus,
  sortColumn, sortDirection, onSort,
  selectedIds, toggleSelect, selectAllVisible, clearSelection,
  onEdit, onDelete, onTimeline, isSyncing,
}) {
  const allVisibleSelected = applications.length > 0 && applications.every(a => selectedIds.has(a.id));

  return (
    <div className="table-wrapper">
      {/* Mobile cards */}
      <div className="mobile-cards" aria-label="Applications (mobile view)">
        {applications.length === 0 ? (
          <p className="empty-state">No applications match.</p>
        ) : applications.map(a => (
          <article key={a.id} className="app-card">
            <header className="app-card-header">
              <h3>{a.company}</h3>
              <StatusBadge status={a.status} />
            </header>
            <p className="app-card-position">{a.position}</p>
            <dl className="app-card-meta">
              <div><dt>Applied</dt><dd>{a.date_applied ? new Date(a.date_applied).toLocaleDateString() : '—'}</dd></div>
              <div><dt>Interview</dt><dd>{a.interview_date ? new Date(a.interview_date).toLocaleDateString() : '—'}</dd></div>
            </dl>
            <div className="action-buttons">
              <button onClick={() => onEdit(a)} className="btn-icon" aria-label={`Edit ${a.company}`}><Edit2 size={16} aria-hidden="true" /></button>
              <button onClick={() => onTimeline(a)} className="btn-icon" aria-label={`View timeline for ${a.company}`}><Clock size={16} aria-hidden="true" /></button>
              <button onClick={() => onDelete(a.id)} className="btn-icon delete" aria-label={`Delete ${a.company}`}><Trash2 size={16} aria-hidden="true" /></button>
            </div>
          </article>
        ))}
      </div>

      {/* Desktop table */}
      <table className="desktop-table">
        <caption className="sr-only">Job applications, sortable.</caption>
        <thead>
          <tr>
            <th scope="col">
              <input type="checkbox"
                aria-label={allVisibleSelected ? 'Deselect all visible' : 'Select all visible'}
                checked={allVisibleSelected}
                onChange={(e) => e.target.checked
                  ? selectAllVisible(applications.map(a => a.id))
                  : clearSelection()
                } />
            </th>
            <SortableHeader label="Company" column="company" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Position" column="position" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Applied" column="date_applied" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Interview" column="interview_date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            <th scope="col">Contact</th>
            <th scope="col">Status</th>
            <th scope="col">Link</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.length === 0 ? (
            <tr>
              <td colSpan="9" className="empty-state">
                {searchQuery
                  ? 'No applications match your search.'
                  : filterStatus !== 'all'
                    ? `No ${filterStatus} applications found.`
                    : 'No applications yet. Click "New Application" to start.'}
              </td>
            </tr>
          ) : applications.map(a => (
            <tr key={a.id} aria-selected={selectedIds.has(a.id)}>
              <td>
                <input type="checkbox"
                  aria-label={`Select ${a.company} ${a.position}`}
                  checked={selectedIds.has(a.id)}
                  onChange={() => toggleSelect(a.id)} />
              </td>
              <td className="company-name">{a.company}</td>
              <td className="position-name">{a.position}</td>
              <td className="date">{a.date_applied ? new Date(a.date_applied).toLocaleDateString() : '—'}</td>
              <td className="date">{a.interview_date ? new Date(a.interview_date).toLocaleDateString() : '—'}</td>
              <td className="contact">{a.contact_person || '—'}</td>
              <td><StatusBadge status={a.status} /></td>
              <td>
                {a.job_posting_url ? (
                  <a href={a.job_posting_url} target="_blank" rel="noopener noreferrer"
                    className="btn-icon" aria-label={`Open job posting for ${a.company} (opens in new tab)`}>
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                ) : <span aria-hidden="true" style={{ opacity: 0.4 }}>—</span>}
              </td>
              <td>
                <div className="action-buttons">
                  <button onClick={() => onEdit(a)} className="btn-icon" disabled={isSyncing}
                    aria-label={`Edit ${a.company}`}><Edit2 size={16} aria-hidden="true" /></button>
                  <button onClick={() => onTimeline(a)} className="btn-icon" disabled={isSyncing}
                    aria-label={`View timeline for ${a.company}`}><Clock size={16} aria-hidden="true" /></button>
                  <button onClick={() => onDelete(a.id)} className="btn-icon delete" disabled={isSyncing}
                    aria-label={`Delete ${a.company}`}><Trash2 size={16} aria-hidden="true" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || STATUS_BADGE.applied;
  return (
    <span className={cfg.className}>
      <span aria-hidden="true">{cfg.symbol} </span>{cfg.label}
    </span>
  );
}

function KanbanBoard({ applications, onEdit, onChangeStatus }) {
  const columns = STATUS_OPTIONS;
  const [dragId, setDragId] = useState(null);

  return (
    <div className="kanban-board" role="region" aria-label="Kanban board">
      {columns.map(col => {
        const cards = applications.filter(a => a.status === col);
        return (
          <div key={col} className="kanban-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!dragId) return;
              const app = applications.find(a => a.id === dragId);
              if (app) onChangeStatus(app, col);
              setDragId(null);
            }}
            aria-label={`${col} column, ${cards.length} cards`}>
            <h3 className="kanban-col-title">
              <StatusBadge status={col} />
              <span className="kanban-count" aria-label={`${cards.length} cards`}>{cards.length}</span>
            </h3>
            <div className="kanban-col-body">
              {cards.length === 0 ? <p className="kanban-empty">No cards</p> :
                cards.map(a => (
                  <article key={a.id} className="kanban-card"
                    draggable onDragStart={() => setDragId(a.id)}
                    tabIndex={0} role="button"
                    onClick={() => onEdit(a)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(a); } }}
                    aria-label={`${a.company}, ${a.position}. Press Enter to edit.`}>
                    <strong>{a.company}</strong>
                    <span>{a.position}</span>
                    {a.interview_date && (
                      <small><Bell size={12} aria-hidden="true" /> {new Date(a.interview_date).toLocaleDateString()}</small>
                    )}
                    {/* Keyboard alternative to drag for a11y */}
                    <label className="sr-only" htmlFor={`move-${a.id}`}>Move {a.company} to status</label>
                    <select id={`move-${a.id}`} className="kanban-move" defaultValue=""
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { if (e.target.value) { onChangeStatus(a, e.target.value); e.target.value=''; } }}>
                      <option value="" disabled>Move to…</option>
                      {STATUS_OPTIONS.filter(s => s !== col).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </article>
                ))
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsView({ applications }) {
  const total = applications.length;
  const byStatus = STATUS_OPTIONS.map(s => ({
    status: s, count: applications.filter(a => a.status === s).length,
  }));
  const responses = applications.filter(a => ['interview','offered','accepted','rejected'].includes(a.status)).length;
  const responseRate = total ? Math.round((responses / total) * 100) : 0;

  // apps per week (last 8 weeks)
  const now = new Date();
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = new Date(now); end.setDate(now.getDate() - i * 7); end.setHours(23,59,59,999);
    const start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0,0,0,0);
    const count = applications.filter(a => {
      if (!a.date_applied) return false;
      const d = new Date(a.date_applied);
      return d >= start && d <= end;
    }).length;
    return { label: `${start.getMonth()+1}/${start.getDate()}`, count };
  }).reverse();

  const maxWeek = Math.max(1, ...weeks.map(w => w.count));
  const maxStatus = Math.max(1, ...byStatus.map(b => b.count));

  // Avg time to interview (days)
  const interviewApps = applications.filter(a => a.date_applied && a.interview_date);
  const avgDaysToInterview = interviewApps.length === 0 ? null
    : Math.round(interviewApps.reduce((acc, a) => {
        return acc + (new Date(a.interview_date) - new Date(a.date_applied)) / (1000*60*60*24);
      }, 0) / interviewApps.length);

  return (
    <section aria-label="Analytics" className="analytics">
      <h2><BarChart3 size={20} aria-hidden="true" /> Analytics</h2>
      <div className="analytics-grid">
        <div className="analytics-card">
          <p className="stat-label">Total Applications</p>
          <p className="stat-value">{total}</p>
        </div>
        <div className="analytics-card">
          <p className="stat-label">Response Rate</p>
          <p className="stat-value">{responseRate}%</p>
          <p className="stat-sub">{responses} responses of {total}</p>
        </div>
        <div className="analytics-card">
          <p className="stat-label">Avg. days to interview</p>
          <p className="stat-value">{avgDaysToInterview ?? '—'}</p>
        </div>
      </div>

      <h3>Applications per week</h3>
      <div className="bar-chart" role="img"
        aria-label={`Bar chart: applications per week. ${weeks.map(w => `${w.label}: ${w.count}`).join(', ')}.`}>
        {weeks.map((w, i) => (
          <div key={i} className="bar-col">
            <div className="bar" style={{ height: `${(w.count / maxWeek) * 100}%` }} aria-hidden="true">
              <span className="bar-value">{w.count}</span>
            </div>
            <span className="bar-label">{w.label}</span>
          </div>
        ))}
      </div>

      <h3>Status distribution</h3>
      <ul className="status-dist" aria-label="Status distribution">
        {byStatus.map(b => (
          <li key={b.status}>
            <span className="status-dist-label"><StatusBadge status={b.status} /></span>
            <span className="status-dist-bar" aria-hidden="true">
              <span style={{ width: `${(b.count / maxStatus) * 100}%` }} />
            </span>
            <span className="status-dist-count">{b.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TimelineModal({ application, events, onClose }) {
  const ref = useRef(null);
  useFocusTrap(ref, true, onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true"
        aria-labelledby="timeline-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="timeline-title" className="modal-title">
            <Clock size={18} aria-hidden="true" /> Timeline — {application.company}
          </h2>
          <button onClick={onClose} className="modal-close" aria-label="Close timeline">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">
          {events.length === 0 ? (
            <p>No activity yet.</p>
          ) : (
            <ol className="timeline">
              {events.map(e => (
                <li key={e.id} className="timeline-item">
                  <time dateTime={e.created_at}>{new Date(e.created_at).toLocaleString()}</time>
                  <p>{e.message || e.event_type}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

// HTML escape helper for PDF export
function esc(str) {
  return (str ?? '').toString()
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
