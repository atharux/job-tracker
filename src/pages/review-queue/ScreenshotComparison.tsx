import React from 'react'
import type { ScreenshotResult } from '../../agents/types'

interface Props {
  screenshots: ScreenshotResult | null
}

export default function ScreenshotComparison({ screenshots }: Props) {
  if (!screenshots) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem' }}>
        NO SCREENSHOTS CAPTURED YET
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#475569', marginBottom: '0.5rem' }}>
            BEFORE FILL
          </p>
          <div style={{ border: '1px solid #1e1e2e', borderRadius: '4px', overflow: 'hidden', background: '#0f0f1a' }}>
            <img
              src={screenshots.before_url}
              alt="Form before fill"
              style={{ width: '100%', display: 'block' }}
            />
          </div>
        </div>
        <div>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#06b6d4', marginBottom: '0.5rem' }}>
            AFTER FILL
          </p>
          <div style={{ border: '1px solid rgba(6,182,212,0.3)', borderRadius: '4px', overflow: 'hidden', background: '#0f0f1a' }}>
            <img
              src={screenshots.filled_url}
              alt="Form after fill"
              style={{ width: '100%', display: 'block' }}
            />
          </div>
        </div>
      </div>
      <p style={{ marginTop: '0.5rem', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#374151', textAlign: 'right' }}>
        Captured {new Date(screenshots.captured_at).toLocaleString()}
      </p>
    </div>
  )
}
