import { useState, useRef, useEffect } from "react";
import { supabase } from '../supabaseClient';
import { callAI } from "../ai/aiClient";
import { formatOutput } from "../ai/outputFormatter";
import { usePersistentToolState } from "../state/usePersistentToolState";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildDecodeJDPrompt }            from "../ai/prompts/decodeJD";
import { buildTailorCVPrompt }            from "../ai/prompts/tailorCV";
import { buildStrengthenBulletsPrompt }   from "../ai/prompts/strengthenBullets";
import { buildCoverLetterPrompt }         from "../ai/prompts/coverLetter";
import { buildAssessFitPrompt }           from "../ai/prompts/assessFit";
import { buildATSAlignmentPrompt }        from "../ai/prompts/atsAlignment";
import { buildInterviewQuestionsPrompt }  from "../ai/prompts/interviewQuestions";
import { buildSTARAnswersPrompt }         from "../ai/prompts/starAnswers";
import { buildRecruiterReviewPrompt }     from "../ai/prompts/recruiterReview";
import { buildFullApplicationPackPrompt } from "../ai/prompts/fullApplicationPack";

// Palette tokens
const BG       = '#0a0a0f';
const SURFACE  = '#0d0d15';
const BORDER   = '#1e1e2e';
const BORDER2  = '#2d2d3f';
const TEAL     = '#06b6d4';
const PURPLE   = '#8b5cf6';
const TEXT_HI  = '#e2e8f0';
const TEXT_MID = '#94a3b8';
const TEXT_LO  = '#475569';
const TEXT_DIM = '#64748b';
const MONO     = "'Space Mono', 'Courier New', monospace";

// -----------------------------------------------------------------------------
// 1. TOOL CONFIGURATION
// -----------------------------------------------------------------------------
const TOOLS = [
  { id: 1,  tag: "JD",  title: "Decode Job Description",   description: "Extract key skills, ATS keywords, and hiring goals from a JD",
    fields: [{ key: "jd", label: "Job Description", placeholder: "Paste the full job description here...", rows: 10 }],
    buildPrompt: buildDecodeJDPrompt },

  { id: 2,  tag: "CV",  title: "Tailor Your CV",           description: "Rewrite your CV to match the role without fabricating experience",
    fields: [{ key: "cv", label: "Your CV", placeholder: "Paste your full CV here...", rows: 10 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildTailorCVPrompt },

  { id: 3,  tag: "BL",  title: "Strengthen Bullet Points", description: "Rewrite bullets using action + task + result format",
    fields: [{ key: "role", label: "Job Title / Role", placeholder: "e.g. Senior Product Manager", rows: 1 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }, { key: "bullets", label: "Your Current Bullets", placeholder: "Paste your existing CV bullets here...", rows: 6 }],
    buildPrompt: buildStrengthenBulletsPrompt },

  { id: 4,  tag: "CL",  title: "Write a Cover Letter",     description: "Generate a tailored, natural cover letter from your background",
    fields: [{ key: "background", label: "Your Background", placeholder: "Paste your CV or career summary here...", rows: 8 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildCoverLetterPrompt },

  { id: 5,  tag: "FT",  title: "Assess Role Fit",          description: "Compare your background to the JD with a role-fit matrix",
    fields: [{ key: "background", label: "Your Background", placeholder: "Paste your CV or career summary here...", rows: 8 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildAssessFitPrompt },

  { id: 6,  tag: "ATS", title: "Improve ATS Alignment",    description: "Find missing keywords, weak areas, and ATS issues",
    fields: [{ key: "cv", label: "Your CV", placeholder: "Paste your full CV here...", rows: 10 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildATSAlignmentPrompt },

  { id: 7,  tag: "IQ",  title: "Predict Interview Questions", description: "Generate 15 likely interview questions grouped by type",
    fields: [{ key: "background", label: "Your Background", placeholder: "Paste your CV or career summary here...", rows: 8 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildInterviewQuestionsPrompt },

  { id: 8,  tag: "ST",  title: "Build STAR Answers",       description: "Create 8 STAR interview answers covering key competencies",
    fields: [{ key: "background", label: "Your Background", placeholder: "Paste your CV or career summary here...", rows: 8 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildSTARAnswersPrompt },

  { id: 9,  tag: "RR",  title: "Recruiter-Style Review",   description: "Get a shortlist / maybe / reject verdict with actionable feedback",
    fields: [{ key: "cv", label: "Your CV", placeholder: "Paste your full CV here...", rows: 8 }, { key: "cover", label: "Cover Letter", placeholder: "Paste your cover letter here...", rows: 6 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildRecruiterReviewPrompt },

  { id: 10, tag: "PKG", title: "Full Application Pack",    description: "Generate a complete application pack: CV, cover letter, questions and more",
    fields: [{ key: "background", label: "Your Background", placeholder: "Paste your CV or career summary here...", rows: 8 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildFullApplicationPackPrompt },
];

// -----------------------------------------------------------------------------
// 2. HOOKS
// -----------------------------------------------------------------------------

const useOpenRouterKey = () => {
  // Lazy init reads the current value immediately — no empty flash on mount.
  const [key, setKey] = useState(() => localStorage.getItem("openrouter_api_key") || "");
  useEffect(() => {
    const sync = () => setKey(localStorage.getItem("openrouter_api_key") || "");
    // Cross-tab writes fire the native 'storage' event.
    const handleStorage = (e) => { if (e.key === "openrouter_api_key") setKey(e.newValue || "") };
    // Same-tab writes: ApiKeySettings dispatches 'api-keys-saved' after localStorage.setItem.
    window.addEventListener("storage", handleStorage);
    window.addEventListener("api-keys-saved", sync);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("api-keys-saved", sync);
    };
  }, []);
  return [key, setKey];
};

const useResumes = (user) => {
  const [resumes, setResumes] = useState([]);
  const [activeResumeId, setActiveResumeId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadResumes();
  }, [user]);

  const loadResumes = async () => {
    try {
      const { data, error } = await supabase
        .from("resume_versions")
        .select("id, name, content, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setResumes(data || []);
      if (data?.length > 0) setActiveResumeId(data[0].id);
    } catch (e) {
      console.error("Failed to load resumes:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveResume = async (name, content) => {
    const { data, error } = await supabase
      .from("resume_versions")
      .insert([{ name, content, user_id: user.id }])
      .select()
      .single();
    if (error) throw error;
    setResumes((prev) => [data, ...prev]);
    setActiveResumeId(data.id);
    return data.id;
  };

  const deleteResume = async (id) => {
    const { error } = await supabase.from("resume_versions").delete().eq("id", id);
    if (error) throw error;
    setResumes((prev) => prev.filter((r) => r.id !== id));
    setActiveResumeId((prev) => (prev === id ? null : prev));
  };

  return { resumes, activeResumeId, setActiveResumeId, saveResume, deleteResume, loading };
};

const useOutputHistory = (user) => {
  const [outputs, setOutputs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadOutputs();
  }, [user]);

  const loadOutputs = async () => {
    try {
      const { data, error } = await supabase
        .from("generated_outputs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOutputs(data || []);
    } catch (e) {
      console.error("Failed to load outputs:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveOutput = async (toolName, content) => {
    if (!user) throw new Error("User not logged in");
    const { data, error } = await supabase
      .from("generated_outputs")
      .insert([{ user_id: user.id, tool_name: toolName, content }])
      .select()
      .single();
    if (error) throw error;
    setOutputs((prev) => [data, ...prev]);
    return data;
  };

  const deleteOutput = async (id) => {
    const { error } = await supabase.from("generated_outputs").delete().eq("id", id);
    if (error) throw error;
    setOutputs((prev) => prev.filter((o) => o.id !== id));
  };

  return { outputs, saveOutput, deleteOutput, loading };
};

// -----------------------------------------------------------------------------
// 3. SHARED STYLE HELPERS
// -----------------------------------------------------------------------------

const btn = (overrides = {}) => ({
  fontFamily: MONO,
  fontSize: '0.65rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '5px 12px',
  borderRadius: '3px',
  border: `1px solid ${BORDER2}`,
  background: 'transparent',
  color: TEXT_MID,
  cursor: 'pointer',
  transition: 'border-color 0.15s, color 0.15s',
  ...overrides,
});

const label = {
  fontFamily: MONO,
  fontSize: '0.65rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: TEXT_MID,
};

const inputBase = {
  background: `rgba(10,10,15,0.8)`,
  border: `1px solid ${BORDER}`,
  borderRadius: '4px',
  padding: '8px 12px',
  color: TEXT_HI,
  fontSize: '0.85rem',
  fontFamily: MONO,
  outline: 'none',
  width: '100%',
  resize: 'vertical',
  lineHeight: 1.6,
};

// -----------------------------------------------------------------------------
// 4. FREE MODELS
// -----------------------------------------------------------------------------

const FREE_MODELS = [
  { label: "Auto Free Router",      value: "openrouter/free" },
  { label: "Gemma 3 27B",           value: "google/gemma-3-27b-it:free" },
  { label: "Llama 4 Maverick",      value: "meta-llama/llama-4-maverick:free" },
  { label: "Llama 3.3 70B",         value: "meta-llama/llama-3.3-70b-instruct:free" },
  { label: "Qwen 235B",             value: "qwen/qwen3-235b-a22b:free" },
  { label: "Devstral Small",        value: "mistralai/devstral-small:free" },
  { label: "GLM 4.5 Air",           value: "z-ai/glm-4.5-air:free" },
  { label: "Gemini Flash 1.5",      value: "google/gemini-flash-1.5:free" },
  { label: "Hermes 3 Llama 70B",    value: "nousresearch/hermes-3-llama-3.1-70b:free" },
];

// -----------------------------------------------------------------------------
// 5. TOOL PANEL COMPONENT
// -----------------------------------------------------------------------------
function ToolPanel({ tool, user }) {
  const { values, setValues, output, setOutput } = usePersistentToolState(tool.id);

  const [loading, setLoading]         = useState(false);
  const [copied, setCopied]           = useState(false);
  const [error, setError]             = useState("");
  const [model, setModel]             = useState("openrouter/free");
  const [saving, setSaving]           = useState(false);
  const [openRouterKey, setOpenRouterKey] = useOpenRouterKey();

  const { resumes, activeResumeId, setActiveResumeId, saveResume, deleteResume, loading: resumesLoading } = useResumes(user);
  const { saveOutput, deleteOutput, outputs, loading: outputsLoading } = useOutputHistory(user);

  const outputRef     = useRef(null);
  const activeResume  = resumes.find((r) => r.id === activeResumeId);
  const isReady       = tool.fields.every((f) => (values[f.key] || "").trim().length > 0);
  const hasDraft      = Object.values(values).some((v) => (v || "").trim().length > 0);
  const currentModel  = FREE_MODELS.find(m => m.value === model)?.label ?? model;

  const handleChange = (key, val) => setValues((v) => ({ ...v, [key]: val }));

  const run = async () => {
    setLoading(true);
    setError("");
    setOutput("");
    try {
      if (!openRouterKey) throw new Error("OpenRouter API key required. Add it in Settings or below.");
      const prompt    = tool.buildPrompt(values);
      const raw       = await callAI({ apiKey: openRouterKey, model, userPrompt: prompt });
      const formatted = formatOutput({ toolId: tool.id, content: raw });
      setOutput(formatted);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      setError(err.message || "AI request failed");
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadOutput = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${tool.title.replace(/\s+/g, "_").toLowerCase()}_output.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveOutput = async () => {
    if (!output) return;
    setSaving(true);
    try {
      await saveOutput(tool.title, output);
    } catch (e) {
      setError("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const loadResumeIntoTool = () => {
    if (!activeResume) return;
    const targetKey = tool.fields.find((f) => f.key === "cv" || f.key === "background")?.key;
    if (targetKey) handleChange(targetKey, activeResume.content);
  };

  const saveCurrentAsResume = async () => {
    const cvKey = tool.fields.find((f) => f.key === "cv" || f.key === "background")?.key;
    if (!cvKey || !values[cvKey]) return;
    const name = prompt("Name this resume version:", `Resume v${resumes.length + 1}`);
    if (name) await saveResume(name, values[cvKey]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Resume Library */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '12px' }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <span style={{ ...label, color: TEXT_LO }}>Resume Library</span>
          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={saveCurrentAsResume} disabled={!isReady} style={btn({ opacity: !isReady ? 0.4 : 1 })}>Save</button>
            <button onClick={loadResumeIntoTool} disabled={!activeResume} style={btn({ opacity: !activeResume ? 0.4 : 1, color: TEAL, borderColor: `rgba(6,182,212,0.3)` })}>Load</button>
          </div>
        </div>
        {resumesLoading ? (
          <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: TEXT_DIM }}>Loading...</span>
        ) : (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {resumes.length === 0 && <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: TEXT_LO }}>No saved resumes</span>}
            {resumes.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveResumeId(r.id)}
                style={btn({
                  background: activeResumeId === r.id ? `rgba(139,92,246,0.15)` : 'transparent',
                  borderColor: activeResumeId === r.id ? `rgba(139,92,246,0.35)` : BORDER2,
                  color: activeResumeId === r.id ? '#c4b5fd' : TEXT_MID,
                  display: 'flex', alignItems: 'center', gap: '6px',
                })}
              >
                {r.name}
                <span
                  onClick={(e) => { e.stopPropagation(); deleteResume(r.id); }}
                  style={{ cursor: "pointer", opacity: 0.5, fontSize: '0.7rem', lineHeight: 1 }}
                  title="Remove"
                >
                  x
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* API Key notice */}
      <div style={{ background: `rgba(6,182,212,0.04)`, border: `1px solid rgba(6,182,212,0.15)`, borderRadius: '4px', padding: '10px 14px' }}>
        <p style={{ fontFamily: MONO, fontSize: '0.7rem', color: TEXT_MID, margin: '0 0 6px' }}>
          AI features require an OpenRouter API key.
        </p>
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: MONO, fontSize: '0.65rem', color: TEAL, textDecoration: 'none', letterSpacing: '0.06em' }}
        >
          openrouter.ai/keys &rarr;
        </a>
      </div>

      {/* Model selector + API key row */}
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={label}>Model</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{ ...inputBase, width: 'auto', minWidth: '240px', resize: 'none', padding: '7px 10px', fontSize: '0.75rem' }}
          >
            {FREE_MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Status pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: MONO, fontSize: '0.65rem', color: TEXT_MID, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '3px', padding: '7px 10px', marginTop: '19px', whiteSpace: 'nowrap' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: loading ? '#fbbf24' : '#4ade80', flexShrink: 0, transition: 'background 0.3s' }} />
          {loading ? `Running — ${currentModel}` : currentModel}
        </div>

        {/* API key input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: 'auto' }}>
          <span style={label}>OpenRouter API Key</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="password"
              value={openRouterKey}
              onChange={(e) => {
                const val = e.target.value;
                setOpenRouterKey(val);
                localStorage.setItem("openrouter_api_key", val);
              }}
              placeholder="sk-or-..."
              style={{ ...inputBase, width: '220px', resize: 'none', lineHeight: 'normal', fontSize: '0.75rem' }}
            />
            {openRouterKey && (
              <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#4ade80', whiteSpace: 'nowrap' }}>Connected</span>
            )}
          </div>
          <p style={{ fontFamily: MONO, fontSize: '0.6rem', color: TEXT_DIM, margin: 0 }}>
            Stored in your browser only.
          </p>
        </div>
      </div>

      {/* Input Fields */}
      {tool.fields.map((f) => (
        <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={label}>{f.label}</label>
          {f.rows === 1 ? (
            <input
              value={values[f.key] || ""}
              onChange={(e) => handleChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              style={{ ...inputBase, resize: 'none', lineHeight: 'normal' }}
              onFocus={(e) => (e.target.style.borderColor = `rgba(6,182,212,0.4)`)}
              onBlur={(e)  => (e.target.style.borderColor = BORDER)}
            />
          ) : (
            <textarea
              value={values[f.key] || ""}
              onChange={(e) => handleChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={f.rows}
              style={inputBase}
              onFocus={(e) => (e.target.style.borderColor = `rgba(6,182,212,0.4)`)}
              onBlur={(e)  => (e.target.style.borderColor = BORDER)}
            />
          )}
        </div>
      ))}

      {hasDraft && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: MONO, fontSize: '0.65rem', color: TEXT_DIM }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
          Draft saved locally
        </div>
      )}

      {/* Run button */}
      <button
        onClick={run}
        disabled={loading || !isReady || !openRouterKey}
        style={{
          fontFamily: MONO,
          fontSize: '0.7rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '10px 20px',
          borderRadius: '4px',
          border: 'none',
          background: (loading || !isReady || !openRouterKey) ? SURFACE : PURPLE,
          color:  (loading || !isReady || !openRouterKey) ? TEXT_LO : '#fff',
          cursor: (loading || !isReady || !openRouterKey) ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'background 0.15s',
        }}
      >
        {loading ? (
          <>
            <span style={{ display: 'inline-block', animation: 'ai-spin 1s linear infinite', fontSize: '14px', lineHeight: 1 }}>+</span>
            Generating...
          </>
        ) : (
          `Run — ${tool.title}`
        )}
      </button>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px', padding: '10px 14px', fontFamily: MONO, fontSize: '0.75rem', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* Output */}
      {output && (
        <div ref={outputRef} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={label}>Output</span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={copy} style={btn(copied ? { color: '#86efac', borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)' } : {})}>
                {copied ? "Copied" : "Copy"}
              </button>
              <button onClick={downloadOutput} style={btn()}>Download</button>
              <button onClick={handleSaveOutput} disabled={saving} style={btn({ opacity: saving ? 0.5 : 1 })}>
                {saving ? "Saving..." : "Save to History"}
              </button>
            </div>
          </div>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '20px', color: TEXT_MID, fontSize: '0.85rem', lineHeight: '1.75', maxHeight: '480px', overflowY: 'auto' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({node, ...p}) => <h1 style={{ fontFamily: "'Syne', sans-serif", color: TEXT_HI, fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px', borderBottom: `1px solid ${BORDER}`, paddingBottom: '8px' }} {...p} />,
                h2: ({node, ...p}) => <h2 style={{ fontFamily: MONO, color: TEXT_HI, fontSize: '0.8rem', fontWeight: 700, margin: '20px 0 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }} {...p} />,
                h3: ({node, ...p}) => <h3 style={{ fontFamily: MONO, color: TEXT_MID, fontSize: '0.7rem', fontWeight: 700, margin: '16px 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }} {...p} />,
                p:  ({node, ...p}) => <p  style={{ margin: '0 0 12px', lineHeight: '1.75' }} {...p} />,
                li: ({node, ...p}) => <li style={{ marginBottom: '6px', lineHeight: '1.6' }} {...p} />,
                ul: ({node, ...p}) => <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }} {...p} />,
                ol: ({node, ...p}) => <ol style={{ paddingLeft: '20px', margin: '0 0 12px' }} {...p} />,
                strong: ({node, ...p}) => <strong style={{ color: TEAL, fontWeight: 700 }} {...p} />,
                code: ({node, ...p}) => <code style={{ background: BORDER, color: '#67e8f9', padding: '2px 6px', borderRadius: '3px', fontSize: '0.75rem', fontFamily: MONO }} {...p} />,
                table: ({node, ...p}) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: '12px 0', fontSize: '0.75rem' }} {...p} />,
                th: ({node, ...p}) => <th style={{ background: `rgba(6,182,212,0.06)`, color: TEAL, padding: '7px 10px', textAlign: 'left', borderBottom: `1px solid ${BORDER}`, fontFamily: MONO, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em' }} {...p} />,
                td: ({node, ...p}) => <td style={{ padding: '7px 10px', borderBottom: `1px solid ${BORDER}`, color: TEXT_MID, verticalAlign: 'top' }} {...p} />,
                blockquote: ({node, ...p}) => <blockquote style={{ borderLeft: `3px solid ${PURPLE}`, paddingLeft: '12px', margin: '12px 0', color: TEXT_MID, fontStyle: 'italic' }} {...p} />,
              }}
            >
              {output}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Output History */}
      <div style={{ marginTop: '8px', borderTop: `1px solid ${BORDER}`, paddingTop: '20px' }}>
        <h3 style={{ fontFamily: MONO, fontSize: '0.65rem', color: TEXT_LO, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Saved Outputs</h3>
        {outputsLoading ? (
          <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: TEXT_DIM }}>Loading...</span>
        ) : outputs.length === 0 ? (
          <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: TEXT_LO }}>No saved outputs yet.</span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {outputs.map((out) => (
              <div key={out.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: SURFACE, padding: "8px 12px", borderRadius: "4px", border: `1px solid ${BORDER}` }}>
                <div style={{ display: "flex", flexDirection: "column", gap: '2px' }}>
                  <span style={{ fontFamily: MONO, fontSize: '0.7rem', color: TEXT_HI }}>{out.tool_name}</span>
                  <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: TEXT_DIM }}>{new Date(out.created_at).toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => { setOutput(out.content); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    style={btn({ fontSize: '0.6rem', padding: '3px 8px' })}
                  >
                    View
                  </button>
                  <button
                    onClick={() => deleteOutput(out.id)}
                    style={btn({ fontSize: '0.6rem', padding: '3px 8px', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.25)' })}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 6. MAIN COMPONENT
// -----------------------------------------------------------------------------
export default function ResumeAIAssistant({ user }) {
  const [active, setActive] = useState(0);

  if (!user) {
    return (
      <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: MONO, fontSize: '0.75rem', color: TEXT_DIM }}>Sign in to use the AI Assistant.</p>
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: MONO, color: TEXT_HI, padding: "32px 24px" }}>
      <style>{`
        @keyframes ai-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <div style={{ maxWidth: "1420px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1rem', fontWeight: 700, margin: '0 0 6px', color: TEXT_HI, textTransform: 'uppercase' }}>
            Resume AI Assistant
          </h1>
          <p style={{ fontFamily: MONO, fontSize: '0.7rem', color: TEXT_LO, margin: 0 }}>
            10 tools — CV tailoring, cover letters, ATS alignment, interview prep
          </p>
        </div>

        <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* Sidebar */}
          <div style={{ width: "240px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px" }}>

            {/* How it works */}
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '12px' }}>
              <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: TEAL, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>How it works</p>
              {['Select a tool', 'Fill required fields', 'Choose AI model', 'Run', 'Save to history'].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', fontFamily: MONO, fontSize: '0.65rem', color: TEXT_MID, marginBottom: '4px' }}>
                  <span style={{ color: TEXT_LO, minWidth: '14px' }}>{i + 1}.</span>
                  {step}
                </div>
              ))}
            </div>

            {/* Tool list */}
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '6px', position: "sticky", top: "24px" }}>
              {TOOLS.map((tool, i) => (
                <button
                  key={tool.id}
                  onClick={() => setActive(i)}
                  style={{
                    width: "100%",
                    background: active === i ? `rgba(139,92,246,0.12)` : "transparent",
                    border: active === i ? `1px solid rgba(139,92,246,0.25)` : "1px solid transparent",
                    borderRadius: "3px",
                    padding: "8px 10px",
                    textAlign: "left",
                    cursor: "pointer",
                    color: active === i ? '#c4b5fd' : TEXT_DIM,
                    fontFamily: MONO,
                    fontSize: "0.7rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.12s",
                    marginBottom: "2px",
                  }}
                >
                  <span style={{ color: active === i ? PURPLE : BORDER2, fontSize: '0.6rem', minWidth: '26px' }}>
                    {String(tool.id).padStart(2, '0')}
                  </span>
                  {tool.title}
                </button>
              ))}
            </div>
          </div>

          {/* Main panel */}
          <div
            key={active}
            style={{
              flex: 1,
              minWidth: "320px",
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: '4px',
              padding: "28px",
            }}
          >
            {/* Panel header */}
            <div style={{ marginBottom: "24px", paddingBottom: "18px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontFamily: MONO, fontSize: '0.6rem', letterSpacing: '0.08em', color: TEXT_LO }}>
                  TOOL {String(TOOLS[active].id).padStart(2, '0')} / 10
                </span>
                <span style={{ fontFamily: MONO, fontSize: '0.6rem', letterSpacing: '0.1em', padding: '2px 7px', background: `rgba(139,92,246,0.1)`, border: `1px solid rgba(139,92,246,0.2)`, borderRadius: '3px', color: '#c4b5fd' }}>
                  {TOOLS[active].tag}
                </span>
              </div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.15rem", fontWeight: 800, margin: "0 0 4px", color: TEXT_HI }}>
                {TOOLS[active].title}
              </h2>
              <p style={{ fontFamily: MONO, fontSize: '0.72rem', color: TEXT_LO, margin: 0 }}>
                {TOOLS[active].description}
              </p>
            </div>

            <ToolPanel tool={TOOLS[active]} user={user} />
          </div>
        </div>
      </div>
    </div>
  );
}
