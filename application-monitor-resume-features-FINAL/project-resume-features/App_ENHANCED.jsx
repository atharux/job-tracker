import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Edit2, X, Check, Download, LogOut, Upload, FileText } from 'lucide-react';
import { supabase } from './supabaseClient';
import MilestoneToast from './MilestoneToast.jsx';
import ResumeUploader from './ResumeUploader.jsx';
import ResumeModuleEditor from './ResumeModuleEditor.jsx';
import { downloadATSResume } from './atsExport.js';
import * as gamification from './gamification.js';
import './App.css';
import './animations.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [theme, setTheme] = useState('dark');

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
    resume_id: null
  });

  // Resume features state
  const [resumes, setResumes] = useState([]);
  const [currentResume, setCurrentResume] = useState(null);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isResumeProcessing, setIsResumeProcessing] = useState(false);
  const [editingModules, setEditingModules] = useState(null);

  const [gamificationState, setGamificationState] = useState(
    gamification.getInitialState()
  );

  const [activeMilestone, setActiveMilestone] = useState(null);
  const [milestoneQueue, setMilestoneQueue] = useState([]);

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
      loadResumes();
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
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResumes = async () => {
    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Load resumes error:', error);
        return;
      }

      setResumes(data || []);
      if (data && data.length > 0) {
        setCurrentResume(data[0]);
      }
    } catch (e) {
      console.error('Failed to load resumes:', e);
    }
  };

  const handleResumeProcessed = async (resumeData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('resumes')
        .insert([{
          user_id: user.id,
          original_filename: resumeData.filename,
          base_content: resumeData.base_content,
          modules: resumeData.modules
        }])
        .select()
        .single();

      if (error) {
        console.error('Save resume error:', error);
        alert('Failed to save resume');
        return;
      }

      setResumes(prev => [data, ...prev]);
      setCurrentResume(data);
      setIsResumeProcessing(false);
      alert('Resume processed successfully!');
    } catch (e) {
      console.error('Resume save error:', e);
      alert('Failed to save resume');
      setIsResumeProcessing(false);
    }
  };

  const handleExportATS = () => {
    if (!currentResume) {
      alert('Please upload a resume first');
      return;
    }

    downloadATSResume(
      currentResume.modules,
      { name: user.email.split('@')[0], email: user.email },
      `${currentResume.original_filename || 'resume'}-ats.txt`
    );
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
          rank: retroRank
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
        return;
      }

      const needsUpdate = data.points !== retroPoints || data.rank !== retroRank;

      if (needsUpdate) {
        const updated = {
          ...data,
          points: retroPoints,
          rank: retroRank
        };

        const { error: updateError } = await supabase
          .from('gamification_state')
          .update({ points: retroPoints, rank: retroRank })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Failed to update gamification state:', updateError);
          return;
        }

        setGamificationState(updated);
      } else {
        setGamificationState(data);
      }

    } catch (error) {
      console.error('[GAMIFICATION] load error:', error);
    }
  };

  const applyGamification = async (action, actionData = {}) => {
    if (!gamificationState) return;

    const oldState = gamificationState;
    const newState = gamification.computeNewState(oldState, action, actionData);

    const { data: freshApps } = await supabase
      .from('applications')
      .select('*')
      .order('date_applied', { ascending: false });

    const milestones = gamification.detectMilestones(
      oldState,
      newState,
      freshApps || applications
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
      setResumes([]);
      setCurrentResume(null);
    } catch (error) {
      console.error('Error logging out:', error);
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
        .order('date_applied', { ascending: false});

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
      resume_id: currentResume?.id || null
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
      resume_id: app.resume_id
    });
    setEditingId(app.id);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.company.trim() || !formData.position.trim()) {
      alert('Company and position are required');
      return;
    }

    const oldStatus = editingId 
      ? applications.find(a => a.id === editingId)?.status 
      : null;

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
          .insert([{ ...formData, user_id: user.id }]);

        if (error) {
          console.error('Insert error:', error);
          alert('Failed to save application');
          return;
        }
      }

      setIsModalOpen(false);
      await loadApplications();
      
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

