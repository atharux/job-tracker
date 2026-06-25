import React, { useState, useEffect } from 'react'
import { Edit2, Save, X, Printer } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import type { CoverLetter } from '../../agents/types'

interface Props {
  letter: CoverLetter | null
  jobId: string
  onSaved?: () => void
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function printLetter(subject: string, body: string) {
  const win = window.open('', '_blank', 'width=900,height=1100')
  if (!win) return
  const paragraphs = body.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>${subject}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 11pt; color: #111; padding: 56px 64px; max-width: 800px; margin: 0 auto; line-height: 1.65; }
      .subject { font-size: 9pt; color: #555; margin-bottom: 32px; font-style: italic; }
      p { margin-bottom: 14px; }
      @media print { body { padding: 0; } @page { margin: 20mm 18mm; } }
    </style>
  </head><body>
    <div class="subject">Re: ${subject}</div>
    ${paragraphs}
  </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

export default function CoverLetterPreview({ letter, jobId, onSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (letter) {
      setSubject(letter.subject_line)
      setBody(letter.body)
    }
  }, [letter])

  if (!letter) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem' }}>
        NO COVER LETTER GENERATED YET
      </div>
    )
  }

  const wordCount = countWords(body)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated: CoverLetter = { subject_line: subject, body, word_count: wordCount }
      const { error: err } = await supabase.from('application_artifacts').insert({
        job_id: jobId,
        artifact_type: 'cover_letter',
        content: updated,
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
    if (letter) {
      setSubject(letter.subject_line)
      setBody(letter.body)
    }
    setEditing(false)
    setError(null)
  }

  const inputBase: React.CSSProperties = {
    width: '100%', background: '#0f0f1a', border: '1px solid #2d2d3f',
    borderRadius: '4px', color: '#e2e8f0', padding: '0.5rem 0.75rem',
    fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '1rem' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {!editing && (
          <button
            onClick={() => printLetter(subject, body)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.9rem', background: 'transparent', border: '1px solid rgba(6,182,212,0.4)', borderRadius: '3px', color: '#06b6d4', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem' }}
          >
            <Printer size={12} /> PRINT / PDF
          </button>
        )}
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

      {error && (
        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#ef4444', marginBottom: '0.75rem' }}>⚠ {error}</p>
      )}

      {/* Subject line */}
      <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '4px' }}>
        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#8b5cf6', marginBottom: '0.4rem' }}>SUBJECT LINE</p>
        {editing ? (
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            style={{ ...inputBase, resize: undefined }}
          />
        ) : (
          <p style={{ fontSize: '0.9rem', color: '#e2e8f0' }}>{subject}</p>
        )}
      </div>

      {/* Body */}
      {editing ? (
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={16}
          style={{ ...inputBase, lineHeight: 1.7 }}
        />
      ) : (
        <div style={{ padding: '1rem', background: '#0f0f1a', border: '1px solid #1e1e2e', borderRadius: '4px', lineHeight: 1.7 }}>
          {body.split('\n').map((para, i) =>
            para.trim() ? (
              <p key={i} style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#cbd5e1' }}>{para}</p>
            ) : (
              <br key={i} />
            )
          )}
        </div>
      )}

      <p style={{ marginTop: '0.75rem', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: wordCount > 300 ? '#ef4444' : '#475569', textAlign: 'right' }}>
        {wordCount} / 300 WORDS {wordCount > 300 ? '— OVER LIMIT' : ''}
      </p>
    </div>
  )
}
