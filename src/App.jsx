import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Edit2, X, Check, Download, Target, Flower } from 'lucide-react';
import { supabase } from './supabaseClient';
import './App.css';

const TERMS = {
  battle: {
    title: 'Application Monitor',
    add: 'Enlist',
    status: 'Status'
  },
  garden: {
    title: 'Career Garden',
    add: 'Plant Seeds',
    status: 'Growth Stage'
  }
};

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'battle');

  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  const t = TERMS[theme];

  // EXISTING STATE (UNCHANGED)
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

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    const { data } = await supabase
      .from('applications')
      .select('*')
      .order('date_applied', { ascending: false });
    setApplications(data || []);
    setIsLoading(false);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gradient" data-theme={theme}>
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="header-accent"></div>
            <h1 className="text-3xl font-bold">
              {t.title}
            </h1>
          </div>

          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === 'battle' ? 'garden' : 'battle')}
            aria-label="Toggle theme"
          >
            {theme === 'battle' ? <Flower /> : <Target />}
          </button>
        </div>

        <button className="btn-primary">
          <Plus size={18} /> {t.add}
        </button>
      </div>
    </div>
  );
}
