import React, { useState, useEffect } from 'react'
import { Edit2, Save, X, BookmarkPlus, Printer } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import type { TailoredResume } from '../../agents/types'
import {
  createResumeVersion,
  batchCreateModules,
  addModuleToVersion,
} from '../../utils/resumeDatabase'

interface Props {
  tailored: TailoredResume | null
  jobId: string
  onSaved?: () => void
}

function DiffRow({ field, original, tailored }: { field: string; original: string; tailored: string }) {
  return (
    <div style={{ marginBottom: '1rem', borderBottom: '1px solid #1e1e2e', paddingBottom: '1rem' }}>
      <p style={{ color: '#8b5cf6', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
        {field}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '0.5rem' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', color: '#ef4444', marginBottom: '0.25rem' }}>— ORIGINAL</p>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>{original}</p>
        </div>
        <div style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '4px', padding: '0.5rem' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', color: '#06b6d4', marginBottom: '0.25rem' }}>+ TAILORED</p>
          <p style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5 }}>{tailored}</p>
        </div>
      </div>
    </div>
  )
}

const sectionHead: React.CSSProperties = {
  fontFamily: 'Space Mono, monospace',
  fontSize: '0.65rem',
  color: '#06b6d4',
  letterSpacing: '0.1em',
  marginBottom: '0.75rem',
  borderBottom: '1px solid rgba(6,182,212,0.2)',
  paddingBottom: '0.35rem',
}

const textarea: React.CSSProperties = {
  width: '100%', background: '#0f0f1a', border: '1px solid #2d2d3f',
  borderRadius: '4px', color: '#e2e8f0', padding: '0.5rem 0.75rem',
  fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical',
  lineHeight: 1.6, boxSizing: 'border-box',
}

interface EditState {
  summary: string
  experience: Array<{ company: string; role: string; dates?: string; bullets: string[] }>
  skills: string // comma-separated for editing
}

function toEditState(t: TailoredResume): EditState {
  return {
    summary: t.summary,
    experience: t.experience.map(e => ({ ...e, bullets: [...e.bullets] })),
    skills: t.skills.join(', '),
  }
}

function printResume(resume: TailoredResume) {
  const c = resume.contact
  const header = c ? `
    <div class="header">
      <h1>${c.name ?? ''}</h1>
      <div class="contact-line">${[c.email, c.phone, c.location, c.linkedin, c.portfolio].filter(Boolean).join(' · ')}</div>
    </div>` : ''

  const summary = resume.summary ? `<section><h2>SUMMARY</h2><p>${resume.summary}</p></section>` : ''

  const experience = resume.experience?.length ? `
    <section>
      <h2>EXPERIENCE</h2>
      ${resume.experience.map(e => `
        <div class="role">
          <div class="role-header">
            <strong>${e.role}</strong> · ${e.company}
            <span class="dates">${e.dates ?? ''}</span>
          </div>
          <ul>${(e.bullets ?? []).map(b => `<li>${b}</li>`).join('')}</ul>
        </div>`).join('')}
    </section>` : ''

  const skills = resume.skills?.length ? `<section><h2>SKILLS</h2><p>${resume.skills.join(' · ')}</p></section>` : ''

  const education = resume.education?.length ? `
    <section>
      <h2>EDUCATION</h2>
      ${resume.education.map((e: { degree?: string; institution?: string; year?: string; location?: string }) =>
        `<div><strong>${e.degree ?? ''}</strong> · ${e.institution ?? ''} ${e.year ? `· ${e.year}` : ''}</div>`
      ).join('')}
    </section>` : ''

  const languages = resume.languages?.length ? `
    <section>
      <h2>LANGUAGES</h2>
      <p>${resume.languages.map((l: { language: string; level?: string }) => `${l.language}${l.level ? ` (${l.level})` : ''}`).join(' · ')}</p>
    </section>` : ''

  const win = window.open('', '_blank', 'width=900,height=1100')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Resume — ${c?.name ?? 'Tailored'}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 11pt; color: #111; padding: 48px 56px; max-width: 800px; margin: 0 auto; line-height: 1.5; }
      .header { text-align: center; margin-bottom: 20px; }
      .header h1 { font-size: 20pt; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
      .contact-line { font-size: 9pt; color: #555; margin-top: 4px; }
      section { margin-bottom: 18px; }
      h2 { font-size: 9pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; border-bottom: 1.5px solid #111; padding-bottom: 3px; margin-bottom: 10px; }
      .role { margin-bottom: 12px; }
      .role-header { display: flex; justify-content: space-between; font-size: 10.5pt; }
      .dates { font-size: 9.5pt; color: #555; white-space: nowrap; }
      ul { padding-left: 16px; margin-top: 4px; }
      li { margin-bottom: 3px; font-size: 10.5pt; }
      p { font-size: 10.5pt; }
      @media print { body { padding: 0; } @page { margin: 18mm 16mm; } }
    </style>
  </head><body>${header}${summary}${experience}${skills}${education}${languages}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

function FullResumeView({
  tailored, jobId, onSaved,
}: { tailored: TailoredResume; jobId: string; onSaved?: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<EditState>(() => toEditState(tailored))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [builderPrompt, setBuilderPrompt] = useState(false)
  const [versionName, setVersionName] = useState('')
  const [savingToBuilder, setSavingToBuilder] = useState(false)
  const [builderSuccess, setBuilderSuccess] = useState<string | null>(null)

  useEffect(() => {
    setDraft(toEditState(tailored))
    setEditing(false)
  }, [tailored])

  async function handleSaveToBuilder() {
    if (!versionName.trim()) return
    setSavingToBuilder(true)
    setBuilderSuccess(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Sign in via the main app (/) before saving to Resume Builder.')
        setSavingToBuilder(false)
        setBuilderPrompt(false)
        return
      }
      // Map tailored resume → resume builder module shapes
      const current = editing
        ? { ...tailored, summary: draft.summary, experience: draft.experience, skills: draft.skills.split(',').map(s => s.trim()).filter(Boolean) }
        : tailored

      const modules: Array<{ type: string; content: unknown }> = []

      modules.push({ type: 'summary', content: { text: current.summary } })

      for (const exp of current.experience) {
        const dates = (exp as typeof exp & { dates?: string }).dates ?? ''
        const [startDate = '', endDate = ''] = dates.split('–').map(s => s.trim())
        modules.push({
          type: 'experience',
          content: {
            company: exp.company,
            position: exp.role,
            location: '',
            startDate,
            endDate,
            achievements: exp.bullets,
            technologies: [],
          },
        })
      }

      if (current.skills.length > 0) {
        modules.push({ type: 'skills', content: { category: 'Technical Skills', skills: current.skills } })
      }

      for (const edu of current.education ?? []) {
        modules.push({
          type: 'education',
          content: {
            institution: edu.institution,
            degree: edu.degree,
            field: '',
            startDate: '',
            endDate: edu.year,
            gpa: '',
            honors: [],
          },
        })
      }

      if (current.languages && current.languages.length > 0) {
        modules.push({
          type: 'languages',
          content: { languages: current.languages },
        })
      }

      const createdModules = await batchCreateModules(modules) as Array<{ id: string }>
      const version = await createResumeVersion({ name: versionName.trim(), template_id: 'default' }) as { id: string }
      await Promise.all(
        createdModules.map((mod, i: number) =>
          addModuleToVersion(version.id, mod.id, i)
        )
      )

      setBuilderSuccess(`Saved as "${versionName.trim()}" in Resume Builder`)
      setBuilderPrompt(false)
      setVersionName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save to builder')
    } finally {
      setSavingToBuilder(false)
    }
  }

  function updateBullet(expIdx: number, bulletIdx: number, value: string) {
    setDraft(d => {
      const exp = d.experience.map((e, i) =>
        i === expIdx
          ? { ...e, bullets: e.bullets.map((b, j) => j === bulletIdx ? value : b) }
          : e
      )
      return { ...d, experience: exp }
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated: TailoredResume = {
        ...tailored,
        summary: draft.summary,
        experience: draft.experience,
        skills: draft.skills.split(',').map(s => s.trim()).filter(Boolean),
      }
      const { error: err } = await supabase.from('application_artifacts').insert({
        job_id: jobId,
        artifact_type: 'resume_tailored',
        content: updated,
        diff_from_base: updated.diff ?? null,
      })
      if (err) throw new Error(err.message)
      setEditing(false)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setDraft(toEditState(tailored))
    setEditing(false)
    setError(null)
  }

  const { contact, education, projects, languages, certifications } = tailored

  return (
    <div style={{ padding: '1.5rem', maxWidth: '720px' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {/* Print Resume */}
        {!editing && (
          <button
            onClick={() => printResume(tailored)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.9rem', background: 'transparent', border: '1px solid rgba(6,182,212,0.4)', borderRadius: '3px', color: '#06b6d4', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem' }}
          >
            <Printer size={12} /> PRINT / PDF
          </button>
        )}

        {/* Save to Resume Builder */}
        {!editing && (
          builderPrompt ? (
            <>
              <input
                autoFocus
                value={versionName}
                onChange={e => setVersionName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveToBuilder(); if (e.key === 'Escape') { setBuilderPrompt(false); setVersionName('') } }}
                placeholder="Version name (e.g. Talon.one — UX Engineer)"
                style={{ padding: '0.35rem 0.6rem', background: '#0f0f1a', border: '1px solid #2d2d3f', borderRadius: '3px', color: '#e2e8f0', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', width: '260px' }}
              />
              <button onClick={() => { setBuilderPrompt(false); setVersionName('') }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.7rem', background: 'transparent', border: '1px solid #1e1e2e', borderRadius: '3px', color: '#475569', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem' }}>
                <X size={12} />
              </button>
              <button onClick={handleSaveToBuilder} disabled={savingToBuilder || !versionName.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.9rem', background: '#22c55e', border: 'none', borderRadius: '3px', color: '#000', cursor: savingToBuilder ? 'not-allowed' : 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', fontWeight: 700 }}>
                <BookmarkPlus size={12} /> {savingToBuilder ? 'SAVING...' : 'SAVE'}
              </button>
            </>
          ) : (
            <button onClick={() => setBuilderPrompt(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.9rem', background: 'transparent', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '3px', color: '#22c55e', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem' }}>
              <BookmarkPlus size={12} /> SAVE TO BUILDER
            </button>
          )
        )}

        {/* Edit / Save / Cancel */}
        {editing ? (
          <>
            <button onClick={handleCancel} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.9rem', background: 'transparent', border: '1px solid #1e1e2e', borderRadius: '3px', color: '#475569', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem' }}>
              <X size={12} /> CANCEL
            </button>
            <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.9rem', background: '#06b6d4', border: 'none', borderRadius: '3px', color: '#000', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', fontWeight: 700 }}>
              <Save size={12} /> {saving ? 'SAVING...' : 'SAVE'}
            </button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.9rem', background: 'transparent', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '3px', color: '#8b5cf6', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem' }}>
            <Edit2 size={12} /> EDIT
          </button>
        )}
      </div>

      {builderSuccess && (
        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#22c55e', marginBottom: '0.75rem' }}>✓ {builderSuccess}</p>
      )}
      {error && <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#ef4444', marginBottom: '0.75rem' }}>⚠ {error}</p>}

      {/* Contact — always read-only */}
      {contact && (
        <section style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.25rem' }}>{contact.name}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#64748b' }}>
            {contact.location && <span>{contact.location}</span>}
            {contact.email && <a href={`mailto:${contact.email}`} style={{ color: '#06b6d4', textDecoration: 'none' }}>{contact.email}</a>}
            {contact.linkedin && <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4', textDecoration: 'none' }}>LinkedIn ↗</a>}
            {contact.portfolio && <a href={contact.portfolio} target="_blank" rel="noopener noreferrer" style={{ color: '#f97316', textDecoration: 'none' }}>{contact.portfolio} ↗</a>}
            {contact.phone && <span>{contact.phone}</span>}
          </div>
        </section>
      )}

      {/* Summary */}
      <section style={{ marginBottom: '1.75rem' }}>
        <h3 style={sectionHead}>SUMMARY</h3>
        {editing ? (
          <textarea rows={4} value={draft.summary} onChange={e => setDraft(d => ({ ...d, summary: e.target.value }))} style={textarea} />
        ) : (
          <p style={{ fontSize: '0.875rem', color: '#e2e8f0', lineHeight: 1.7 }}>{draft.summary}</p>
        )}
      </section>

      {/* Experience */}
      <section style={{ marginBottom: '1.75rem' }}>
        <h3 style={sectionHead}>EXPERIENCE</h3>
        {draft.experience.map((exp, i) => (
          <div key={i} style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.1rem' }}>{exp.company}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#8b5cf6' }}>{exp.role}</p>
              {exp.dates && <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#475569' }}>{exp.dates}</p>}
            </div>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '0.75rem', borderLeft: '2px solid #1e1e2e' }}>
                {exp.bullets.map((bullet, j) => (
                  <textarea
                    key={j}
                    rows={2}
                    value={bullet}
                    onChange={e => updateBullet(i, j, e.target.value)}
                    style={{ ...textarea, fontSize: '0.825rem' }}
                  />
                ))}
              </div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {exp.bullets.map((bullet, j) => (
                  <li key={j} style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '0.2rem' }}>{bullet}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      {/* Skills */}
      {draft.skills && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h3 style={sectionHead}>SKILLS</h3>
          {editing ? (
            <textarea
              rows={3}
              value={draft.skills}
              onChange={e => setDraft(d => ({ ...d, skills: e.target.value }))}
              placeholder="Comma-separated skills"
              style={textarea}
            />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {draft.skills.split(',').map(s => s.trim()).filter(Boolean).map((skill, i) => (
                <span key={i} style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', padding: '0.25rem 0.6rem', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '3px', color: '#c4b5fd' }}>
                  {skill}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Languages — read-only */}
      {languages && languages.length > 0 && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h3 style={sectionHead}>LANGUAGES</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {languages.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.7rem', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '3px' }}>
                <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>{l.language}</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#475569' }}>{l.level}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Certifications — read-only */}
      {certifications && certifications.length > 0 && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h3 style={sectionHead}>CERTIFICATIONS</h3>
          {certifications.map((c, i) => (
            <div key={i} style={{ marginBottom: '0.5rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>{c.name}</p>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#64748b' }}>
                {[c.issuer, c.year].filter(Boolean).join(' · ')}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Projects — read-only */}
      {projects && projects.length > 0 && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h3 style={sectionHead}>PROJECTS</h3>
          {projects.map((p, i) => (
            <div key={i} style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>{p.name}</p>
                {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#f97316', textDecoration: 'none' }}>VIEW ↗</a>}
              </div>
              <p style={{ fontSize: '0.825rem', color: '#94a3b8', lineHeight: 1.6 }}>{p.description}</p>
            </div>
          ))}
        </section>
      )}

      {/* Education — read-only */}
      {education && education.length > 0 && (
        <section>
          <h3 style={sectionHead}>EDUCATION</h3>
          {education.map((e, i) => (
            <div key={i} style={{ marginBottom: '0.6rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>{e.degree}</p>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#64748b' }}>
                {e.institution} · {e.location} · {e.year}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

export default function ResumeDiffViewer({ tailored, jobId, onSaved }: Props) {
  const [mode, setMode] = useState<'diff' | 'full'>('diff')

  if (!tailored) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem' }}>
        NO RESUME TAILORED YET
      </div>
    )
  }

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.35rem 0.9rem',
    fontFamily: 'Space Mono, monospace', fontSize: '0.65rem',
    background: active ? '#1e1e2e' : 'transparent',
    border: `1px solid ${active ? '#8b5cf6' : '#1e1e2e'}`,
    borderRadius: '3px',
    color: active ? '#e2e8f0' : '#475569',
    cursor: 'pointer',
  })

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid #1e1e2e' }}>
        <button style={toggleStyle(mode === 'diff')} onClick={() => setMode('diff')}>
          DIFF ({tailored.diff?.length ?? 0} CHANGES)
        </button>
        <button style={toggleStyle(mode === 'full')} onClick={() => setMode('full')}>
          FULL RESUME
        </button>
      </div>

      {mode === 'full' ? (
        <FullResumeView tailored={tailored} jobId={jobId} onSaved={onSaved} />
      ) : tailored.diff && tailored.diff.length > 0 ? (
        <div style={{ padding: '1rem' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#475569', marginBottom: '1rem' }}>
            {tailored.diff.length} CHANGE{tailored.diff.length !== 1 ? 'S' : ''} FROM BASE RESUME
          </p>
          {tailored.diff.map((d, i) => (
            <DiffRow key={i} field={d.field} original={d.original} tailored={d.tailored} />
          ))}
        </div>
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem' }}>
          NO CHANGES — BASE RESUME USED AS-IS
        </div>
      )}
    </div>
  )
}
