import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Save, Eye, EyeOff } from 'lucide-react';

export default function ApiKeySettings({ isOpen, onClose }) {
  const [groqKey, setGroqKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load keys from localStorage
    const savedGroqKey = localStorage.getItem('groq_api_key') || '';
    const savedClaudeKey = localStorage.getItem('anthropic_api_key') || '';
    setGroqKey(savedGroqKey);
    setClaudeKey(savedClaudeKey);
  }, [isOpen]);

  const handleSave = () => {
    // Save to localStorage
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
          background: linear-gradient(135deg, rgba(15, 20, 25, 0.98), rgba(20, 25, 35, 0.98));
          border: 1px solid rgba(110, 231, 183, 0.2);
          border-radius: 20px;
          padding: 32px;
          max-width: 600px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: slideUp 0.3s ease;
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
          font-size: 14px;
          color: #94a3b8;
          line-height: 1.6;
          margin-bottom: 24px;
          padding: 16px;
          background: rgba(110, 231, 183, 0.05);
          border: 1px solid rgba(110, 231, 183, 0.2);
          border-radius: 12px;
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
          color: #6ee7b7;
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
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #e2e8f0;
          font-size: 14px;
          padding: 12px 40px 12px 16px;
          font-family: 'Courier New', monospace;
          outline: none;
          transition: border-color 0.2s;
        }

        .api-settings-input:focus {
          border-color: rgba(110, 231, 183, 0.4);
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
          background: linear-gradient(135deg, #6ee7b7, #3b82f6);
          color: #0d1117;
        }

        .api-settings-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(110, 231, 183, 0.3);
        }

        .api-settings-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
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
            padding: 24px;
          }

          .api-settings-title {
            font-size: 20px;
          }

          .api-settings-actions {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="api-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="api-settings-header">
          <div className="api-settings-title">
            <Key size={24} style={{ color: '#6ee7b7' }} />
            API Key Settings
          </div>
          <button className="api-settings-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="api-settings-description">
          <strong>Optional:</strong> Add your own API keys to use AI features. Keys are stored locally in your browser and never sent to our servers. Groq offers 50 free credits per month!
        </div>

        {/* Groq API Key */}
        <div className="api-settings-section">
          <div className="api-settings-label">
            <span>Groq API Key (Recommended - Free)</span>
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
