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
import { getRecommendedModel }            from "../ai/modelRouter";

// -----------------------------------------------------------------------------
// SUPABASE MIGRATION
// -----------------------------------------------------------------------------
// Run this in your Supabase SQL Editor to enable result storage:
// 
// create table generated_outputs (
//   id uuid default gen_random_uuid() primary key,
//   user_id uuid references auth.users(id) not null,
//   tool_name text not null,
//   content text not null,
//   created_at timestamp with time zone default now()
// );
// alter table generated_outputs enable row level security;
// create policy "Users can manage own outputs" on generated_outputs
//   for all using (auth.uid() = user_id);

// -----------------------------------------------------------------------------
// 1. TOOL CONFIGURATION
// -----------------------------------------------------------------------------
const TOOLS = [
  { id: 1, title: "Decode Job Description", icon: "🔍", description: "Extract key skills, ATS keywords, and hiring goals from a JD",
    fields: [{ key: "jd", label: "Job Description", placeholder: "Paste the full job description here...", rows: 10 }],
    buildPrompt: buildDecodeJDPrompt },

  { id: 2, title: "Tailor Your CV", icon: "✏️", description: "Rewrite your CV to match the role without fabricating experience",
    fields: [{ key: "cv", label: "Your CV", placeholder: "Paste your full CV here...", rows: 10 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildTailorCVPrompt },

  { id: 3, title: "Strengthen Bullet Points", icon: "💪", description: "Rewrite bullets using action + task + result format",
    fields: [{ key: "role", label: "Job Title / Role", placeholder: "e.g. Senior Product Manager", rows: 1 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }, { key: "bullets", label: "Your Current Bullets", placeholder: "Paste your existing CV bullets here...", rows: 6 }],
    buildPrompt: buildStrengthenBulletsPrompt },

  { id: 4, title: "Write a Cover Letter", icon: "📝", description: "Generate a tailored, natural cover letter from your background",
    fields: [{ key: "background", label: "Your Background", placeholder: "Paste your CV or career summary here...", rows: 8 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildCoverLetterPrompt },

  { id: 5, title: "Assess Role Fit", icon: "📊", description: "Compare your background to the JD with a role-fit matrix",
    fields: [{ key: "background", label: "Your Background", placeholder: "Paste your CV or career summary here...", rows: 8 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildAssessFitPrompt },

  { id: 6, title: "Improve ATS Alignment", icon: "🎯", description: "Find missing keywords, weak areas, and ATS issues",
    fields: [{ key: "cv", label: "Your CV", placeholder: "Paste your full CV here...", rows: 10 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildATSAlignmentPrompt },

  { id: 7, title: "Predict Interview Questions", icon: "🧠", description: "Generate 15 likely interview questions grouped by type",
    fields: [{ key: "background", label: "Your Background", placeholder: "Paste your CV or career summary here...", rows: 8 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildInterviewQuestionsPrompt },

  { id: 8, title: "Build STAR Answers", icon: "⭐", description: "Create 8 STAR interview answers covering key competencies",
    fields: [{ key: "background", label: "Your Background", placeholder: "Paste your CV or career summary here...", rows: 8 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildSTARAnswersPrompt },

  { id: 9, title: "Recruiter-Style Review", icon: "👔", description: "Get a shortlist/maybe/reject verdict with actionable feedback",
    fields: [{ key: "cv", label: "Your CV", placeholder: "Paste your full CV here...", rows: 8 }, { key: "cover", label: "Cover Letter", placeholder: "Paste your cover letter here...", rows: 6 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildRecruiterReviewPrompt },

  { id: 10, title: "Full Application Pack", icon: "📦", description: "Generate a complete application pack: CV, cover letter, questions & more",
    fields: [{ key: "background", label: "Your Background", placeholder: "Paste your CV or career summary here...", rows: 8 }, { key: "jd", label: "Job Description", placeholder: "Paste the job description here...", rows: 6 }],
    buildPrompt: buildFullApplicationPackPrompt },
];
// -----------------------------------------------------------------------------
// 2. CUSTOM HOOKS
// -----------------------------------------------------------------------------


const useOpenRouterKey = () => {
  const [key, setKey] = useState("");
  useEffect(() => {
    const stored = sessionStorage.getItem("openrouter_api_key");
    if (stored) setKey(stored);
  }, []);
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "openrouter_api_key") {
        setKey(e.newValue || "");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
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
    const newResume = { name, content, user_id: user.id };
    const { data, error } = await supabase
      .from("resume_versions")
      .insert([newResume])
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
    setResumes((prev) => {
      return prev.filter((r) => r.id !== id);
    });
    setActiveResumeId((prev) => (prev === id ? null : prev));
  };

  return { resumes, activeResumeId, setActiveResumeId, saveResume, deleteResume, loading };
};

// Hook for Generated Outputs
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
// 3. TOOL PANEL COMPONENT
// -----------------------------------------------------------------------------
function ToolPanel({ tool, user }) {
  const {
  values,
  setValues,
  output,
  setOutput,
  clearState,
} = usePersistentToolState(tool.id);

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  
  const FREE_MODELS = [
  {
    label: "Auto Free Router",
    value: "openrouter/free",
  },
  {
    label: "Gemma 3 27B",
    value: "google/gemma-3-27b-it:free",
  },
  {
    label: "DeepSeek Chat V3",
    value: "deepseek/deepseek-chat-v3-0324:free",
  },
  {
    label: "Llama 4 Maverick",
    value: "meta-llama/llama-4-maverick:free",
  },
  {
    label: "Qwen 235B",
    value: "qwen/qwen3-235b-a22b:free",
  },
  {
    label: "Devstral Small",
    value: "mistralai/devstral-small:free",
  },
  {
    label: "DeepSeek R1",
    value: "deepseek/deepseek-r1:free",
  },
  {
    label: "GLM 4.5 Air",
    value: "z-ai/glm-4.5-air:free",
  },
  {
    label: "Gemini Flash 1.5",
    value: "google/gemini-flash-1.5:free",
  },
  {
    label: "Hermes 3 Llama 70B",
    value: "nousresearch/hermes-3-llama-3.1-70b:free",
  },
];

const [model, setModel] = useState("openrouter/free");
  
  
  
  
  const [openRouterKey, setOpenRouterKey] = useOpenRouterKey();
  const [saving, setSaving] = useState(false);
  
  const { resumes, activeResumeId, setActiveResumeId, saveResume, deleteResume, loading: resumesLoading } = useResumes(user);
  const { saveOutput, deleteOutput, outputs, loading: outputsLoading } = useOutputHistory(user);

  const outputRef = useRef(null);
  const activeResume = resumes.find((r) => r.id === activeResumeId);

  const handleChange = (key, val) => setValues((v) => ({ ...v, [key]: val }));

  const isReady = tool.fields.every((f) => (values[f.key] || "").trim().length > 0);
  const hasDraft = Object.values(values).some((v) => (v || "").trim().length > 0);
  
  const hasOpenRouterKey = !!openRouterKey;

  const run = async () => {
  setLoading(true);
  setError("");
  setOutput("");

  try {
    if (!openRouterKey) {
      throw new Error("OpenRouter API key required");
    }

    // Build optimized prompt
 const prompt = tool.buildPrompt(values);

    // Call centralized AI client
  const raw = await callAI({
  apiKey: openRouterKey,
  model,
  userPrompt: prompt,
});

    // Format response
    const formatted = formatOutput({
      toolId: tool.id,
      content: raw,
    });

    // Persist output
    setOutput(formatted);

    // Smooth scroll to result
    setTimeout(() => {
      outputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);

  } catch (err) {
    console.error(err);

    setError(
      err.message || "AI request failed"
    );
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tool.title.replace(/\s+/g, "_").toLowerCase()}_output.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveOutput = async () => {
    if (!output) return;
    setSaving(true);
    try {
      await saveOutput(tool.title, output);
      alert("Output saved to history!");
    } catch (e) {
      alert("Failed to save: " + e.message);
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
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* Resume Manager */}
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", padding: "12px", marginBottom: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Resume Library</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={saveCurrentAsResume} disabled={!isReady} style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}>💾 Save Current</button>
            <button onClick={loadResumeIntoTool} disabled={!activeResume} style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}>📂 Load</button>
          </div>
        </div>
        {resumesLoading ? (
          <div style={{ fontSize: "12px", color: "#64748b" }}>Loading resumes...</div>
        ) : (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {resumes.length === 0 && <span style={{ fontSize: "12px", color: "#475569" }}>No saved resumes</span>}
            {resumes.map((r) => (
              <button key={r.id} onClick={() => setActiveResumeId(r.id)} style={{ background: activeResumeId === r.id ? "#1e40af" : "#1e293b", color: activeResumeId === r.id ? "#fff" : "#94a3b8", border: "1px solid #334155", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                {r.name}
                <span onClick={(e) => { e.stopPropagation(); deleteResume(r.id); }} style={{ cursor: "pointer", opacity: 0.7 }}>✕</span>
              </button>
            ))}
          </div>
        )}
      </div>
<div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm backdrop-blur">
  <p className="opacity-80">
    AI features require an OpenRouter API key.
  </p>

  <a
    href="https://openrouter.ai/keys"
    target="_blank"
    rel="noopener noreferrer"
    className="mt-2 inline-flex items-center gap-2 font-medium underline underline-offset-4 opacity-90 hover:opacity-100"
  >
    Get a free OpenRouter key →
  </a>
</div>
     {/* Model Selector + API Key */}
<div
  style={{
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "12px",
  }}
>
  <span
    style={{
      fontSize: "12px",
      color: "#94a3b8",
      fontWeight: 700,
      letterSpacing: "0.08em",
    }}
  >
    MODEL
  </span>

  <select
    value={model}
    onChange={(e) => setModel(e.target.value)}
    style={{
      background: "#0f172a",
      color: "#e2e8f0",
      border: "1px solid #1e293b",
      borderRadius: "8px",
      padding: "8px 12px",
      fontSize: "12px",
      minWidth: "260px",
      outline: "none",
      cursor: "pointer",
    }}
  >
    {FREE_MODELS.map((m) => (
      <option key={m.value} value={m.value}>
        {m.label}
      </option>
    ))}
  </select>
<div style={{
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "11px",
  fontFamily: "'IBM Plex Mono', monospace",
  letterSpacing: "0.06em",
  color: "#94a3b8",
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "6px",
  padding: "6px 10px",
  whiteSpace: "nowrap",
}}>
  <span style={{
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: loading ? "#fbbf24" : "#4ade80",
    flexShrink: 0,
    transition: "background 0.3s",
  }} />
  {loading
    ? `Running on ${FREE_MODELS.find(m => m.value === model)?.label ?? model}`
    : `Model: ${FREE_MODELS.find(m => m.value === model)?.label ?? model}`
  }
</div>
<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginLeft: "auto",
    minWidth: "260px",
  }}
>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
    }}
  >
    <span
      style={{
        fontSize: "11px",
        color: "#94a3b8",
      }}
    >
      OPENROUTER API KEY:
    </span>

    <input
      type="password"
      value={openRouterKey}
      onChange={(e) => {
        const val = e.target.value;

        setOpenRouterKey(val);

        sessionStorage.setItem(
          "openrouter_api_key",
          val
        );
      }}
      placeholder="or-sk-..."
      style={{
        background: "#0f172a",
        color: "#e2e8f0",
        border: "1px solid #1e293b",
        borderRadius: "6px",
        padding: "6px",
        fontSize: "11px",
        width: "220px",
        outline: "none",
      }}
    />

    {openRouterKey && (
      <span
        style={{
          color: "#4ade80",
          fontSize: "11px",
          whiteSpace: "nowrap",
        }}
      >
        ✓ Connected
      </span>
    )}
  </div>

  <p
    style={{
      fontSize: "10px",
      color: "#64748b",
      margin: 0,
      lineHeight: 1.4,
    }}
  >
    Your API key stays in your browser session and is never stored on our servers.
  </p>
</div>
</div>

      {/* Input Fields */}
      {tool.fields.map((f) => (
        <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8" }}>{f.label}</label>
          {f.rows === 1 ? (
            <input value={values[f.key] || ""} onChange={(e) => handleChange(f.key, e.target.value)} placeholder={f.placeholder} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", padding: "10px 14px", color: "#e2e8f0", fontSize: "14px", outline: "none", fontFamily: "inherit", transition: "border-color 0.2s" }} onFocus={(e) => (e.target.style.borderColor = "#3b82f6")} onBlur={(e) => (e.target.style.borderColor = "#1e293b")} />
          ) : (
            <textarea value={values[f.key] || ""} onChange={(e) => handleChange(f.key, e.target.value)} placeholder={f.placeholder} rows={f.rows} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", padding: "10px 14px", color: "#e2e8f0", fontSize: "13px", outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: "1.6", transition: "border-color 0.2s" }} onFocus={(e) => (e.target.style.borderColor = "#3b82f6")} onBlur={(e) => (e.target.style.borderColor = "#1e293b")} />
          )}
        </div>
      ))}
{hasDraft && (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    color: "#4ade80",
    fontFamily: "'IBM Plex Mono', monospace",
    letterSpacing: "0.06em",
  }}>
    <span style={{
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "#4ade80",
      flexShrink: 0,
    }} />
    Draft saved locally
  </div>
)}
      {/* Action Button */}
      <button
  onClick={run}
  disabled={loading || !isReady || !openRouterKey}
  style={{
    background:
      loading || !isReady || !openRouterKey
        ? "#1e293b"
        : "linear-gradient(135deg, #3b82f6, #6366f1)",

    color:
      loading || !isReady || !openRouterKey
        ? "#475569"
        : "#fff",

    border: "none",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,

    cursor:
      loading || !isReady || !openRouterKey
        ? "not-allowed"
        : "pointer",

    letterSpacing: "0.04em",
    transition: "all 0.2s",
    alignSelf: "flex-start",

    display: "flex",
    alignItems: "center",
    gap: "8px",
  }}
>
  {loading ? (
    <>
      <span
        style={{
          display: "inline-block",
          animation: "spin 1s linear infinite",
          fontSize: "16px",
        }}
      >
        ⟳
      </span>

      Generating...
    </>
  ) : (
    <>
      {tool.icon} Run {tool.title}
    </>
  )}
</button>

      {error && (
        <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: "8px", padding: "12px 16px", color: "#fca5a5", fontSize: "13px" }}>⚠️ {error}</div>
      )}

      {output && (
        <div ref={outputRef} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8" }}>Output</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={copy} style={{ background: copied ? "#14532d" : "#1e293b", color: copied ? "#86efac" : "#94a3b8", border: "1px solid " + (copied ? "#166534" : "#334155"), borderRadius: "6px", padding: "5px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, transition: "all 0.2s" }}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
              <button onClick={downloadOutput} style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: "6px", padding: "5px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, transition: "all 0.2s" }}>
                📥 Download
              </button>
              <button onClick={handleSaveOutput} disabled={saving} style={{ background: saving ? "#334155" : "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: "6px", padding: "5px 12px", fontSize: "12px", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 600, transition: "all 0.2s" }}>
                {saving ? "Saving..." : "💾 Save to History"}
              </button>
            </div>
          </div>
          <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: "10px", padding: "20px", color: "#cbd5e1", fontSize: "13.5px", lineHeight: "1.75", maxHeight: "480px", overflowY: "auto" }}>
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      h1: ({node, ...p}) => <h1 style={{color:'#f1f5f9',fontSize:'18px',fontWeight:800,marginBottom:'12px',borderBottom:'1px solid #1e293b',paddingBottom:'8px'}} {...p}/>,
      h2: ({node, ...p}) => <h2 style={{color:'#e2e8f0',fontSize:'15px',fontWeight:700,margin:'20px 0 8px'}} {...p}/>,
      h3: ({node, ...p}) => <h3 style={{color:'#cbd5e1',fontSize:'13px',fontWeight:700,margin:'16px 0 6px',textTransform:'uppercase',letterSpacing:'0.06em'}} {...p}/>,
      p:  ({node, ...p}) => <p  style={{margin:'0 0 12px',lineHeight:'1.75'}} {...p}/>,
      li: ({node, ...p}) => <li style={{marginBottom:'6px',lineHeight:'1.6'}} {...p}/>,
      ul: ({node, ...p}) => <ul style={{paddingLeft:'20px',margin:'0 0 12px'}} {...p}/>,
      ol: ({node, ...p}) => <ol style={{paddingLeft:'20px',margin:'0 0 12px'}} {...p}/>,
      strong: ({node, ...p}) => <strong style={{color:'#93c5fd',fontWeight:700}} {...p}/>,
      code: ({node, ...p}) => <code style={{background:'#1e293b',color:'#7eeae4',padding:'2px 6px',borderRadius:'4px',fontSize:'12px',fontFamily:'monospace'}} {...p}/>,
      table: ({node, ...p}) => <table style={{width:'100%',borderCollapse:'collapse',margin:'12px 0',fontSize:'12px'}} {...p}/>,
      th: ({node, ...p}) => <th style={{background:'#1e293b',color:'#93c5fd',padding:'8px 12px',textAlign:'left',borderBottom:'1px solid #334155',fontWeight:700,fontSize:'11px',textTransform:'uppercase',letterSpacing:'0.06em'}} {...p}/>,
      td: ({node, ...p}) => <td style={{padding:'8px 12px',borderBottom:'1px solid #1e293b',color:'#cbd5e1',verticalAlign:'top'}} {...p}/>,
      blockquote: ({node, ...p}) => <blockquote style={{borderLeft:'3px solid #3b82f6',paddingLeft:'12px',margin:'12px 0',color:'#94a3b8',fontStyle:'italic'}} {...p}/>,
    }}
  >
    {output}
  </ReactMarkdown>
</div>
        </div>
      )}

      {/* Output History Section */}
      <div style={{ marginTop: "20px", borderTop: "1px solid #1e293b", paddingTop: "20px" }}>
        <h3 style={{ fontSize: "14px", color: "#e2e8f0", marginBottom: "10px" }}>Saved Outputs History</h3>
        {outputsLoading ? (
          <div style={{ fontSize: "12px", color: "#64748b" }}>Loading history...</div>
        ) : outputs.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#475569" }}>No saved outputs yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {outputs.map((out) => (
              <div key={out.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f172a", padding: "8px 12px", borderRadius: "6px", border: "1px solid #1e293b" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#e2e8f0" }}>{out.tool_name}</span>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>{new Date(out.created_at).toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => { setOutput(out.content); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ fontSize: "10px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}>View</button>
                  <button onClick={() => deleteOutput(out.id)} style={{ fontSize: "10px", background: "#450a0a", color: "#fca5a5", border: "1px solid #7f1d1d", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}>Delete</button>
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
// 4. MAIN APP COMPONENT
// -----------------------------------------------------------------------------
export default function ResumeAIAssistant({ user }) {
  const [active, setActive] = useState(0);

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#020817", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: "#e2e8f0", padding: "32px 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <p>Please log in to use the AI Assistant.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#020817", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: "#e2e8f0", padding: "32px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{ maxWidth: "1420px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "36px" }}>
          <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "8px"
  }}
>
            <div style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", borderRadius: "10px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>📄</div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "26px", fontWeight: 800, margin: 0, background: "linear-gradient(135deg, #e2e8f0, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Resume AI Assistant</h1>
          </div>
          <p style={{ color: "#475569", fontSize: "14px", margin: 0, paddingLeft: "52px" }}>10 AI-powered tools to optimize your applications, from CV tailoring to full application packs.</p>
        </div>
        <div
  style={{
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  }}
>
  {/* LEFT COLUMN */}
  <div
    style={{
      width: "260px",
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}
  >
    {/* QUICK UX FIX */}
    <div
      style={{
        padding: "12px",
        border: "1px solid #1e293b",
        borderRadius: "12px",
        background: "#0a0f1a",
        color: "#94a3b8",
        fontSize: "11px",
        lineHeight: "1.5",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: "#e2e8f0",
          marginBottom: "8px",
          fontSize: "12px",
        }}
      >
        How this works
      </div>

      <div>1. Select a tool</div>
      <div>2. Fill required fields</div>
      <div>3. Choose AI model</div>
      <div>4. Generate output</div>
      <div>5. Save to history</div>
    </div>

    {/* SIDEBAR */}
    <div
      style={{
        background: "#0a0f1a",
        border: "1px solid #1e293b",
        borderRadius: "12px",
        padding: "8px",
        position: "sticky",
        top: "24px",
      }}
    >
      {TOOLS.map((tool, i) => (
        <button
          key={tool.id}
          onClick={() => setActive(i)}
          style={{
            width: "100%",
            background:
              active === i
                ? "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))"
                : "transparent",

            border:
              active === i
                ? "1px solid rgba(99,102,241,0.3)"
                : "1px solid transparent",

            borderRadius: "8px",
            padding: "10px 12px",
            textAlign: "left",
            cursor: "pointer",

            color:
              active === i
                ? "#e2e8f0"
                : "#64748b",

            fontSize: "13px",
            fontWeight: active === i ? 600 : 400,
            fontFamily: "inherit",

            display: "flex",
            alignItems: "center",
            gap: "8px",

            transition: "all 0.15s",
            marginBottom: "2px",
          }}
        >
          <span
            style={{
              fontSize: "15px",
              flexShrink: 0,
            }}
          >
            {tool.icon}
          </span>

          <span
            style={{
              lineHeight: "1.3",
            }}
          >
            {tool.title}
          </span>
        </button>
      ))}
    </div>
  </div>

  {/* MAIN PANEL */}
  <div
    style={{
      flex: 1,
      minWidth: "320px",
      background: "#0a0f1a",
      border: "1px solid #1e293b",
      borderRadius: "12px",
      padding: "28px",
      animation: "fadeIn 0.25s ease",
    }}
    key={active}
  >
            <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid #1e293b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <span style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", fontWeight: 700, color: "#818cf8", letterSpacing: "0.06em" }}>TOOL {TOOLS[active].id} / 10</span>
              </div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, margin: "0 0 4px", color: "#f1f5f9" }}>
                {TOOLS[active].icon} {TOOLS[active].title}
              </h2>
              <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>{TOOLS[active].description}</p>
            </div>
            <ToolPanel tool={TOOLS[active]} user={user} />
          </div>
        </div>
      </div>
    </div>
  );
}