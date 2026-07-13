import { useState } from 'react';
import { whyThisFits } from '../agents/contextAssistant/whyThisFits';

interface Props {
  title: string;
  company: string;
  jd: string;
  accent?: string;
}

// On-demand "why this fits you" summary for a record. Generates only when the
// user clicks (no auto-fire, no API burn on open). Grounded via the CV-aware
// profile context; graceful no-key / error / loading states.
export default function WhyThisFits({ title, company, jd, accent = '#8b5cf6' }: Props) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    const hasKey = !!(localStorage.getItem('openrouter_api_key') || localStorage.getItem('groq_api_key'));
    if (!hasKey) {
      setError('Add an OpenRouter or Groq key in Settings to generate.');
      return;
    }
    setError('');
    setLoading(true);
    setSummary('');
    try {
      const text = await whyThisFits({ title, company, jd });
      setSummary((text || '').trim() || 'No summary produced.');
    } catch {
      setError('Could not generate — try again.');
    } finally {
      setLoading(false);
    }
  }

  const mono = "Space Mono, monospace";

  return (
    <div style={{ marginTop: '0.75rem' }}>
      {!summary && !loading && (
        <button
          onClick={generate}
          style={{
            background: 'transparent', border: `1px solid ${accent}55`, borderRadius: '3px',
            color: accent, cursor: 'pointer', fontFamily: mono, fontSize: '0.65rem',
            letterSpacing: '0.05em', padding: '4px 10px',
          }}
        >
          WHY THIS FITS YOU {error ? '↻' : '→'}
        </button>
      )}

      {loading && (
        <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#475569' }}>ASSESSING FIT…</div>
      )}

      {error && !loading && (
        <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#f59e0b', marginTop: '4px' }}>{error}</div>
      )}

      {summary && !loading && (
        <div style={{ background: `${accent}0d`, border: `1px solid ${accent}22`, borderRadius: '4px', padding: '10px 12px' }}>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '0.08em', color: accent, marginBottom: '6px' }}>
            WHY THIS FITS YOU
          </div>
          <div style={{ color: '#cbd5e1', fontSize: '0.8rem', lineHeight: 1.6 }}>{summary}</div>
          <button
            onClick={generate}
            style={{ marginTop: '8px', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontFamily: mono, fontSize: '0.6rem', padding: 0 }}
          >
            ↻ regenerate
          </button>
        </div>
      )}
    </div>
  );
}
