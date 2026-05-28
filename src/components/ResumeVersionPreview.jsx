import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { fetchVersionModules } from '../utils/resumeDatabase';

// ── Shared style tokens (matches ResumeDiffViewer FullResumeView) ────────────

const bg = '#0a0a0f';
const sectionHead = {
  fontFamily: 'Space Mono, monospace',
  fontSize: '0.65rem',
  color: '#06b6d4',
  letterSpacing: '0.1em',
  marginBottom: '0.75rem',
  borderBottom: '1px solid rgba(6,182,212,0.2)',
  paddingBottom: '0.35rem',
};

// ── Section renderers ────────────────────────────────────────────────────────

function SummarySection({ content }) {
  if (!content?.text) return null;
  return (
    <section style={{ marginBottom: '1.75rem' }}>
      <h3 style={sectionHead}>SUMMARY</h3>
      <p style={{ fontSize: '0.875rem', color: '#e2e8f0', lineHeight: 1.7 }}>{content.text}</p>
    </section>
  );
}

function ExperienceSection({ modules }) {
  if (!modules?.length) return null;
  return (
    <section style={{ marginBottom: '1.75rem' }}>
      <h3 style={sectionHead}>EXPERIENCE</h3>
      {modules.map((mod, i) => {
        const c = mod.content;
        const dates = [c.startDate, c.endDate].filter(Boolean).join(' – ');
        return (
          <div key={i} style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.1rem' }}>{c.company}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#8b5cf6' }}>{c.position}</p>
              {dates && <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#475569' }}>{dates}</p>}
            </div>
            {c.location && (
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#475569', marginBottom: '0.35rem' }}>{c.location}</p>
            )}
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {(c.achievements || []).map((a, j) => (
                <li key={j} style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '0.2rem' }}>{a}</li>
              ))}
            </ul>
            {c.technologies?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem' }}>
                {c.technologies.map((t, j) => (
                  <span key={j} style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', padding: '0.15rem 0.5rem', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '3px', color: '#67e8f9' }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function SkillsSection({ modules }) {
  if (!modules?.length) return null;
  return (
    <section style={{ marginBottom: '1.75rem' }}>
      <h3 style={sectionHead}>SKILLS</h3>
      {modules.map((mod, i) => {
        const c = mod.content;
        return (
          <div key={i} style={{ marginBottom: '0.75rem' }}>
            {c.category && c.category !== 'technical' && c.category !== 'Technical Skills' && (
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#475569', marginBottom: '0.35rem', textTransform: 'uppercase' }}>{c.category}</p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {(c.skills || []).map((skill, j) => (
                <span key={j} style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', padding: '0.25rem 0.6rem', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '3px', color: '#c4b5fd' }}>{skill}</span>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function EducationSection({ modules }) {
  if (!modules?.length) return null;
  return (
    <section style={{ marginBottom: '1.75rem' }}>
      <h3 style={sectionHead}>EDUCATION</h3>
      {modules.map((mod, i) => {
        const c = mod.content;
        const meta = [c.field, c.startDate && c.endDate ? `${c.startDate} – ${c.endDate}` : (c.endDate || c.startDate)].filter(Boolean).join(' · ');
        return (
          <div key={i} style={{ marginBottom: '0.6rem' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>{c.degree}</p>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#64748b' }}>
              {c.institution}{meta ? ` · ${meta}` : ''}
            </p>
            {c.honors?.length > 0 && (
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#475569' }}>{c.honors.join(', ')}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}

function LanguagesSection({ modules }) {
  if (!modules?.length) return null;
  return (
    <section style={{ marginBottom: '1.75rem' }}>
      <h3 style={sectionHead}>LANGUAGES</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {modules.map((mod, i) => {
          const c = mod.content;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.7rem', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '3px' }}>
              <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>{c.language}</span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#475569' }}>{c.level}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CertificationSection({ modules }) {
  if (!modules?.length) return null;
  return (
    <section style={{ marginBottom: '1.75rem' }}>
      <h3 style={sectionHead}>CERTIFICATIONS</h3>
      {modules.map((mod, i) => {
        const c = mod.content;
        return (
          <div key={i} style={{ marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>{c.name}</p>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#64748b' }}>
              {[c.issuer, c.date].filter(Boolean).join(' · ')}
            </p>
          </div>
        );
      })}
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ResumeVersionPreview({ version, onClose }) {
  const [modules, setModules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!version?.id) return;
    setLoading(true);
    setError(null);
    fetchVersionModules(version.id)
      .then(setModules)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [version?.id]);

  const byType = (type) => (modules || []).filter(m => m.type === type);

  return (
    <div style={{ background: bg, border: '1px solid #1e1e2e', borderRadius: '6px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #1e1e2e' }}>
        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#e2e8f0' }}>{version.name}</p>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', maxWidth: '720px', width: '100%', margin: '0 auto' }}>
        {loading && (
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', color: '#475569', textAlign: 'center', paddingTop: '2rem' }}>
            LOADING...
          </p>
        )}
        {error && (
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', color: '#ef4444' }}>⚠ {error}</p>
        )}
        {!loading && !error && modules && (
          <>
            <SummarySection content={byType('summary')[0]?.content} />
            <ExperienceSection modules={byType('experience')} />
            <SkillsSection modules={byType('skills')} />
            <LanguagesSection modules={byType('language')} />
            <CertificationSection modules={byType('certification')} />
            <EducationSection modules={byType('education')} />
          </>
        )}
      </div>
    </div>
  );
}
