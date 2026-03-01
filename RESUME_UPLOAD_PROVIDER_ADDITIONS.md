# Resume Upload & Provider Switcher - Quick Integration Guide

## What to Add

You need to add two features to the AI ResumeAssembly component:

1. **Resume Upload** - Allow users to upload PDF/DOCX/TXT files
2. **AI Provider Switcher** - Toggle between Claude and Groq

## Step 1: Add Imports

At the top of `src/components/ResumeAssembly.jsx`, add:

```javascript
import { Upload } from 'lucide-react'; // Add Upload to existing imports
import { extractTextFromFile } from '../utils/smartResumeParser';
```

## Step 2: Add State Variables

In the component, add these state variables after the existing ones (around line 140):

```javascript
const [aiProvider, setAiProvider] = useState('claude'); // 'claude' | 'groq'
const [isUploading, setIsUploading] = useState(false);
const [uploadedResumeText, setUploadedResumeText] = useState('');
const fileInputRef = useRef(null);
```

## Step 3: Add Groq API Function

After the `callClaude` function (around line 60), add:

```javascript
// ─── Groq API call ───────────────────────────────────────────────────────────

async function callGroq(systemPrompt, userMessage) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('Groq API key not found. Please add VITE_GROQ_API_KEY to your .env.local file.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq API error ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─── AI Router ───────────────────────────────────────────────────────────────

async function callAI(systemPrompt, userMessage, provider = 'claude') {
  if (provider === 'groq') {
    return await callGroq(systemPrompt, userMessage);
  }
  return await callClaude(systemPrompt, userMessage);
}
```

## Step 4: Add Upload Handler

Add this function before `handleAnalyze` (around line 160):

```javascript
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
```

## Step 5: Update handleAnalyze to Use AI Router

In the `handleAnalyze` function, replace all `callClaude` calls with `callAI`:

```javascript
// Change this:
const jobSignalRaw = await callClaude(...)

// To this:
const jobSignalRaw = await callAI(..., aiProvider)
```

Do this for all 3 API calls in `handleAnalyze`.

## Step 6: Add Provider Switcher UI

In the render section, after the Step Bar and before the job input card (around line 700), add:

```javascript
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
```

## Step 7: Add Upload Button

In the job input card (around line 750), after the base resume selector, add:

```javascript
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
```

## Step 8: Update .env.local

Add Groq API key to `.env.local`:

```bash
VITE_GROQ_API_KEY=your_groq_api_key_here
```

Get your free Groq API key from: https://console.groq.com/

## Summary

These changes add:
- ✅ Resume upload (PDF/DOCX/TXT) with automatic parsing
- ✅ AI provider switcher (Claude vs Groq)
- ✅ Uploaded resumes automatically saved to database
- ✅ Provider selection persists during session

The upload uses your existing `smartResumeParser` and the provider switcher lets users choose between accuracy (Claude) and speed (Groq).

## Testing

1. Upload a resume - should parse and save automatically
2. Switch between Claude and Groq - should work for all 3 AI calls
3. Paste a job description - should generate customized resume using selected provider
