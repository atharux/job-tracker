import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Settings, Plus, LogOut } from 'lucide-react'
import ApiKeySettings from './ApiKeySettings'
import AddJobModal from './AddJobModal'

interface Props {
  /** Extra items rendered between INTEL and the right-side icons */
  rightSlot?: React.ReactNode
}

export default function SharedNav({ rightSlot }: Props) {
  const location = useLocation()
  const [showSettings, setShowSettings]   = useState(false)
  const [showAddJob, setShowAddJob]       = useState(false)
  const [pendingCount, setPendingCount]   = useState(0)
  const [userEmail, setUserEmail]         = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { supabase } = await import('../supabaseClient')
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled || !user) return
        setUserEmail(user.email ?? null)

        const { count } = await supabase
          .from('application_review_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('user_id', user.id)
        if (!cancelled) setPendingCount(count ?? 0)
      } catch { /* not authenticated or offline */ }
    }
    load()
    return () => { cancelled = true }
  }, [location.pathname])

  async function handleLogout() {
    const { supabase } = await import('../supabaseClient')
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  function navLink(to: string, label: string | React.ReactNode, badge?: number) {
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
          position: 'relative',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#94a3b8' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#64748b' }}
      >
        {label}
        {badge != null && badge > 0 && (
          <span style={{
            position: 'absolute', top: '-6px', right: '-10px',
            background: '#8b5cf6', color: '#fff',
            borderRadius: '9999px', fontSize: '9px',
            fontFamily: 'Space Mono, monospace', fontWeight: 700,
            minWidth: '15px', height: '15px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1,
          }}>
            {badge}
          </span>
        )}
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
            HYDRA
          </span>
        </Link>

        <span style={{ color: '#1e293b', fontSize: '16px', userSelect: 'none' }}>|</span>

        {navLink('/', 'TRACKER')}
        {navLink('/review-queue', 'REVIEW QUEUE', pendingCount)}
        {navLink('/pipeline', 'INTEL')}

        {/* Caller-supplied slot (e.g. tracker sub-nav toggle) */}
        {rightSlot}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {userEmail && (
            <span style={{ fontSize: '10px', color: '#334155', fontFamily: 'Space Mono, monospace', display: 'none' /* hidden on small screens */ }}>
              {userEmail}
            </span>
          )}

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

          {userEmail && (
            <button
              onClick={handleLogout}
              title="Log out"
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
              <LogOut size={14} />
            </button>
          )}
        </div>
      </nav>

      <ApiKeySettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <AddJobModal isOpen={showAddJob} onClose={() => setShowAddJob(false)} />
    </>
  )
}
