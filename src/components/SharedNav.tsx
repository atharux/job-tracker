import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Settings, Plus } from 'lucide-react'
import ApiKeySettings from './ApiKeySettings'
import AddJobModal from './AddJobModal'

export default function SharedNav() {
  const location = useLocation()
  const [showSettings, setShowSettings] = useState(false)
  const [showAddJob, setShowAddJob] = useState(false)

  function navLink(to: string, label: string) {
    const active = location.pathname === to
    return (
      <Link
        to={to}
        style={{
          color: active ? '#06b6d4' : '#64748b',
          textDecoration: 'none',
          fontFamily: 'Space Mono, monospace',
          fontSize: '11px',
          letterSpacing: '1px',
          padding: '4px 0',
          borderBottom: active ? '1px solid #06b6d4' : '1px solid transparent',
          transition: 'color 0.15s',
        }}
      >
        {label}
      </Link>
    )
  }

  return (
    <>
      <nav style={{
        borderBottom: '1px solid #1e1e2e',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        background: '#07070f',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Brand */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '7px', textDecoration: 'none', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <polygon points="13,2 5,13 12,13 11,22 19,11 12,11" fill="#06b6d4" />
          </svg>
          <span style={{ color: '#06b6d4', fontFamily: 'Space Mono, monospace', fontSize: '11px', letterSpacing: '2px', fontWeight: 700 }}>
            FORGE
          </span>
        </Link>

        <span style={{ color: '#1e293b', fontSize: '16px', userSelect: 'none' }}>|</span>

        {navLink('/', 'TRACKER')}
        {navLink('/review-queue', 'REVIEW QUEUE')}
        {navLink('/pipeline', 'AGENT STUDIO')}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowAddJob(true)}
            title="Add job to pipeline"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'rgba(6,182,212,0.08)',
              border: '1px solid rgba(6,182,212,0.25)',
              borderRadius: '4px',
              padding: '5px 10px',
              color: '#06b6d4',
              cursor: 'pointer',
              fontFamily: 'Space Mono, monospace',
              fontSize: '10px',
              letterSpacing: '0.06em',
            }}
          >
            <Plus size={11} />
            ADD JOB
          </button>
          <button
            onClick={() => setShowSettings(true)}
            title="API Keys & Settings"
            style={{
              background: 'transparent',
              border: '1px solid #1e293b',
              borderRadius: '4px',
              padding: '5px 8px',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Settings size={14} />
          </button>
        </div>
      </nav>

      <ApiKeySettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <AddJobModal isOpen={showAddJob} onClose={() => setShowAddJob(false)} />
    </>
  )
}
