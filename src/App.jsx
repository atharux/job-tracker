// ============================================================================
// REQUIRED SUPABASE MIGRATION — ALREADY run deploying:
//
//   ALTER TABLE applications
//     ADD COLUMN IF NOT EXISTS interview_date date,
//     ADD COLUMN IF NOT EXISTS job_posting_url text;
//
// New features in this version:
//  1. `interview_date` column + form field + table column
//  2. `job_posting_url` column + form field + table icon link (opens in new tab)
//  3. Smart search bar above the applications table:
//       - free text matches company / position / notes / contact_person
//       - `status:interview` (or applied/offered/rejected/accepted) filters by status
//       - date phrases: "today", "yesterday", "this week", "last week",
//         "this month", "last month", "last 7 days", "last 30 days"
//       - tokens combine with AND (all must match)
//  4. CSV import/export updated to include the two new columns
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trash2, Plus, Edit2, X, Check, Download, LogOut, Upload,
  FileText, HelpCircle, Settings, Search, ExternalLink,
  LayoutGrid, List, BarChart3, Clock, Paperclip, Bell, Contrast
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
import './accessibility.css';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const STATUS_OPTIONS = ['applied', 'interview', 'offered', 'rejected', 'accepted'];

const STATUS_BADGE = {
  applied:   { className: 'badge badge-applied',   label: 'Applied',   symbol: '●' },
  interview: { className: 'badge badge-interview', label: 'Interview', symbol: '◆' },
  offered:   { className: 'badge badge-offered',   label: 'Offered',   symbol: '★' },
  rejected:  { className: 'badge badge-rejected',  label: 'Rejected',  symbol: '✕' },
  accepted:  { className: 'badge badge-accepted',  label: 'Accepted',  symbol: '✓' },
};

const SAVED_SEARCHES = [
  { label: "This week's interviews", query: 'status:interview this week' },
  { label: 'Pending follow-ups',     query: 'status:applied last 30 days' },
  { label: 'Recent offers',          query: 'status:offered last month' },
  { label: 'This month',             query: 'this month' },
];

// ----------------------------------------------------------------------------
// A11y helpers
// ----------------------------------------------------------------------------
const SkipLink = () => (
  <a href="#main-content" className="skip-link">Skip to main content</a>
);

const VisuallyHidden = ({ children }) => (
  <span className="sr-only">{children}</span>
);

const LiveRegion = ({ message }) => (
  <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{message}</div>
);

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
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, ref, onClose]);
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || STATUS_BADGE.applied;
  return (
    <span className={cfg.className}>
      <span aria-hidden="true">{cfg.symbol} </span>{cfg.label}
    </span>
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
                {a.name} <span className="sr-only">({a.type}, opens in new tab)</span>
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

function KanbanBoard({ applications, onEdit, onChangeStatus }) {
  const [dragId, setDragId] = useState(null);
  return (
    <div className="kanban-board" role="region" aria-label="Kanban board">
      {STATUS_OPTIONS.map(col => {
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
              <span className="kanban-count">{cards.length}</span>
            </h3>
            <div className="kanban-col-body">
              {cards.length === 0
                ? <p className="kanban-empty">No cards</p>
                : cards.map(a => (
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
                    <label className="sr-only" htmlFor={`move-${a.id}`}>Move {a.company} to status</label>
                    <select id={`move-${a.id}`} className="kanban-move" defaultValue=""
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { if (e.target.value) { onChangeStatus(a, e.target.value); e.target.value = ''; } }}>
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
  const interviewApps = applications.filter(a => a.date_applied && a.interview_date);
  const avgDaysToInterview = interviewApps.length === 0 ? null
    : Math.round(interviewApps.reduce((acc, a) =>
        acc + (new Date(a.interview_date) - new Date(a.date_applied)) / (1000*60*60*24), 0
      ) / interviewApps.length);
  return (
    <section aria-label="Analytics" className="analytics">
      <h2><BarChart3 size={20} aria-hidden="true" /> Analytics</h2>
      <div className="analytics-grid">
        <div className="analytics-card"><p className="stat-label">Total Applications</p><p className="stat-value">{total}</p></div>
        <div className="analytics-card"><p className="stat-label">Response Rate</p><p className="stat-value">{responseRate}%</p><p className="stat-sub">{responses} of {total}</p></div>
        <div className="analytics-card"><p className="stat-label">Avg. days to interview</p><p className="stat-value">{avgDaysToInterview ?? '—'}</p></div>
      </div>
      <h3>Applications per week</h3>
      <div className="bar-chart" role="img" aria-label={`Applications per week: ${weeks.map(w => `${w.label}: ${w.count}`).join(', ')}`}>
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
            <span className="status-dist-bar" aria-hidden="true"><span style={{ width: `${(b.count / maxStatus) * 100}%` }} /></span>
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
          <button onClick={onClose} className="modal-close" aria-label="Close timeline"><X size={20} /></button>
        </div>
        <div className="modal-body">
          {events.length === 0
            ? <p>No activity recorded yet.</p>
            : <ol className="timeline">
                {events.map(e => (
                  <li key={e.id} className="timeline-item">
                    <time dateTime={e.created_at}>{new Date(e.created_at).toLocaleString()}</time>
                    <p>{e.message || e.event_type}</p>
                  </li>
                ))}
              </ol>
          }
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [theme, setTheme] = useState('dark');

  const [applications, setApplications] = useState([]);
  const [resumeVersions, setResumeVersions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState(''); // NEW
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [formData, setFormData] = useState({
    company: '',
    position: '',
    date_applied: '',
    contact_person: '',
    status: 'applied',
    notes: '',
    resume_version_id: null,
    interview_date: '',     // NEW
    job_posting_url: ''     // NEW
  });

  const [gamificationState, setGamificationState] = useState(null);

  const [activeMilestone, setActiveMilestone] = useState(null);
  const [milestoneQueue, setMilestoneQueue] = useState([]);
  const [activeCelebration, setActiveCelebration] = useState(null);
  const [statusCelebration, setStatusCelebration] = useState(null);
  const [currentView, setCurrentView] = useState('applications');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [sortColumn, setSortColumn] = useState('date_applied');
  const [sortDirection, setSortDirection] = useState('desc');
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('forge.hc') === '1');
  const [tableView, setTableView] = useState(() => localStorage.getItem('forge.view') || 'table');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [timelineFor, setTimelineFor] = useState(null);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [liveMessage, setLiveMessage] = useState('');
  const modalRef = useRef(null);
  useFocusTrap(modalRef, isModalOpen, () => handleCancel());

  useEffect(() => {
    document.documentElement.classList.toggle('hc-mode', highContrast);
    localStorage.setItem('forge.hc', highContrast ? '1' : '0');
  }, [highContrast]);

  useEffect(() => { localStorage.setItem('forge.view', tableView); }, [tableView]);

  const announce = useCallback((msg) => {
    setLiveMessage(msg);
    setTimeout(() => setLiveMessage(''), 2000);
  }, []);

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
    points += applications.length * 10;
    const interviews = applications.filter(a =>
      a.status === 'interview' || a.status === 'offered' || a.status === 'accepted'
    ).length;
    points += interviews * 25;
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

      const { data: apps, error: appsError } = await supabase
        .from('applications')
        .select('*');

      if (appsError) {
        console.error('Failed to load applications for gamification:', appsError);
        return;
      }

      const applications = apps || [];

      const retroPoints = calculateRetroactivePoints(applications);
      const retroRank = gamification.calculateRank(retroPoints);

      const { data, error } = await supabase
        .from('gamification_state')
        .select('*')
        .eq('user_id', user.id)
        .single();

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
        setShowOnboarding(true);

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

      const isDailyLogin = gamification.checkDailyLogin(data.last_login_date);

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

  const openTimeline = async (app) => {
    setTimelineFor(app);
    const { data, error } = await supabase
      .from('application_events').select('*')
      .eq('application_id', app.id).order('created_at', { ascending: false });
    setTimelineEvents(error ? [] : (data || []));
  };

  const handleAddNew = () => {
    setFormData({
      company: '',
      position: '',
      date_applied: new Date().toISOString().split('T')[0],
      contact_person: '',
      status: 'applied',
      notes: '',
      resume_version_id: null,
      interview_date: '',
      job_posting_url: '',
      attachments: []
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
      resume_version_id: app.resume_version_id,
      interview_date: app.interview_date || '',
      job_posting_url: app.job_posting_url || '',
      attachments: app.attachments || []
    });
    setEditingId(app.id);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.company.trim() || !formData.position.trim()) {
      alert('Company and position are required');
      return;
    }

    // Normalize empty date strings to null so Postgres accepts them
    const payload = {
      ...formData,
      interview_date: formData.interview_date ? formData.interview_date : null,
      job_posting_url: formData.job_posting_url ? formData.job_posting_url.trim() : null,
      attachments: formData.attachments || []
    };

    const oldStatus = editingId
      ? applications.find(a => a.id === editingId)?.status
      : null;

    setIsSyncing(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('applications')
          .update(payload)
          .eq('id', editingId);

        if (error) {
          console.error('Update error:', error);
          alert('Failed to update application');
          return;
        }
        if (oldStatus !== formData.status) {
          await logEvent(editingId, { event_type: 'status_change', from_status: oldStatus, to_status: formData.status, message: `Status changed from ${oldStatus} to ${formData.status}` });
        } else {
          await logEvent(editingId, { event_type: 'edit', message: 'Application edited' });
        }
      } else {
        const { data: { user } } = await supabase.auth.getUser();

        const { data: inserted, error } = await supabase
          .from('applications')
          .insert([{ ...payload, user_id: user.id }])
          .select()
          .single();

        if (error) {
          console.error('Insert error:', error);
          alert('Failed to save application');
          return;
        }
        if (inserted) {
          await logEvent(inserted.id, { event_type: 'created', to_status: payload.status, message: `Application created for ${payload.company} — ${payload.position}` });
        }
      }
      setIsModalOpen(false);
      await loadApplications();

      if (editingId && oldStatus !== formData.status) {
        if (formData.status === 'rejected') {
          setStatusCelebration({ emoji: '🦋', type: 'rejected' });
        } else if (formData.status === 'interview') {
          setStatusCelebration({ emoji: '🐲', type: 'interview' });
        }
      }

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
    const headers = [
      'Company', 'Position', 'Date Applied', 'Contact Person',
      'Status', 'Interview Date', 'Job Posting URL', 'Notes'
    ];
    const rows = applications.map(app => [
      app.company,
      app.position,
      app.date_applied,
      app.contact_person,
      app.status,
      app.interview_date || '',
      app.job_posting_url || '',
      app.notes
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell ?? '').toString().replace(/"/g, '""')}"`).join(','))
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
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th { background-color: #f0f0f0; border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold; }
            td { border: 1px solid #ddd; padding: 8px; word-break: break-word; }
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
                <th>Interview Date</th>
                <th>Contact Person</th>
                <th>Status</th>
                <th>Job Link</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${applications.map(app => `
                <tr>
                  <td>${app.company || ''}</td>
                  <td>${app.position || ''}</td>
                  <td>${app.date_applied ? new Date(app.date_applied).toLocaleDateString('de-DE') : '—'}</td>
                  <td>${app.interview_date ? new Date(app.interview_date).toLocaleDateString('de-DE') : '—'}</td>
                  <td>${app.contact_person || '—'}</td>
                  <td>${app.status || ''}</td>
                  <td>${app.job_posting_url ? `<a href="${app.job_posting_url}">${app.job_posting_url}</a>` : '—'}</td>
                  <td>${app.notes || ''}</td>
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
        notes: row.notes || '',
        interview_date: row.interview_date || null,
        job_posting_url: row.job_posting_url || null
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

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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
      await Promise.all(ids.map(id => {
        const old = applications.find(a => a.id === id)?.status;
        return logEvent(id, { event_type: 'status_change', from_status: old, to_status: status, message: `Bulk status change to ${status}` });
      }));
      announce(`${ids.length} applications updated to ${status}`);
      clearSelection();
      await loadApplications();
    } finally { setIsSyncing(false); }
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

      // Award gamification points for each CSV-imported application
      if (gamificationState) {
        for (let i = 0; i < validatedData.length; i++) {
          await applyGamification('create_application', {});
        }
      } else {
        // User may not have a gamification_state row yet — create it now
        await loadGamificationState();
      }
    } catch (error) {
      console.error('CSV processing error:', error);
      alert('Failed to process CSV file. Please check the format.');
    } finally {
      setIsSyncing(false);
    }
  };

  // ==========================================================================
  // SMART SEARCH
  // ==========================================================================
  // Parses a query string into tokens. Supports:
  //   status:<value>             -> filters by status
  //   today | yesterday          -> date_applied date filter
  //   "this week" | "last week"  -> date_applied range filter
  //   "this month" | "last month"
  //   "last 7 days" | "last 30 days"
  //   any remaining words        -> free-text AND search across
  //                                 company, position, notes, contact_person
  // ==========================================================================
  const parseSearchQuery = (raw) => {
    const q = (raw || '').toLowerCase().trim();
    const tokens = { status: null, dateRange: null, text: [] };
    if (!q) return tokens;

    let remaining = q;

    // status:<value>
    const statusRe = /status:(\w+)/g;
    let m;
    while ((m = statusRe.exec(q)) !== null) {
      tokens.status = m[1];
    }
    remaining = remaining.replace(statusRe, ' ');

    // Date phrases (longest first to avoid sub-match issues)
    const datePhrases = [
      'last 30 days', 'last 7 days',
      'this week', 'last week',
      'this month', 'last month',
      'yesterday', 'today'
    ];
    for (const phrase of datePhrases) {
      if (remaining.includes(phrase)) {
        tokens.dateRange = phrase;
        remaining = remaining.replace(phrase, ' ');
        break; // only one date filter
      }
    }

    tokens.text = remaining.split(/\s+/).map(s => s.trim()).filter(Boolean);
    return tokens;
  };

  const getDateRangeBounds = (phrase) => {
    if (!phrase) return null;
    const now = new Date();
    const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

    if (phrase === 'today') {
      return { from: startOfDay(now), to: endOfDay(now) };
    }
    if (phrase === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    if (phrase === 'this week') {
      // Monday as start of week
      const day = (now.getDay() + 6) % 7; // 0=Mon ... 6=Sun
      const from = new Date(now); from.setDate(now.getDate() - day);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    if (phrase === 'last week') {
      const day = (now.getDay() + 6) % 7;
      const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - day);
      const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1);
      return { from: startOfDay(lastMonday), to: endOfDay(lastSunday) };
    }
    if (phrase === 'this month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    if (phrase === 'last month') {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(from), to: endOfDay(to) };
    }
    if (phrase === 'last 7 days') {
      const from = new Date(now); from.setDate(now.getDate() - 7);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    if (phrase === 'last 30 days') {
      const from = new Date(now); from.setDate(now.getDate() - 30);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    return null;
  };

  const matchesSearch = (app, parsed) => {
    if (parsed.status && app.status !== parsed.status) return false;

    if (parsed.dateRange) {
      const bounds = getDateRangeBounds(parsed.dateRange);
      if (bounds && app.date_applied) {
        const d = new Date(app.date_applied);
        if (d < bounds.from || d > bounds.to) return false;
      } else if (bounds) {
        return false;
      }
    }

    if (parsed.text.length > 0) {
      const haystack = [
        app.company, app.position, app.notes, app.contact_person, app.job_posting_url
      ].filter(Boolean).join(' ').toLowerCase();
      // AND match: every word must appear
      for (const word of parsed.text) {
        if (!haystack.includes(word)) return false;
      }
    }

    return true;
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
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                >
                  Login
                </button>
                <button
                  onClick={() => { setAuthMode('signup'); setAuthError(''); }}
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
                      onClick={() => { setResetMode(true); setAuthError(''); }}
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

  const parsedSearch = parseSearchQuery(searchQuery);

  // Apply status filter dropdown first, then search
  const filteredApplications = applications
    .filter(app => filterStatus === 'all' ? true : app.status === filterStatus)
    .filter(app => matchesSearch(app, parsedSearch));

  // Sort applications
  const sortedApplications = [...filteredApplications].sort((a, b) => {
    let comparison = 0;

    if (sortColumn === 'company') {
      comparison = a.company.localeCompare(b.company);
    } else if (sortColumn === 'position') {
      comparison = a.position.localeCompare(b.position);
    } else if (sortColumn === 'date_applied') {
      comparison = new Date(a.date_applied) - new Date(b.date_applied);
    } else if (sortColumn === 'interview_date') {
      const av = a.interview_date ? new Date(a.interview_date).getTime() : 0;
      const bv = b.interview_date ? new Date(b.interview_date).getTime() : 0;
      comparison = av - bv;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
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
      <SkipLink />
      <LiveRegion message={liveMessage} />
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
                onClick={() => setCurrentView('analytics')}
                className={`btn-header-action ${currentView === 'analytics' ? 'active' : ''}`}
                title="Analytics dashboard"
              >
                Analytics
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
                onClick={() => setHighContrast(v => !v)}
                className="btn-header-action"
                aria-pressed={highContrast}
                title="Toggle high-contrast mode"
              >
                <Contrast size={16} />
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
        ) : currentView === 'analytics' ? (
          <AnalyticsView applications={applications} />
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

            {/* Upcoming interviews banner */}
            {(() => {
              const now = new Date(); now.setHours(0,0,0,0);
              const max = new Date(now); max.setDate(now.getDate() + 7);
              const upcoming = applications
                .filter(a => a.interview_date)
                .map(a => ({ ...a, _d: new Date(a.interview_date) }))
                .filter(a => a._d >= now && a._d <= max)
                .sort((a,b) => a._d - b._d);
              return upcoming.length > 0 ? (
                <aside className="upcoming-banner" role="region" aria-label="Upcoming interviews">
                  <div className="upcoming-banner-icon" aria-hidden="true"><Bell size={18} /></div>
                  <div>
                    <strong>{upcoming.length}</strong> interview{upcoming.length !== 1 ? 's' : ''} in the next 7 days:
                    <ul className="upcoming-list">
                      {upcoming.slice(0, 3).map(a => (
                        <li key={a.id}>
                          <button className="link-button" onClick={() => handleEdit(a)}>{a.company} — {a.position}</button>
                          {' '}on <time dateTime={a.interview_date}>{new Date(a.interview_date).toLocaleDateString()}</time>
                        </li>
                      ))}
                    </ul>
                  </div>
                </aside>
              ) : null;
            })()}

            {/* Saved searches */}
            <div className="saved-searches" role="group" aria-label="Saved searches">
              {SAVED_SEARCHES.map(p => (
                <button key={p.label}
                  className={`chip ${searchQuery === p.query ? 'chip-active' : ''}`}
                  onClick={() => setSearchQuery(searchQuery === p.query ? '' : p.query)}
                  aria-pressed={searchQuery === p.query}>
                  {p.label}
                </button>
              ))}
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
                  title="Import multiple applications from a CSV file"
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
                <button onClick={exportToCSV} className="btn-export" disabled={applications.length === 0} title="Export to CSV">
                  <Download size={16} /> CSV
                </button>
                <button onClick={exportToPDF} className="btn-export" disabled={applications.length === 0} title="Export to PDF">
                  <Download size={16} /> PDF
                </button>
              </div>

              {/* View toggle */}
              <div className="view-toggle" role="group" aria-label="View mode">
                <button onClick={() => setTableView('table')} className={`view-btn ${tableView === 'table' ? 'active' : ''}`} aria-pressed={tableView === 'table'} aria-label="Table view">
                  <List size={16} aria-hidden="true" /> Table
                </button>
                <button onClick={() => setTableView('kanban')} className={`view-btn ${tableView === 'kanban' ? 'active' : ''}`} aria-pressed={tableView === 'kanban'} aria-label="Kanban view">
                  <LayoutGrid size={16} aria-hidden="true" /> Kanban
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

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="bulk-bar" role="region" aria-label="Bulk actions">
                <span><strong>{selectedIds.size}</strong> selected</span>
                <button className="btn-secondary" onClick={clearSelection}>Clear</button>
                <select defaultValue="" onChange={(e) => { if (e.target.value) { bulkStatus(e.target.value); e.target.value = ''; } }} aria-label="Bulk status change">
                  <option value="" disabled>Change status to…</option>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="btn-danger" onClick={bulkDelete}>
                  <Trash2 size={14} aria-hidden="true" /> Delete selected
                </button>
              </div>
            )}

            {/* Table or Kanban */}
            {tableView === 'kanban' ? (
              <KanbanBoard
                applications={filteredApplications}
                onEdit={handleEdit}
                onChangeStatus={async (app, newStatus) => {
                  if (app.status === newStatus) return;
                  setIsSyncing(true);
                  try {
                    await supabase.from('applications').update({ status: newStatus }).eq('id', app.id);
                    await logEvent(app.id, { event_type: 'status_change', from_status: app.status, to_status: newStatus, message: `Moved to ${newStatus}` });
                    announce(`${app.company} moved to ${newStatus}`);
                    await loadApplications();
                  } finally { setIsSyncing(false); }
                }}
              />
            ) : (
            <div
              className="smart-search"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: '1rem 0',
                padding: '0.5rem 0.75rem',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px'
              }}
            >
              <Search size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search… try "google", "status:interview", "last week", "remote status:applied"'
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'inherit',
                  fontSize: '0.9rem'
                }}
                title={
                  'Smart search supports:\n' +
                  '  • free text (matches company, position, notes, contact, URL)\n' +
                  '  • status:applied | status:interview | status:offered | status:rejected | status:accepted\n' +
                  '  • today, yesterday, this week, last week, this month, last month, last 7 days, last 30 days\n' +
                  '  • combine tokens (all must match)'
                }
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="btn-icon"
                  title="Clear search"
                  style={{ padding: '4px' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Smart Search */}
            <div className="smart-search">
              <Search size={16} style={{ opacity: 0.6, flexShrink: 0 }} aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search… try "google", "status:interview", "last week"'
                aria-label="Search applications"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontSize: '0.9rem' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="btn-icon" aria-label="Clear search" style={{ padding: '4px' }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Applications Table / Kanban */}
            {tableView === 'kanban' ? (
              <KanbanBoard
                applications={filteredApplications}
                onEdit={handleEdit}
                onChangeStatus={async (app, newStatus) => {
                  if (app.status === newStatus) return;
                  setIsSyncing(true);
                  try {
                    await supabase.from('applications').update({ status: newStatus }).eq('id', app.id);
                    await logEvent(app.id, { event_type: 'status_change', from_status: app.status, to_status: newStatus, message: `Moved to ${newStatus}` });
                    announce(`${app.company} moved to ${newStatus}`);
                    await loadApplications();
                  } finally { setIsSyncing(false); }
                }}
              />
            ) : (
            <div className="table-wrapper">
              {/* Mobile cards */}
              <div className="mobile-cards">
                {sortedApplications.length === 0 ? (
                  <p className="empty-state">No applications match.</p>
                ) : sortedApplications.map(app => (
                  <article key={app.id} className="app-card">
                    <header className="app-card-header">
                      <h3>{app.company}</h3>
                      <StatusBadge status={app.status} />
                    </header>
                    <p className="app-card-position">{app.position}</p>
                    <dl className="app-card-meta">
                      <div><dt>Applied</dt><dd>{app.date_applied ? new Date(app.date_applied).toLocaleDateString() : '—'}</dd></div>
                      <div><dt>Interview</dt><dd>{app.interview_date ? new Date(app.interview_date).toLocaleDateString() : '—'}</dd></div>
                    </dl>
                    <div className="action-buttons">
                      <button onClick={() => handleEdit(app)} className="btn-icon" aria-label={`Edit ${app.company}`} disabled={isSyncing}><Edit2 size={16} /></button>
                      <button onClick={() => openTimeline(app)} className="btn-icon" aria-label={`Timeline for ${app.company}`} disabled={isSyncing}><Clock size={16} /></button>
                      <button onClick={() => handleDelete(app.id)} className="btn-icon delete" aria-label={`Delete ${app.company}`} disabled={isSyncing}><Trash2 size={16} /></button>
                    </div>
                  </article>
                ))}
              </div>

              {/* Desktop table */}
              <table className="desktop-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <input type="checkbox"
                        aria-label={sortedApplications.length > 0 && sortedApplications.every(a => selectedIds.has(a.id)) ? 'Deselect all' : 'Select all'}
                        checked={sortedApplications.length > 0 && sortedApplications.every(a => selectedIds.has(a.id))}
                        onChange={(e) => e.target.checked ? selectAllVisible(sortedApplications.map(a => a.id)) : clearSelection()}
                      />
                    </th>
                    <SortableHeader label="Company" column="company" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Position" column="position" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Applied" column="date_applied" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Interview" column="interview_date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <th scope="col">Contact</th>
                    <th scope="col">Status</th>
                    <th scope="col">Link</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedApplications.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="empty-state">
                        {searchQuery ? <>No applications match your search.</> : filterStatus !== 'all' ? <>No {filterStatus} applications found.</> : <>No applications yet. Click "New Application" to start!</>}
                      </td>
                    </tr>
                  ) : sortedApplications.map(app => (
                    <tr key={app.id} aria-selected={selectedIds.has(app.id)}>
                      <td><input type="checkbox" aria-label={`Select ${app.company}`} checked={selectedIds.has(app.id)} onChange={() => toggleSelect(app.id)} /></td>
                      <td className="company-name">{app.company}</td>
                      <td className="position-name">{app.position}</td>
                      <td className="date">{app.date_applied ? new Date(app.date_applied).toLocaleDateString() : '—'}</td>
                      <td className="date">{app.interview_date ? new Date(app.interview_date).toLocaleDateString() : '—'}</td>
                      <td className="contact">{app.contact_person || '—'}</td>
                      <td><StatusBadge status={app.status} /></td>
                      <td>
                        {app.job_posting_url ? (
                          <a href={app.job_posting_url} target="_blank" rel="noopener noreferrer" className="btn-icon" aria-label={`Job posting for ${app.company} (opens in new tab)`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <ExternalLink size={16} />
                          </a>
                        ) : <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button onClick={() => handleEdit(app)} className="btn-icon" aria-label={`Edit ${app.company}`} disabled={isSyncing}><Edit2 size={16} /></button>
                          <button onClick={() => openTimeline(app)} className="btn-icon" aria-label={`Timeline for ${app.company}`} disabled={isSyncing}><Clock size={16} /></button>
                          <button onClick={() => handleDelete(app.id)} className="btn-icon delete" aria-label={`Delete ${app.company}`} disabled={isSyncing}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )} {/* end kanban/table */}

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
          <div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="modal-title" className="modal-title">
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

              {/* NEW: Interview Date */}
              <div className="form-group">
                <label>Interview Date</label>
                <input
                  type="date"
                  value={formData.interview_date || ''}
                  onChange={(e) => setFormData({ ...formData, interview_date: e.target.value })}
                />
              </div>

              {/* NEW: Job Posting URL */}
              <div className="form-group">
                <label>Job Posting URL</label>
                <input
                  type="url"
                  value={formData.job_posting_url || ''}
                  onChange={(e) => setFormData({ ...formData, job_posting_url: e.target.value })}
                  placeholder="https://company.com/careers/job-id"
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

              <AttachmentsField
                attachments={formData.attachments || []}
                onChange={(atts) => setFormData({ ...formData, attachments: atts })}
              />

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Follow-up info, recruiter notes, etc."
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
