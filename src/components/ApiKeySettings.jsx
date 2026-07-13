import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Save, Eye, EyeOff, Mail, CheckCircle, RefreshCw } from 'lucide-react';
import { initiateGmailAuth, isGmailConnected, getGmailUserEmail, disconnectGmail } from '../services/gmailAuth';
import { fetchAndCacheFreeModels, getCachedFreeModels } from '../agents/openRouterClient';
import SearchProfilePanel from './SearchProfilePanel';
import ReleaseNotesPanel from './ReleaseNotesPanel';

function getFreeModelsCacheInfo() {
  try {
    const raw = localStorage.getItem('openrouter_free_models');
    if (!raw) return null;
    const cache = JSON.parse(raw);
    return { count: cache.models?.length ?? 0, cachedAt: cache.cachedAt ?? 0 };
  } catch { return null; }
}

export default function ApiKeySettings({ isOpen, onClose }) {
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [cogneeKey, setCogneeKey] = useState('');
  const [cogneeBaseUrl, setCogneeBaseUrl] = useState('');
  const [langfusePublicKey, setLangfusePublicKey] = useState('');
  const [langfuseSecretKey, setLangfuseSecretKey] = useState('');
  const [langfuseHost, setLangfuseHost] = useState('');
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [showCogneeKey, setShowCogneeKey] = useState(false);
  const [showLangfuseSecretKey, setShowLangfuseSecretKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [freeModelInfo, setFreeModelInfo] = useState(null);
  const [refreshingModels, setRefreshingModels] = useState(false);

  useEffect(() => {
    setGmailConnected(isGmailConnected());
    setGmailEmail(getGmailUserEmail() ?? '');
  }, [isOpen]);

  useEffect(() => {
    setOpenRouterKey(localStorage.getItem('openrouter_api_key') || '');
    setGroqKey(localStorage.getItem('groq_api_key') || '');
    setClaudeKey(localStorage.getItem('anthropic_api_key') || '');
    setCogneeKey(localStorage.getItem('cognee_api_key') || '');
    setCogneeBaseUrl(localStorage.getItem('cognee_base_url') || '');
    setLangfusePublicKey(localStorage.getItem('langfuse_public_key') || '');
    setLangfuseSecretKey(localStorage.getItem('langfuse_secret_key') || '');
    setLangfuseHost(localStorage.getItem('langfuse_host') || '');
    setFreeModelInfo(getFreeModelsCacheInfo());
  }, [isOpen]);

  const handleRefreshModels = async () => {
    const key = openRouterKey.trim() || localStorage.getItem('openrouter_api_key');
    if (!key) return;
    setRefreshingModels(true);
    await fetchAndCacheFreeModels(key);
    setFreeModelInfo(getFreeModelsCacheInfo());
    setRefreshingModels(false);
  };

  const handleSave = () => {
    if (openRouterKey.trim()) {
      localStorage.setItem('openrouter_api_key', openRouterKey.trim());
    } else {
      localStorage.removeItem('openrouter_api_key');
    }

    if (groqKey.trim()) {
      localStorage.setItem('groq_api_key', groqKey.trim());
    } else {
      localStorage.removeItem('groq_api_key');
    }

    if (claudeKey.trim()) {
      localStorage.setItem('anthropic_api_key', claudeKey.trim());
    } else {
      localStorage.removeItem('anthropic_api_key');
    }

    if (cogneeKey.trim()) {
      localStorage.setItem('cognee_api_key', cogneeKey.trim());
    } else {
      localStorage.removeItem('cognee_api_key');
    }
    if (cogneeBaseUrl.trim()) {
      localStorage.setItem('cognee_base_url', cogneeBaseUrl.trim());
    } else {
      localStorage.removeItem('cognee_base_url');
    }

    if (langfusePublicKey.trim()) {
      localStorage.setItem('langfuse_public_key', langfusePublicKey.trim());
    } else {
      localStorage.removeItem('langfuse_public_key');
    }
    if (langfuseSecretKey.trim()) {
      localStorage.setItem('langfuse_secret_key', langfuseSecretKey.trim());
    } else {
      localStorage.removeItem('langfuse_secret_key');
    }
    if (langfuseHost.trim()) {
      localStorage.setItem('langfuse_host', langfuseHost.trim());
    } else {
      localStorage.removeItem('langfuse_host');
    }

    // Background-refresh the free model cache whenever the OR key changes
    if (openRouterKey.trim()) {
      fetchAndCacheFreeModels(openRouterKey.trim()).then(() => setFreeModelInfo(getFreeModelsCacheInfo()));
    }

    // Notify same-tab listeners (e.g. ResumeAIAssistant) — native 'storage' only fires cross-tab.
    window.dispatchEvent(new CustomEvent('api-keys-saved'));
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="api-settings-overlay" onClick={onClose}>
      <style>{`
        .api-settings-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .api-settings-modal {
          background: #0d1117;
          border: 1px solid #1e2a1e;
          border-top: 2px solid #06b6d4;
          border-radius: 6px;
          padding: 28px 32px;
          max-width: 560px;
          width: 100%;
          animation: slideUp 0.2s ease;
          position: relative;
          max-height: 90vh;
          overflow-y: auto;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .api-settings-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .api-settings-title {
          font-size: 24px;
          font-weight: 700;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .api-settings-close {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
          transition: all 0.2s;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .api-settings-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e2e8f0;
        }

        .api-settings-description {
          font-size: 12px;
          font-family: 'Space Mono', monospace;
          color: #64748b;
          line-height: 1.6;
          margin-bottom: 24px;
          padding: 12px 14px;
          background: rgba(6, 182, 212, 0.05);
          border: 1px solid rgba(6, 182, 212, 0.15);
          border-radius: 4px;
        }

        .api-settings-section {
          margin-bottom: 24px;
        }

        .api-settings-label {
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .api-settings-link {
          font-size: 12px;
          color: #06b6d4;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: color 0.2s;
        }

        .api-settings-link:hover {
          color: #3b82f6;
        }

        .api-settings-input-wrapper {
          position: relative;
        }

        .api-settings-input {
          width: 100%;
          background: #0a0a0f;
          border: 1px solid #1e2a1e;
          border-radius: 4px;
          color: #e2e8f0;
          font-size: 13px;
          padding: 10px 40px 10px 12px;
          font-family: 'Space Mono', 'Courier New', monospace;
          outline: none;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }

        .api-settings-input:focus {
          border-color: #06b6d4;
        }

        .api-settings-input::placeholder {
          color: rgba(255, 255, 255, 0.2);
        }

        .api-settings-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }

        .api-settings-toggle:hover {
          color: #94a3b8;
        }

        .api-settings-hint {
          font-size: 12px;
          color: #64748b;
          margin-top: 6px;
          line-height: 1.5;
        }

        .api-settings-actions {
          display: flex;
          gap: 12px;
          margin-top: 32px;
        }

        .api-settings-btn {
          flex: 1;
          padding: 12px 24px;
          border-radius: 10px;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: inherit;
        }

        .api-settings-btn-primary {
          background: #06b6d4;
          color: #0a0a0f;
          font-weight: 700;
        }

        .api-settings-btn-primary:hover {
          background: #22d3ee;
        }

        .api-settings-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .api-settings-btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          color: #94a3b8;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .api-settings-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e2e8f0;
        }

        @media (max-width: 640px) {
          .api-settings-modal {
            padding: 20px;
            border-radius: 4px;
          }

          .api-settings-actions {
            flex-direction: column;
          }
        }
      `}</style>

      <div
        className="api-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="api-settings-header">
          <div className="api-settings-title" id="api-settings-title">
            <Key size={20} style={{ color: '#06b6d4' }} aria-hidden="true" />
            API Key Settings
          </div>
          <button className="api-settings-close" onClick={onClose} aria-label="Close API key settings">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="api-settings-description">
          Add at least one key to activate the AI agents. Keys are stored in your browser only — never sent to our servers.{' '}
          <strong style={{ color: '#06b6d4' }}>Groq is free</strong> — start there.
        </div>

        {/* OpenRouter API Key */}
        <div className="api-settings-section">
          <div className="api-settings-label">
            <span>OpenRouter API Key</span>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="api-settings-link"
            >
              Get Key <ExternalLink size={12} />
            </a>
          </div>
          <div className="api-settings-input-wrapper">
            <input
              type={showOpenRouterKey ? 'text' : 'password'}
              className="api-settings-input"
              placeholder="sk-or-..."
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
            />
            <button
              className="api-settings-toggle"
              onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
              type="button"
            >
              {showOpenRouterKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="api-settings-hint">
            For Scout &amp; all AI agents • Free credits available • Supports 200+ models
          </div>
          {freeModelInfo && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', padding: '6px 10px', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.18)', borderRadius: '6px' }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#64748b' }}>
                {freeModelInfo.count} free models cached · {Math.round((Date.now() - freeModelInfo.cachedAt) / 60000)}m ago
              </span>
              <button
                onClick={handleRefreshModels}
                disabled={refreshingModels}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: refreshingModels ? 'not-allowed' : 'pointer', color: '#06b6d4', fontFamily: 'Space Mono, monospace', fontSize: '10px', padding: '2px 0' }}
              >
                <RefreshCw size={11} style={{ animation: refreshingModels ? 'spin 1s linear infinite' : 'none' }} />
                {refreshingModels ? 'Refreshing…' : 'Refresh now'}
              </button>
            </div>
          )}
        </div>

        {/* Groq API Key */}
        <div className="api-settings-section">
          <div className="api-settings-label">
            <span>Groq API Key <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', letterSpacing: '0.08em', background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.25)', borderRadius: '2px', padding: '1px 5px', marginLeft: '6px' }}>FREE — START HERE</span></span>
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="api-settings-link"
            >
              Get Free Key <ExternalLink size={12} />
            </a>
          </div>
          <div className="api-settings-input-wrapper">
            <input
              type={showGroqKey ? 'text' : 'password'}
              className="api-settings-input"
              placeholder="gsk_..."
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
            />
            <button
              className="api-settings-toggle"
              onClick={() => setShowGroqKey(!showGroqKey)}
              type="button"
            >
              {showGroqKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="api-settings-hint">
            Free tier: 50 credits/month • Fast responses • Llama 3.3 70B model
          </div>
        </div>

        {/* Gmail OAuth */}
        <div className="api-settings-section">
          <div className="api-settings-label">
            <span>Gmail — Status Tracker</span>
            {gmailConnected && (
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', letterSpacing: '0.08em', background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '2px', padding: '1px 5px' }}>
                CONNECTED
              </span>
            )}
          </div>
          {gmailConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={14} style={{ color: '#22c55e' }} />
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', color: '#94a3b8' }}>{gmailEmail}</span>
              </div>
              <button
                onClick={() => { disconnectGmail(); setGmailConnected(false); setGmailEmail(''); }}
                style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: '#ef4444', fontSize: '11px', fontFamily: "'Space Mono', monospace", padding: '3px 8px', cursor: 'pointer' }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={initiateGmailAuth}
              className="api-settings-btn"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#e2e8f0', fontSize: '13px', fontFamily: 'inherit', padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}
            >
              <Mail size={14} style={{ color: '#06b6d4' }} />
              Connect Gmail
            </button>
          )}
          <div className="api-settings-hint">
            Monitors inbox for replies to submitted applications — rejection, screening, interview. Needs <code>VITE_GOOGLE_CLIENT_ID</code> in your env.
          </div>
        </div>

        {/* Claude API Key */}
        <div className="api-settings-section">
          <div className="api-settings-label">
            <span>Anthropic API Key (Optional)</span>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="api-settings-link"
            >
              Get Key <ExternalLink size={12} />
            </a>
          </div>
          <div className="api-settings-input-wrapper">
            <input
              type={showClaudeKey ? 'text' : 'password'}
              className="api-settings-input"
              placeholder="sk-ant-..."
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
            />
            <button
              className="api-settings-toggle"
              onClick={() => setShowClaudeKey(!showClaudeKey)}
              type="button"
            >
              {showClaudeKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="api-settings-hint">
            Paid: $3-4 per million tokens • Best accuracy • Claude Sonnet 4
          </div>
        </div>

        {/* Cognee — Knowledge Graph Memory */}
        <div className="api-settings-section" style={{ borderTop: '1px solid #1e1e2e', paddingTop: '1rem' }}>
          <div className="api-settings-label">
            <span style={{ color: '#8b5cf6' }}>Cognee API Key</span>
            <a
              href="https://platform.cognee.ai/sign-in"
              target="_blank"
              rel="noopener noreferrer"
              className="api-settings-link"
            >
              Get Key <ExternalLink size={12} />
            </a>
          </div>
          <div className="api-settings-input-wrapper">
            <input
              type={showCogneeKey ? 'text' : 'password'}
              className="api-settings-input"
              placeholder="ck_..."
              value={cogneeKey}
              onChange={(e) => setCogneeKey(e.target.value)}
            />
            <button
              className="api-settings-toggle"
              onClick={() => setShowCogneeKey(!showCogneeKey)}
              type="button"
            >
              {showCogneeKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="api-settings-hint">
            Knowledge graph memory layer — jobs feed in automatically after each Scout run
          </div>
          <div className="api-settings-label" style={{ marginTop: '0.75rem' }}>
            <span>Cognee Base URL</span>
          </div>
          <input
            type="text"
            className="api-settings-input"
            placeholder="http://localhost:8000"
            value={cogneeBaseUrl}
            onChange={(e) => setCogneeBaseUrl(e.target.value)}
            style={{ marginTop: '0.25rem' }}
          />
          <div className="api-settings-hint">
            Cloud: from platform.cognee.ai dashboard · Self-hosted: http://localhost:8000
          </div>
        </div>

        {/* Langfuse — Pipeline Observability */}
        <div className="api-settings-section" style={{ borderTop: '1px solid #1e1e2e', paddingTop: '1rem' }}>
          <div className="api-settings-label">
            <span style={{ color: '#06b6d4' }}>Langfuse Public Key</span>
            <a
              href="https://cloud.langfuse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="api-settings-link"
            >
              Get Keys <ExternalLink size={12} />
            </a>
          </div>
          <div className="api-settings-input-wrapper">
            <input
              type="text"
              className="api-settings-input"
              placeholder="pk-lf-..."
              value={langfusePublicKey}
              onChange={(e) => setLangfusePublicKey(e.target.value)}
            />
          </div>
          <div className="api-settings-label" style={{ marginTop: '0.75rem' }}>
            <span style={{ color: '#06b6d4' }}>Langfuse Secret Key</span>
          </div>
          <div className="api-settings-input-wrapper">
            <input
              type={showLangfuseSecretKey ? 'text' : 'password'}
              className="api-settings-input"
              placeholder="sk-lf-..."
              value={langfuseSecretKey}
              onChange={(e) => setLangfuseSecretKey(e.target.value)}
            />
            <button
              className="api-settings-toggle"
              onClick={() => setShowLangfuseSecretKey(!showLangfuseSecretKey)}
              type="button"
            >
              {showLangfuseSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="api-settings-label" style={{ marginTop: '0.75rem' }}>
            <span>Langfuse Host</span>
          </div>
          <input
            type="text"
            className="api-settings-input"
            placeholder="https://cloud.langfuse.com"
            value={langfuseHost}
            onChange={(e) => setLangfuseHost(e.target.value)}
            style={{ marginTop: '0.25rem' }}
          />
          <div className="api-settings-hint">
            LLM traces per pipeline run — model, latency, tokens, input/output per agent · EU: eu.cloud.langfuse.com
          </div>
        </div>

        <SearchProfilePanel />

        <ReleaseNotesPanel />

        <div className="api-settings-actions">
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
                Save Keys
              </>
            )}
          </button>
          <button
            className="api-settings-btn api-settings-btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
