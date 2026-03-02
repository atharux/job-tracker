import React, { useState, useEffect, useRef } from 'react';
import { Upload } from 'lucide-react'; // Add Upload to existing imports
import { extractTextFromFile } from '../utils/smartResumeParser';
import { supabase } from '../supabaseClient';
import { Download, Save, Wand2, FileText, Link, ChevronDown, ChevronUp, X, Check, Loader2, AlertCircle, Eye, Edit3, Mail } from 'lucide-react';

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function loadUserPersona(userId) {
  const { data, error } = await supabase
    .from('resume_versions')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function saveResumeVersion(userId, name, content) {
  const { data, error } = await supabase
    .from('resume_versions')
    .insert([{ user_id: userId, name, content, updated_at: new Date().toISOString() }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── AI Proxy (via Cloudflare Worker) ───────────────────────────────────────

const WORKER_URL = 'https://ai-proxy.athar-hafiz.workers.dev';

async function callAI(systemPrompt, userMessage, provider = 'groq') {
  console.log('Calling AI with provider:', provider);
  
  // Get user's API key from localStorage
  const userApiKey = provider === 'groq' 
    ? localStorage.getItem('groq_api_key')
    : localStorage.getItem('anthropic_api_key');
  
  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider,
      systemPrompt,
      userMessage,
      apiKey: userApiKey || undefined, // Send user's key if they have one
    }),
  });

  console.log('Worker response status:', response.status);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('Worker error details:', err);
    
    // Extract meaningful error message
    let errorMsg = `API error ${response.status}`;
    if (err.error) {
      if (typeof err.error === 'string') {
        errorMsg = err.error;
      } else if (err.error.message) {
        errorMsg = err.error.message;
      } else if (err.error.error?.message) {
        errorMsg = err.error.error.message;
      } else {
        errorMsg = JSON.stringify(err.error);
      }
    }
    
    throw new Error(errorMsg);
  }

  const data = await response.json();
  console.log('Worker response received');
  return data.content;
}

// ─── PDF / TXT download helpers ──────────────────────────────────────────────

function downloadTXT(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPDF(content, filename) {
  // Build a minimal print-ready HTML page and trigger browser print-to-PDF
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${filename}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, serif; font-size: 11pt; color: #111; padding: 32px 40px; max-width: 720px; margin: auto; line-height: 1.55; }
  pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: inherit; }
  h1, h2, h3 { font-family: 'Segoe UI', sans-serif; }
  @media print { body { padding: 0; } }
</style>
</head>
<body><pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body>
</html>`;
  const win = window.open('', '_blank');
  if (!win) { alert('Allow popups to download PDF, or use Save as TXT.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ─── STEP INDICATORS ─────────────────────────────────────────────────────────

const STEPS = ['Paste Job', 'AI Analysis', 'Edit & Export'];

function StepBar({ current }) {
  return (
    <div className="ra-steps">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          <div className={`ra-step ${i <= current ? 'ra-step--active' : ''} ${i < current ? 'ra-step--done' : ''}`}>
            <div className="ra-step__dot">
              {i < current ? <Check size={12} /> : i + 1}
            </div>
            <span className="ra-step__label">{label}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`ra-step__line ${i < current ? 'ra-step__line--done' : ''}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── SKILL MATCH CHIP ────────────────────────────────────────────────────────

function SkillChip({ label, matched }) {
  return (
    <span className={`ra-chip ${matched ? 'ra-chip--match' : 'ra-chip--gap'}`}>
      {matched ? '✓' : '!'} {label}
    </span>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function ResumeAssembly({ user }) {
  const [step, setStep] = useState(0);
  const [jobInput, setJobInput] = useState('');
  const [inputMode, setInputMode] = useState('paste'); // 'paste' | 'url'
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysis, setAnalysis] = useState(null); // { jobTitle, company, matchedSkills, gapSkills, summary }
  const [customizedResume, setCustomizedResume] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);const [aiProvider, setAiProvider] = useState('groq'); // 'claude' | 'groq'
const [isUploading, setIsUploading] = useState(false);
const [uploadedResumeText, setUploadedResumeText] = useState('');
const fileInputRef = useRef(null);
  const [savedMsg, setSavedMsg] = useState('');
  const [versionName, setVersionName] = useState('');
  const [showVersionInput, setShowVersionInput] = useState(false);
  const [resumeVersions, setResumeVersions] = useState([]);
  const [baseResumeId, setBaseResumeId] = useState('');
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(true);
  const textareaRef = useRef(null);

  // ── Cover Letter state ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('resume'); // 'resume' | 'coverletter'
  const [coverLetter, setCoverLetter] = useState('');
  const [coverLetterEdit, setCoverLetterEdit] = useState('');
  const [isCLEditing, setIsCLEditing] = useState(false);
  const [isCLGenerating, setIsCLGenerating] = useState(false);
  const [isCLSaving, setIsCLSaving] = useState(false);
  const [clSavedMsg, setCLSavedMsg] = useState('');
  const [clError, setCLError] = useState('');
  const [clVersionName, setCLVersionName] = useState('');
  // Store job context for cover letter generation (set after handleAnalyze completes)
  const jobContextRef = useRef(null);

  useEffect(() => {
    loadUserPersona(user.id)
      .then(setResumeVersions)
      .catch(console.error);
  }, [user.id]);

  // ── Upload resume ────────────────────────────────────────────────────────────

  const handleUploadResume = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setAnalysisError('');

    try {
      const text = await extractTextFromFile(file);
      setUploadedResumeText(text);
      
      // Save as a resume version
      const versionName = `Uploaded: ${file.name} - ${new Date().toLocaleDateString()}`;
      await saveResumeVersion(user.id, versionName, text);
      
      // Reload versions
      const updated = await loadUserPersona(user.id);
      setResumeVersions(updated);
      
      setSavedMsg('Resume uploaded successfully!');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setAnalysisError('Failed to upload resume: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ── Step 1: Analyze job + build resume ──────────────────────────────────────

  const handleAnalyze = async () => {
    if (!jobInput.trim()) return;
    console.log('Starting analysis with provider:', aiProvider);
    setIsAnalyzing(true);
    setAnalysisError('');
    setStep(1);

    try {
      // Load base resume content (if user selected one)
      let baseResumeContent = '';
      if (baseResumeId) {
        const selected = resumeVersions.find(v => v.id === baseResumeId);
        if (selected?.content) baseResumeContent = selected.content;
      } else if (resumeVersions.length > 0) {
        // Auto-use latest
        baseResumeContent = resumeVersions[0]?.content || '';
      }

      // ── Phase 1: Extract job signal ──────────────────────────────────────
      const jobSignalRaw = await callAI(
        `You are a precise job-analysis engine. Extract structured data from a job posting.
Return ONLY valid JSON (no markdown, no code blocks) in this exact shape:
{
  "jobTitle": "...",
  "company": "...",
  "requiredSkills": ["skill1", "skill2"],
  "niceToHaveSkills": ["skill3"],
  "keywords": ["word1", "word2"],
  "summary": "2-3 sentence description of the role"
}`,
        `JOB POSTING:\n${jobInput}`,
        aiProvider
      );

      let jobSignal;
      try {
        jobSignal = JSON.parse(jobSignalRaw.trim());
      } catch {
        const jsonMatch = jobSignalRaw.match(/\{[\s\S]*\}/);
        jobSignal = jsonMatch ? JSON.parse(jsonMatch[0]) : {
          jobTitle: 'Untitled Role',
          company: 'Unknown',
          requiredSkills: [],
          niceToHaveSkills: [],
          keywords: [],
          summary: '',
        };
      }

      // ── Phase 2: Match persona against job ──────────────────────────────
      const matchRaw = await callAI(
        `You are a resume-to-job matching engine.
Given a user's resume and a parsed job signal, return ONLY valid JSON:
{
  "matchedSkills": ["skill"],
  "gapSkills": ["skill"],
  "score": 85,
  "notes": "1-2 sentence match summary"
}`,
        `USER RESUME:\n${baseResumeContent || '(No resume provided — generate best-effort based on job only)'}\n\nJOB SIGNAL:\n${JSON.stringify(jobSignal)}`,
        aiProvider
      );

      let matchData;
      try {
        matchData = JSON.parse(matchRaw.trim());
      } catch {
        const jsonMatch2 = matchRaw.match(/\{[\s\S]*\}/);
        matchData = jsonMatch2 ? JSON.parse(jsonMatch2[0]) : { matchedSkills: [], gapSkills: [], score: 0, notes: '' };
      }

      setAnalysis({ ...jobSignal, ...matchData });

      // ── Phase 3: Build customized resume ────────────────────────────────
      const assembled = await callAI(
        `You are an expert resume writer. Rewrite the user's resume, optimizing it for the given job.
Rules:
- Prioritize experiences and skills that match the job signal
- Mirror keywords from the job posting naturally (no keyword stuffing)
- Keep the resume honest and grounded in the original content
- Format as clean plain text optimized for ATS parsers
- Include: Contact info (if available), Summary, Skills, Experience, Education
- If base resume is empty, create a professional template with placeholder sections marked [EDIT THIS]
- DO NOT add fictional experience or credentials
Output ONLY the resume text, no preamble, no markdown headers beyond section names in ALL CAPS.`,
        `BASE RESUME:\n${baseResumeContent || '(Empty — use template)'}\n\nJOB SIGNAL:\n${JSON.stringify(jobSignal)}\n\nMATCH DATA:\n${JSON.stringify(matchData)}`,
        aiProvider
      );

      setCustomizedResume(assembled);
      setEditContent(assembled);
      setVersionName(`${jobSignal.jobTitle || 'Role'} @ ${jobSignal.company || 'Company'} — ${new Date().toLocaleDateString()}`);
      setCLVersionName(`Cover Letter — ${jobSignal.jobTitle || 'Role'} @ ${jobSignal.company || 'Company'} — ${new Date().toLocaleDateString()}`);
      // Store context for cover letter generation
      jobContextRef.current = { jobSignal, matchData, baseResumeContent };
      setActiveTab('resume');
      setCoverLetter('');
      setCoverLetterEdit('');
      setStep(2);
      console.log('Analysis complete - step set to 2, analysis:', { jobTitle: jobSignal.jobTitle, company: jobSignal.company, score: matchData.score });
    } catch (err) {
      console.error(err);
      setAnalysisError(err.message || 'Analysis failed. Check your API connection.');
      setStep(0);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Save version ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!versionName.trim()) { setShowVersionInput(true); return; }
    setIsSaving(true);
    try {
      await saveResumeVersion(user.id, versionName, isEditing ? editContent : customizedResume);
      setSavedMsg('Saved!');
      setTimeout(() => setSavedMsg(''), 3000);
      const updated = await loadUserPersona(user.id);
      setResumeVersions(updated);
    } catch (err) {
      setSavedMsg('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setStep(0);
    setJobInput('');
    setAnalysis(null);
    setCustomizedResume('');
    setEditContent('');
    setIsEditing(false);
    setAnalysisError('');
    setSavedMsg('');
    setShowVersionInput(false);
    // reset cover letter
    setActiveTab('resume');
    setCoverLetter('');
    setCoverLetterEdit('');
    setIsCLEditing(false);
    setCLError('');
    setCLSavedMsg('');
    jobContextRef.current = null;
  };

  // ── Generate Cover Letter ────────────────────────────────────────────────────

  const handleGenerateCoverLetter = async () => {
    const ctx = jobContextRef.current;
    if (!ctx) return;
    setIsCLGenerating(true);
    setCLError('');
    try {
      const generated = await callAI(
        `You are an expert cover letter writer. Write a professional, personalized cover letter tailored to the job and candidate.

Rules:
- Open with a specific hook referencing the company's mission or the role's purpose (drawn from job signal)
- Second paragraph: highlight 2-3 concrete experiences from the candidate's background that directly map to the role's requirements
- Third paragraph: address any skill gaps honestly and frame them as growth opportunities; mention excitement for the specific tech stack or domain
- Fourth paragraph: close with what draws the candidate to THIS role specifically (team size, ownership, growth), not generic enthusiasm
- Keep total length to 4 paragraphs, ~300-380 words
- Tone: warm, direct, confident — not corporate or sycophantic
- End with "Warm regards," followed by a blank line for the candidate's name
- Output ONLY the cover letter text, no subject line, no preamble`,
        `CANDIDATE RESUME:\n${ctx.baseResumeContent || '(No resume provided)'}\n\nJOB SIGNAL:\n${JSON.stringify(ctx.jobSignal)}\n\nMATCH DATA:\n${JSON.stringify(ctx.matchData)}\n\nJOB DESCRIPTION (raw):\n${jobInput}`,
        aiProvider
      );
      setCoverLetter(generated);
      setCoverLetterEdit(generated);
    } catch (err) {
      setCLError(err.message || 'Cover letter generation failed.');
    } finally {
      setIsCLGenerating(false);
    }
  };

  const handleSaveCoverLetter = async () => {
    const content = isCLEditing ? coverLetterEdit : coverLetter;
    if (!clVersionName.trim() || !content) return;
    setIsCLSaving(true);
    try {
      await saveResumeVersion(user.id, clVersionName, content);
      setCLSavedMsg('Saved!');
      setTimeout(() => setCLSavedMsg(''), 3000);
      const updated = await loadUserPersona(user.id);
      setResumeVersions(updated);
    } catch (err) {
      setCLSavedMsg('Save failed: ' + err.message);
    } finally {
      setIsCLSaving(false);
    }
  };

  const finalCLContent = isCLEditing ? coverLetterEdit : coverLetter;

  const finalContent = isEditing ? editContent : customizedResume;

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="ra-root">
      <style>{`
        /* ── Root & Layout ─────────────────────────────────────────── */
        .ra-root {
          font-family: 'DM Sans', 'Helvetica Neue', Arial, sans-serif;
          min-height: 70vh;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* ── Step Bar ──────────────────────────────────────────────── */
        .ra-steps {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 20px 24px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
        }
        .ra-step {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .ra-step__dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: rgba(255,255,255,0.3);
          transition: all 0.3s;
          flex-shrink: 0;
        }
        .ra-step--active .ra-step__dot {
          border-color: #6ee7b7;
          color: #6ee7b7;
          background: rgba(110,231,183,0.1);
        }
        .ra-step--done .ra-step__dot {
          border-color: #6ee7b7;
          background: #6ee7b7;
          color: #0d1117;
        }
        .ra-step__label {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.3);
          transition: color 0.3s;
          white-space: nowrap;
        }
        .ra-step--active .ra-step__label { color: #e2e8f0; }
        .ra-step__line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.1);
          margin: 0 12px;
          transition: background 0.3s;
        }
        .ra-step__line--done { background: #6ee7b7; }

        /* ── Cards ─────────────────────────────────────────────────── */
        .ra-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 28px;
        }
        .ra-card-title {
          font-size: 16px;
          font-weight: 700;
          color: #e2e8f0;
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ra-card-title-accent {
          color: #6ee7b7;
        }

        /* ── Input Mode Toggle ─────────────────────────────────────── */
        .ra-mode-toggle {
          display: flex;
          gap: 4px;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
          padding: 3px;
          width: fit-content;
          margin-bottom: 16px;
        }
        .ra-mode-btn {
          padding: 6px 16px;
          border-radius: 6px;
          border: none;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          background: transparent;
          color: rgba(255,255,255,0.4);
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ra-mode-btn--active {
          background: rgba(110,231,183,0.15);
          color: #6ee7b7;
        }

        /* ── Textarea & Inputs ─────────────────────────────────────── */
        .ra-textarea {
          width: 100%;
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: #e2e8f0;
          font-size: 14px;
          line-height: 1.6;
          padding: 16px;
          resize: vertical;
          min-height: 160px;
          font-family: inherit;
          transition: border-color 0.2s;
          outline: none;
          box-sizing: border-box;
        }
        .ra-textarea:focus {
          border-color: rgba(110,231,183,0.4);
        }
        .ra-textarea::placeholder { color: rgba(255,255,255,0.2); }

        .ra-input {
          width: 100%;
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: #e2e8f0;
          font-size: 14px;
          padding: 12px 16px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .ra-input:focus { border-color: rgba(110,231,183,0.4); }
        .ra-input::placeholder { color: rgba(255,255,255,0.2); }

        /* ── Select ────────────────────────────────────────────────── */
        .ra-select {
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: #e2e8f0;
          font-size: 14px;
          padding: 10px 14px;
          font-family: inherit;
          outline: none;
          cursor: pointer;
          width: 100%;
          transition: border-color 0.2s;
        }
        .ra-select:focus { border-color: rgba(110,231,183,0.4); }
        .ra-select option { background: #1a1f2e; }

        /* ── Buttons ───────────────────────────────────────────────── */
        .ra-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 20px;
          border-radius: 9px;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .ra-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ra-btn--primary {
          background: linear-gradient(135deg, #6ee7b7, #3b82f6);
          color: #0d1117;
        }
        .ra-btn--primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(110,231,183,0.3);
        }
        .ra-btn--ghost {
          background: rgba(255,255,255,0.06);
          color: #94a3b8;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .ra-btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: #e2e8f0; }
        .ra-btn--danger-ghost {
          background: transparent;
          color: #f87171;
          border: 1px solid rgba(248,113,113,0.3);
        }
        .ra-btn--danger-ghost:hover { background: rgba(248,113,113,0.08); }
        .ra-btn--success {
          background: rgba(110,231,183,0.12);
          color: #6ee7b7;
          border: 1px solid rgba(110,231,183,0.25);
        }
        .ra-btn--success:hover:not(:disabled) { background: rgba(110,231,183,0.2); }

        .ra-btn-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          margin-top: 20px;
        }

        /* ── Skills ────────────────────────────────────────────────── */
        .ra-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          margin: 3px;
        }
        .ra-chip--match {
          background: rgba(110,231,183,0.12);
          color: #6ee7b7;
          border: 1px solid rgba(110,231,183,0.25);
        }
        .ra-chip--gap {
          background: rgba(251,191,36,0.1);
          color: #fbbf24;
          border: 1px solid rgba(251,191,36,0.25);
        }

        /* ── Analysis Panel ────────────────────────────────────────── */
        .ra-analysis {
          background: rgba(0,0,0,0.15);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 20px;
        }
        .ra-analysis__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          cursor: pointer;
          user-select: none;
        }
        .ra-analysis__header:hover { background: rgba(255,255,255,0.02); }
        .ra-analysis__title {
          font-size: 14px;
          font-weight: 600;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ra-analysis__body { padding: 0 18px 18px; }

        .ra-score-bar {
          height: 6px;
          border-radius: 3px;
          background: rgba(255,255,255,0.07);
          margin: 6px 0 14px;
          overflow: hidden;
        }
        .ra-score-fill {
          height: 100%;
          border-radius: 3px;
          background: linear-gradient(90deg, #6ee7b7, #3b82f6);
          transition: width 1s ease;
        }

        /* ── Resume Preview ────────────────────────────────────────── */
        .ra-resume-preview {
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 24px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.75;
          color: #cbd5e1;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 560px;
          overflow-y: auto;
        }
        .ra-resume-preview::-webkit-scrollbar { width: 5px; }
        .ra-resume-preview::-webkit-scrollbar-track { background: transparent; }
        .ra-resume-preview::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

        .ra-resume-edit {
          width: 100%;
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(110,231,183,0.3);
          border-radius: 10px;
          padding: 24px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.75;
          color: #cbd5e1;
          min-height: 560px;
          resize: vertical;
          outline: none;
          box-sizing: border-box;
        }

        /* ── Loading Overlay ───────────────────────────────────────── */
        .ra-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 60px 24px;
          text-align: center;
        }
        .ra-loading__spinner {
          animation: ra-spin 1s linear infinite;
          color: #6ee7b7;
        }
        @keyframes ra-spin { to { transform: rotate(360deg); } }
        .ra-loading__text {
          font-size: 15px;
          font-weight: 500;
          color: #94a3b8;
        }
        .ra-loading__sub {
          font-size: 13px;
          color: rgba(148,163,184,0.6);
          max-width: 300px;
        }

        /* ── Error ─────────────────────────────────────────────────── */
        .ra-error {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.2);
          border-radius: 10px;
          padding: 14px 18px;
          color: #f87171;
          font-size: 14px;
        }

        /* ── Save badge ────────────────────────────────────────────── */
        .ra-saved-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 13px;
          color: #6ee7b7;
          animation: ra-fade 3s forwards;
        }
        @keyframes ra-fade { 0%,80%{opacity:1} 100%{opacity:0} }

        /* ── Version input inline ──────────────────────────────────── */
        .ra-version-row {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-top: 12px;
        }
        .ra-version-row .ra-input { flex: 1; }

        /* ── Section label ─────────────────────────────────────────── */
        .ra-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.3);
          margin-bottom: 8px;
          display: block;
        }

        /* ── Hint ──────────────────────────────────────────────────── */
        .ra-hint {
          font-size: 12px;
          color: rgba(255,255,255,0.25);
          margin-top: 8px;
        }

        .ra-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 700px) { .ra-two-col { grid-template-columns: 1fr; } }

        /* ── Result Tabs (Resume / Cover Letter) ───────────────────── */
        .ra-tabs {
          display: flex;
          gap: 4px;
          background: rgba(0,0,0,0.2);
          border-radius: 10px;
          padding: 4px;
          width: fit-content;
          margin-bottom: 20px;
        }
        .ra-tab {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 18px;
          border-radius: 7px;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          background: transparent;
          color: rgba(255,255,255,0.35);
          transition: all 0.2s;
          font-family: inherit;
        }
        .ra-tab--active {
          background: rgba(110,231,183,0.13);
          color: #6ee7b7;
          border: 1px solid rgba(110,231,183,0.22);
        }
        .ra-tab:not(.ra-tab--active):hover {
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.6);
        }
        .ra-cl-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 48px 24px;
          text-align: center;
        }
        .ra-cl-empty__icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(110,231,183,0.08);
          border: 1px solid rgba(110,231,183,0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6ee7b7;
        }
        .ra-cl-empty__title {
          font-size: 15px;
          font-weight: 600;
          color: #e2e8f0;
        }
        .ra-cl-empty__sub {
          font-size: 13px;
          color: rgba(255,255,255,0.3);
          max-width: 300px;
          line-height: 1.6;
        }
      `}</style>

      {/* ── Step Bar ─────────────────────────────────────────────────────── */}
      <StepBar current={step} />

      {/* ── AI Provider Selector ──────────────────────────────────────────── */}
      {step === 0 && (
        <div className="ra-card" style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>AI Provider:</span>
              <div className="ra-mode-toggle" style={{ marginBottom: 0 }}>
                <button
                  className={`ra-mode-btn ${aiProvider === 'claude' ? 'ra-mode-btn--active' : ''}`}
                  onClick={() => setAiProvider('claude')}
                >
                  Claude Sonnet 4
                </button>
                <button
                  className={`ra-mode-btn ${aiProvider === 'groq' ? 'ra-mode-btn--active' : ''}`}
                  onClick={() => setAiProvider('groq')}
                >
                  Groq Llama 3.3
                </button>
              </div>
            </div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
              {aiProvider === 'claude' ? 'Best accuracy' : 'Faster & free'}
            </span>
          </div>
        </div>
      )}

      {/* ── STEP 0: Job Input ────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="ra-card">
          <div className="ra-card-title">
            <Wand2 size={18} className="ra-card-title-accent" />
            Job-to-Resume <span style={{ color: '#6ee7b7' }}>Assembly Engine</span>
          </div>

          {/* Base resume selector */}
          {resumeVersions.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <label className="ra-label">Base Resume (optional)</label>
              <select
                className="ra-select"
                value={baseResumeId}
                onChange={e => setBaseResumeId(e.target.value)}
              >
                <option value="">Use latest saved resume ({resumeVersions[0]?.name || 'most recent'})</option>
                {resumeVersions.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}

          {resumeVersions.length === 0 && (
            <div className="ra-error" style={{ marginBottom: 20 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>No saved resume found. The AI will generate a template — you can also go to the Resume Builder first to upload your resume.</span>
            </div>
          )}

          {/* Upload resume button */}
          <div style={{ marginBottom: 22 }}>
            <label className="ra-label">Or Upload New Resume</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleUploadResume}
              style={{ display: 'none' }}
            />
            <button
              className="ra-btn ra-btn--ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{ width: '100%' }}
            >
              {isUploading ? (
                <><Loader2 size={16} className="ra-loading__spinner" /> Uploading...</>
              ) : (
                <><Upload size={16} /> Upload Resume (PDF, DOCX, TXT)</>
              )}
            </button>
          </div>

          {savedMsg && (
            <div style={{ marginBottom: 16 }} className="ra-saved-badge">
              <Check size={14} /> {savedMsg}
            </div>
          )}

          {/* Input mode */}
          <div className="ra-mode-toggle">
            <button
              className={`ra-mode-btn ${inputMode === 'paste' ? 'ra-mode-btn--active' : ''}`}
              onClick={() => setInputMode('paste')}
            >
              <FileText size={14} /> Paste Job Description
            </button>
            <button
              className={`ra-mode-btn ${inputMode === 'url' ? 'ra-mode-btn--active' : ''}`}
              onClick={() => setInputMode('url')}
            >
              <Link size={14} /> Job URL
            </button>
          </div>

          {inputMode === 'paste' ? (
            <>
              <label className="ra-label">Job Description</label>
              <textarea
                className="ra-textarea"
                style={{ minHeight: 220 }}
                placeholder="Paste the full job description here — include requirements, responsibilities, and any technologies mentioned…"
                value={jobInput}
                onChange={e => setJobInput(e.target.value)}
              />
            </>
          ) : (
            <>
              <label className="ra-label">Job Posting URL</label>
              <input
                className="ra-input"
                type="url"
                placeholder="https://jobs.example.com/software-engineer-12345"
                value={jobInput}
                onChange={e => setJobInput(e.target.value)}
              />
              <p className="ra-hint">⚠ URL mode works best when the full job text is accessible. If scraping fails, switch to Paste mode.</p>
            </>
          )}

          {analysisError && (
            <div className="ra-error" style={{ marginTop: 16 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{analysisError}</span>
            </div>
          )}

          <div className="ra-btn-row">
            <button
              className="ra-btn ra-btn--primary"
              disabled={!jobInput.trim()}
              onClick={handleAnalyze}
            >
              <Wand2 size={16} /> Assemble Resume
            </button>
            <span className="ra-hint" style={{ marginTop: 0 }}>Powered by Claude AI · 3 API calls</span>
          </div>
        </div>
      )}

      {/* ── STEP 1: Loading ──────────────────────────────────────────────── */}
      {step === 1 && isAnalyzing && (
        <div className="ra-card">
          <div className="ra-loading">
            <Loader2 size={40} className="ra-loading__spinner" />
            <div className="ra-loading__text">Assembling your tailored resume…</div>
            <div className="ra-loading__sub">Parsing job signal → matching your profile → rebuilding resume for ATS + human readers</div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Results ──────────────────────────────────────────────── */}
      {step === 2 && analysis && (
        <>
          {/* Analysis panel (collapsible) */}
          <div className="ra-analysis">
            <div className="ra-analysis__header" onClick={() => setShowAnalysisPanel(v => !v)}>
              <div className="ra-analysis__title">
                <span style={{ color: '#6ee7b7' }}>✦</span>
                AI Analysis — {analysis.jobTitle} {analysis.company ? `@ ${analysis.company}` : ''}
                {typeof analysis.score === 'number' && (
                  <span style={{ marginLeft: 8, fontSize: 13, color: '#6ee7b7' }}>{analysis.score}% match</span>
                )}
              </div>
              {showAnalysisPanel ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
            </div>

            {showAnalysisPanel && (
              <div className="ra-analysis__body">
                {typeof analysis.score === 'number' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                      <span>Match Score</span><span style={{ color: '#6ee7b7' }}>{analysis.score}%</span>
                    </div>
                    <div className="ra-score-bar">
                      <div className="ra-score-fill" style={{ width: `${analysis.score}%` }} />
                    </div>
                  </>
                )}

                {analysis.notes && (
                  <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14, lineHeight: 1.6 }}>{analysis.notes}</p>
                )}

                <div className="ra-two-col">
                  <div>
                    <label className="ra-label">Matched Skills</label>
                    <div>
                      {(analysis.matchedSkills || []).map((s, i) => (
                        <SkillChip key={i} label={s} matched={true} />
                      ))}
                      {(analysis.matchedSkills || []).length === 0 && <span style={{ fontSize: 12, color: '#475569' }}>None detected</span>}
                    </div>
                  </div>
                  <div>
                    <label className="ra-label">Skill Gaps to Address</label>
                    <div>
                      {(analysis.gapSkills || []).map((s, i) => (
                        <SkillChip key={i} label={s} matched={false} />
                      ))}
                      {(analysis.gapSkills || []).length === 0 && <span style={{ fontSize: 12, color: '#475569' }}>No gaps found</span>}
                    </div>
                  </div>
                </div>

                {analysis.summary && (
                  <p style={{ marginTop: 14, fontSize: 13, color: '#64748b', fontStyle: 'italic', lineHeight: 1.6 }}>
                    Role Summary: {analysis.summary}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Resume / Cover Letter tabbed card */}
          <div className="ra-card">
            {/* Tab toggle */}
            <div className="ra-tabs">
              <button
                className={`ra-tab ${activeTab === 'resume' ? 'ra-tab--active' : ''}`}
                onClick={() => setActiveTab('resume')}
              >
                <FileText size={14} /> Customized Resume
              </button>
              <button
                className={`ra-tab ${activeTab === 'coverletter' ? 'ra-tab--active' : ''}`}
                onClick={() => setActiveTab('coverletter')}
              >
                <Mail size={14} /> Cover Letter
              </button>
            </div>

            {/* ── Resume tab ── */}
            {activeTab === 'resume' && (
              <>
                <div className="ra-card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={18} className="ra-card-title-accent" />
                    Customized Resume
                  </span>
                  <button
                    className={`ra-btn ${isEditing ? 'ra-btn--success' : 'ra-btn--ghost'}`}
                    style={{ fontSize: 13, padding: '7px 14px' }}
                    onClick={() => setIsEditing(v => !v)}
                  >
                    {isEditing ? <><Eye size={14} /> Preview</> : <><Edit3 size={14} /> Edit</>}
                  </button>
                </div>

                {isEditing ? (
                  <textarea
                    ref={textareaRef}
                    className="ra-resume-edit"
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                  />
                ) : (
                  <div className="ra-resume-preview">{finalContent}</div>
                )}

                <div style={{ marginTop: 20 }}>
                  <label className="ra-label">Version Name</label>
                  <input
                    className="ra-input"
                    value={versionName}
                    onChange={e => setVersionName(e.target.value)}
                    placeholder="e.g. Senior Engineer @ Acme — Jan 2026"
                  />
                </div>

                <div className="ra-btn-row">
                  <button
                    className="ra-btn ra-btn--primary"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    <Save size={15} /> {isSaving ? 'Saving…' : 'Save Version'}
                  </button>
                  <button
                    className="ra-btn ra-btn--ghost"
                    onClick={() => downloadTXT(finalContent, `${versionName || 'resume'}.txt`)}
                  >
                    <Download size={15} /> ATS (.txt)
                  </button>
                  <button
                    className="ra-btn ra-btn--ghost"
                    onClick={() => downloadPDF(finalContent, `${versionName || 'resume'}.pdf`)}
                  >
                    <Download size={15} /> PDF
                  </button>
                  {savedMsg && (
                    <span className="ra-saved-badge">
                      <Check size={14} /> {savedMsg}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* ── Cover Letter tab ── */}
            {activeTab === 'coverletter' && (
              <>
                <div className="ra-card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mail size={18} className="ra-card-title-accent" />
                    Cover Letter
                  </span>
                  {coverLetter && (
                    <button
                      className={`ra-btn ${isCLEditing ? 'ra-btn--success' : 'ra-btn--ghost'}`}
                      style={{ fontSize: 13, padding: '7px 14px' }}
                      onClick={() => setIsCLEditing(v => !v)}
                    >
                      {isCLEditing ? <><Eye size={14} /> Preview</> : <><Edit3 size={14} /> Edit</>}
                    </button>
                  )}
                </div>

                {/* Not yet generated */}
                {!coverLetter && !isCLGenerating && (
                  <div className="ra-cl-empty">
                    <div className="ra-cl-empty__icon">
                      <Mail size={22} />
                    </div>
                    <div className="ra-cl-empty__title">Generate a tailored cover letter</div>
                    <div className="ra-cl-empty__sub">
                      Uses the same job analysis and your resume to write a role-specific cover letter in your voice.
                    </div>
                    {clError && (
                      <div className="ra-error" style={{ maxWidth: 420, width: '100%' }}>
                        <AlertCircle size={16} style={{ flexShrink: 0 }} />
                        <span>{clError}</span>
                      </div>
                    )}
                    <button
                      className="ra-btn ra-btn--primary"
                      onClick={handleGenerateCoverLetter}
                    >
                      <Mail size={15} /> Generate Cover Letter
                    </button>
                  </div>
                )}

                {/* Generating */}
                {isCLGenerating && (
                  <div className="ra-loading">
                    <Loader2 size={36} className="ra-loading__spinner" />
                    <div className="ra-loading__text">Writing your cover letter…</div>
                    <div className="ra-loading__sub">Matching your background to the role signal and crafting a tailored letter</div>
                  </div>
                )}

                {/* Generated */}
                {coverLetter && !isCLGenerating && (
                  <>
                    {isCLEditing ? (
                      <textarea
                        className="ra-resume-edit"
                        value={coverLetterEdit}
                        onChange={e => setCoverLetterEdit(e.target.value)}
                      />
                    ) : (
                      <div className="ra-resume-preview">{finalCLContent}</div>
                    )}

                    <div style={{ marginTop: 20 }}>
                      <label className="ra-label">Version Name</label>
                      <input
                        className="ra-input"
                        value={clVersionName}
                        onChange={e => setCLVersionName(e.target.value)}
                        placeholder="e.g. Cover Letter — Product Designer @ Acme — Jan 2026"
                      />
                    </div>

                    <div className="ra-btn-row">
                      <button
                        className="ra-btn ra-btn--primary"
                        onClick={handleSaveCoverLetter}
                        disabled={isCLSaving}
                      >
                        <Save size={15} /> {isCLSaving ? 'Saving…' : 'Save Version'}
                      </button>
                      <button
                        className="ra-btn ra-btn--ghost"
                        onClick={() => downloadTXT(finalCLContent, `${clVersionName || 'cover-letter'}.txt`)}
                      >
                        <Download size={15} /> TXT
                      </button>
                      <button
                        className="ra-btn ra-btn--ghost"
                        onClick={() => downloadPDF(finalCLContent, `${clVersionName || 'cover-letter'}.pdf`)}
                      >
                        <Download size={15} /> PDF
                      </button>
                      <button
                        className="ra-btn ra-btn--ghost"
                        style={{ marginLeft: 'auto' }}
                        onClick={() => { setCoverLetter(''); setCoverLetterEdit(''); setIsCLEditing(false); setCLError(''); }}
                      >
                        <X size={14} /> Regenerate
                      </button>
                      {clSavedMsg && (
                        <span className="ra-saved-badge">
                          <Check size={14} /> {clSavedMsg}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Reset — always visible at bottom */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button className="ra-btn ra-btn--danger-ghost" onClick={handleReset}>
                <X size={14} /> Start Over
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}