import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import ReviewQueue from './pages/ReviewQueue.tsx'
import PipelineVisualization from './components/PipelineVisualization.tsx'
import ApiKeySettings from './components/ApiKeySettings.jsx'
import { Key } from 'lucide-react'
import './index.css'

function GlobalSettingsButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="API Keys & Settings"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: '#0f172a',
          border: '1px solid #1e293b',
          color: '#64748b',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#06b6d4'; e.currentTarget.style.color = '#06b6d4' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.color = '#64748b' }}
      >
        <Key size={18} />
      </button>
      <ApiKeySettings isOpen={open} onClose={() => setOpen(false)} />
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/review-queue" element={<ReviewQueue />} />
        <Route path="/pipeline" element={<PipelineVisualization />} />
      </Routes>
      <GlobalSettingsButton />
    </BrowserRouter>
  </React.StrictMode>,
)
