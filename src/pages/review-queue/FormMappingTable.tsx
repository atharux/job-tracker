import React from 'react'
import type { FormMapping } from '../../agents/types'

interface Props {
  mapping: FormMapping | null
}

export default function FormMappingTable({ mapping }: Props) {
  if (!mapping) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem' }}>
        NO FORM MAPPING GENERATED YET
      </div>
    )
  }

  const manualCount = mapping.fields.filter((f) => f.requires_manual).length

  return (
    <div style={{ padding: '1rem' }}>
      {manualCount > 0 && (
        <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#f59e0b' }}>
          ⚠ {manualCount} FIELD{manualCount !== 1 ? 'S' : ''} REQUIRE MANUAL INPUT
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e1e2e' }}>
              {['FIELD', 'TYPE', 'MAPPED VALUE', 'CONFIDENCE', 'MANUAL?'].map((h) => (
                <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#475569', fontWeight: 400 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mapping.fields.map((field, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #0f0f1a', background: field.requires_manual ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: '#e2e8f0' }}>{field.label || field.field_name}</td>
                <td style={{ padding: '0.5rem 0.75rem', color: '#475569', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem' }}>{field.field_type}</td>
                <td style={{ padding: '0.5rem 0.75rem', color: field.value ? '#cbd5e1' : '#374151', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {field.value || '—'}
                </td>
                <td style={{ padding: '0.5rem 0.75rem' }}>
                  <span style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '0.7rem',
                    color: field.confidence >= 0.8 ? '#06b6d4' : field.confidence >= 0.5 ? '#f59e0b' : '#ef4444'
                  }}>
                    {Math.round(field.confidence * 100)}%
                  </span>
                </td>
                <td style={{ padding: '0.5rem 0.75rem' }}>
                  {field.requires_manual && (
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '3px' }}>
                      MANUAL
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
