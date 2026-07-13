import { useState, useEffect } from 'react';
import { Search, Save, RotateCcw, Sparkles } from 'lucide-react';
import {
  loadSearchProfile,
  saveSearchProfile,
  resetSearchProfile,
  DEFAULT_SEARCH_PROFILE,
} from '../config/searchProfile';
import { refineSearchProfile } from '../agents/refineSearchProfile';

// Array fields are edited as comma-separated text for a lightweight UI.
const joinList = (arr) => (Array.isArray(arr) ? arr.join(', ') : '');
const splitList = (str) => str.split(',').map((s) => s.trim()).filter(Boolean);

function toForm(profile) {
  return {
    intentText: profile.intentText,
    preferredTitles: joinList(profile.preferredTitles),
    keywords: joinList(profile.keywords),
    antiSignals: joinList(profile.antiSignals),
    targetCompanyProfile: profile.targetCompanyProfile,
    locations: joinList(profile.locations),
    seniorityBand: profile.seniorityBand,
  };
}

function fromForm(form) {
  return {
    intentText: form.intentText.trim(),
    preferredTitles: splitList(form.preferredTitles),
    keywords: splitList(form.keywords),
    antiSignals: splitList(form.antiSignals),
    targetCompanyProfile: form.targetCompanyProfile.trim(),
    locations: splitList(form.locations),
    seniorityBand: form.seniorityBand.trim(),
  };
}

// "Tune my search" — an editable view of the user's SearchProfile. Self-contained:
// it owns its own load/save/reset and does not touch the API-key save flow.
export default function SearchProfilePanel() {
  const [form, setForm] = useState(() => toForm(loadSearchProfile()));
  const [saved, setSaved] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState('');

  useEffect(() => {
    setForm(toForm(loadSearchProfile()));
  }, []);

  const update = (field) => (e) => {
    const { value } = e.target;
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveSearchProfile(fromForm(form));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetSearchProfile();
    setForm(toForm(DEFAULT_SEARCH_PROFILE));
    setSaved(false);
  };

  // Compile the free-text intent into the structured fields via the model.
  // Populates the fields for review — does NOT save. On failure, leaves the
  // current field values intact and shows a non-blocking message.
  const handleRefine = async () => {
    const intent = form.intentText.trim();
    if (!intent || refining) return;
    const hasKey = !!(localStorage.getItem('openrouter_api_key') || localStorage.getItem('groq_api_key'));
    if (!hasKey) {
      setRefineError('Add an OpenRouter or Groq key in Settings to use Refine.');
      return;
    }
    setRefineError('');
    setRefining(true);
    try {
      const partial = await refineSearchProfile(intent);
      setForm((f) => ({
        ...f,
        preferredTitles: partial.preferredTitles?.length ? joinList(partial.preferredTitles) : f.preferredTitles,
        keywords: partial.keywords?.length ? joinList(partial.keywords) : f.keywords,
        antiSignals: partial.antiSignals?.length ? joinList(partial.antiSignals) : f.antiSignals,
        targetCompanyProfile: partial.targetCompanyProfile || f.targetCompanyProfile,
        locations: partial.locations?.length ? joinList(partial.locations) : f.locations,
        seniorityBand: partial.seniorityBand || f.seniorityBand,
      }));
      setSaved(false);
    } catch {
      setRefineError('Could not refine — check your key or try again.');
    } finally {
      setRefining(false);
    }
  };

  const textField = (field, label, placeholder, hint) => (
    <>
      <div className="api-settings-label" style={{ marginTop: '0.75rem' }}>
        <span>{label}</span>
      </div>
      <input
        type="text"
        className="api-settings-input"
        placeholder={placeholder}
        value={form[field]}
        onChange={update(field)}
      />
      {hint && <div className="api-settings-hint">{hint}</div>}
    </>
  );

  return (
    <div className="api-settings-section">
      <div className="api-settings-label">
        <span>
          <Search
            size={14}
            style={{ color: '#06b6d4', verticalAlign: 'middle', marginRight: '6px' }}
            aria-hidden="true"
          />
          Tune My Search
        </span>
      </div>
      <div className="api-settings-hint" style={{ marginBottom: '10px' }}>
        Describe the roles you want. This profile will shape which jobs Scout finds and how
        the Classifier scores them. Leave blank to use the defaults.
      </div>

      <div className="api-settings-label">
        <span>Search intent</span>
      </div>
      <textarea
        className="api-settings-input"
        rows={4}
        placeholder="e.g. Hands-on builder / IC roles at funded Berlin startups — AI, founding, product, or design engineer. Not people-management or Head-of roles."
        value={form.intentText}
        onChange={update('intentText')}
        style={{ resize: 'vertical', fontFamily: "'Space Mono', monospace" }}
      />

      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="api-settings-btn api-settings-btn-secondary"
          onClick={handleRefine}
          disabled={refining || !form.intentText.trim()}
          style={{ fontSize: '11px', padding: '6px 12px' }}
        >
          <Sparkles size={14} />
          {refining ? 'Refining…' : 'Refine with AI'}
        </button>
        <span className="api-settings-hint" style={{ margin: 0 }}>
          {refineError
            ? <span style={{ color: '#f59e0b' }}>{refineError}</span>
            : 'Turns your intent into the fields below — review before saving.'}
        </span>
      </div>

      {textField('preferredTitles', 'Preferred titles', 'UX Engineer, Design Engineer, ...', 'Comma-separated.')}
      {textField('keywords', 'Keywords', 'ai engineer, founding engineer, ...', "Comma-separated. Added to Scout's built-in role keywords.")}
      {textField('antiSignals', 'Anti-signals', 'people management, Head of, Director, ...', 'Comma-separated. Roles matching these are down-weighted.')}
      {textField('targetCompanyProfile', 'Target company profile', 'AI-native / AI-forward product teams', null)}
      {textField('locations', 'Locations', 'Berlin, Remote Europe, ...', 'Comma-separated.')}
      {textField('seniorityBand', 'Seniority band', 'mid–senior', null)}

      <div className="api-settings-actions" style={{ marginTop: '1rem' }}>
        <button
          className="api-settings-btn api-settings-btn-primary"
          onClick={handleSave}
          disabled={saved}
        >
          {saved ? (
            <>✓ Saved!</>
          ) : (
            <>
              <Save size={16} />
              Save Search Profile
            </>
          )}
        </button>
        <button className="api-settings-btn api-settings-btn-secondary" onClick={handleReset}>
          <RotateCcw size={16} />
          Reset to default
        </button>
      </div>
    </div>
  );
}
