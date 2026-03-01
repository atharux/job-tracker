import React, { useState, useEffect } from 'react';
import { FileText, Edit3, Trash2, Download, Eye, X, Save, Plus, Upload } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { extractTextFromFile } from '../utils/smartResumeParser';

export default function ResumeManager({ user }) {
  const [versions, setVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leftVersion, setLeftVersion] = useState(null);
  const [rightVersion, setRightVersion] = useState(null);
  const [editingPanel, setEditingPanel] = useState(null); // 'left' | 'right' | null
  const [leftEditContent, setLeftEditContent] = useState('');
  const [leftEditName, setLeftEditName] = useState('');
  const [rightEditContent, setRightEditContent] = useState('');
  const [rightEditName, setRightEditName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    loadVersions();
  }, [user.id]);

  const loadVersions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('resume_versions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (err) {
      console.error('Failed to load resume versions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (version, panel) => {
    if (panel === 'left') {
      setLeftVersion(version);
      setLeftEditContent(version.content);
      setLeftEditName(version.name);
      if (editingPanel === 'left') setEditingPanel(null);
    } else {
      setRightVersion(version);
      setRightEditContent(version.content);
      setRightEditName(version.name);
      if (editingPanel === 'right') setEditingPanel(null);
    }
  };

  const handleEdit = (panel) => {
    setEditingPanel(panel);
  };

  const handleSave = async (panel) => {
    const version = panel === 'left' ? leftVersion : rightVersion;
    const content = panel === 'left' ? leftEditContent : rightEditContent;
    const name = panel === 'left' ? leftEditName : rightEditName;

    if (!version) return;

    try {
      const { error } = await supabase
        .from('resume_versions')
        .update({
          name: name,
          content: content,
          updated_at: new Date().toISOString()
        })
        .eq('id', version.id);

      if (error) throw error;

      if (panel === 'left') {
        setLeftVersion({ ...version, name, content });
      } else {
        setRightVersion({ ...version, name, content });
      }
      setEditingPanel(null);
      await loadVersions();
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save changes');
    }
  };

  const handleClose = (panel) => {
    if (panel === 'left') {
      setLeftVersion(null);
      if (editingPanel === 'left') setEditingPanel(null);
    } else {
      setRightVersion(null);
      if (editingPanel === 'right') setEditingPanel(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this resume version? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('resume_versions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (leftVersion?.id === id) {
        setLeftVersion(null);
      }
      if (rightVersion?.id === id) {
        setRightVersion(null);
      }
      await loadVersions();
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Failed to delete version');
    }
  };

  const downloadTXT = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadResume = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError('');

    try {
      const text = await extractTextFromFile(file);
      
      // Save as a resume version
      const versionName = `${file.name.replace(/\.[^/.]+$/, '')} - ${new Date().toLocaleDateString()}`;
      
      const { error } = await supabase
        .from('resume_versions')
        .insert([{
          user_id: user.id,
          name: versionName,
          content: text,
          updated_at: new Date().toISOString()
        }]);

      if (error) throw error;

      // Reload versions
      await loadVersions();
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError('Failed to upload resume: ' + err.message);
      setTimeout(() => setUploadError(''), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const renderPanel = (panel) => {
    const version = panel === 'left' ? leftVersion : rightVersion;
    const isEditing = editingPanel === panel;
    const content = panel === 'left' ? leftEditContent : rightEditContent;
    const name = panel === 'left' ? leftEditName : rightEditName;
    const setContent = panel === 'left' ? setLeftEditContent : setRightEditContent;
    const setName = panel === 'left' ? setLeftEditName : setRightEditName;
    const panelClass = panel === 'left' ? 'rm-panel-left' : 'rm-panel-right';
    const panelTitle = panel === 'left' ? 'Left Panel' : 'Right Panel';

    if (!version) {
      return (
        <div className={`rm-content ${panelClass}`}>
          <div className="rm-placeholder">
            <div className="rm-placeholder-icon">
              <FileText size={40} />
            </div>
            <div className="rm-placeholder-text">{panelTitle}</div>
            <div className="rm-placeholder-hint">Click "{panel === 'left' ? 'L' : 'R'}" on any version</div>
          </div>
        </div>
      );
    }

    return (
      <div className={`rm-content ${panelClass}`}>
        <div className="rm-content-header">
          <div className="rm-content-title">
            <FileText size={16} />
            {panelTitle}
          </div>
          <div className="rm-content-actions">
            {isEditing ? (
              <>
                <button className="rm-btn rm-btn-primary" onClick={() => handleSave(panel)}>
                  <Save size={14} /> Save
                </button>
                <button className="rm-btn rm-btn-ghost" onClick={() => {
                  setEditingPanel(null);
                  setContent(version.content);
                  setName(version.name);
                }}>
                  <X size={14} /> Cancel
                </button>
              </>
            ) : (
              <>
                <button className="rm-btn rm-btn-success" onClick={() => handleEdit(panel)}>
                  <Edit3 size={14} /> Edit
                </button>
                <button
                  className="rm-btn rm-btn-ghost"
                  onClick={() => downloadTXT(version.content, `${version.name}.txt`)}
                >
                  <Download size={14} /> Download
                </button>
                <button className="rm-btn rm-btn-ghost" onClick={() => handleClose(panel)}>
                  <X size={14} /> Close
                </button>
              </>
            )}
          </div>
        </div>

        {isEditing && (
          <input
            className="rm-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Resume version name"
          />
        )}

        {isEditing ? (
          <textarea
            className="rm-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        ) : (
          <div className="rm-preview">{version.content}</div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
        Loading resume versions...
      </div>
    );
  }

  return (
    <div className="rm-root">
      <style>{`
        .rm-root {
          display: grid;
          grid-template-columns: 300px 1fr 1fr;
          gap: 20px;
          min-height: 70vh;
        }

        @media (max-width: 1200px) {
          .rm-root {
            grid-template-columns: 280px 1fr;
          }
          .rm-panel-right {
            display: none;
          }
        }

        @media (max-width: 900px) {
          .rm-root {
            grid-template-columns: 1fr;
          }
          .rm-panel-right {
            display: none;
          }
        }

        .rm-sidebar {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 24px;
          max-height: 80vh;
          overflow-y: auto;
        }

        .rm-sidebar-title {
          font-size: 18px;
          font-weight: 700;
          color: #e2e8f0;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rm-upload-btn {
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1px dashed rgba(110,231,183,0.3);
          background: rgba(110,231,183,0.05);
          color: #6ee7b7;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .rm-upload-btn:hover:not(:disabled) {
          background: rgba(110,231,183,0.1);
          border-color: #6ee7b7;
        }

        .rm-upload-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .rm-upload-error {
          padding: 12px;
          border-radius: 8px;
          background: rgba(248,113,113,0.1);
          border: 1px solid rgba(248,113,113,0.3);
          color: #f87171;
          font-size: 13px;
          margin-bottom: 16px;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .rm-version-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rm-version-card {
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 14px;
          transition: all 0.2s;
        }

        .rm-version-card:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(110,231,183,0.3);
        }

        .rm-version-card.active-left {
          background: rgba(59,130,246,0.1);
          border-color: #3b82f6;
        }

        .rm-version-card.active-right {
          background: rgba(168,85,247,0.1);
          border-color: #a855f7;
        }

        .rm-version-card.active-both {
          background: rgba(110,231,183,0.1);
          border-color: #6ee7b7;
        }

        .rm-version-name {
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
          margin-bottom: 8px;
          line-height: 1.4;
        }

        .rm-version-date {
          font-size: 12px;
          color: #64748b;
        }

        .rm-version-actions {
          display: flex;
          gap: 6px;
          margin-top: 10px;
        }

        .rm-version-btn {
          flex: 1;
          padding: 5px 10px;
          border-radius: 6px;
          border: none;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .rm-version-btn-left {
          background: rgba(59,130,246,0.12);
          color: #3b82f6;
        }

        .rm-version-btn-left:hover {
          background: rgba(59,130,246,0.2);
        }

        .rm-version-btn-right {
          background: rgba(168,85,247,0.12);
          color: #a855f7;
        }

        .rm-version-btn-right:hover {
          background: rgba(168,85,247,0.2);
        }

        .rm-version-btn-delete {
          background: rgba(248,113,113,0.1);
          color: #f87171;
        }

        .rm-version-btn-delete:hover {
          background: rgba(248,113,113,0.2);
        }

        .rm-empty {
          text-align: center;
          padding: 40px 20px;
          color: #64748b;
          font-size: 14px;
        }

        .rm-content {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .rm-panel-left {
          border-color: rgba(59,130,246,0.3);
        }

        .rm-panel-right {
          border-color: rgba(168,85,247,0.3);
        }

        .rm-content-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        .rm-content-title {
          font-size: 15px;
          font-weight: 700;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rm-panel-left .rm-content-title {
          color: #3b82f6;
        }

        .rm-panel-right .rm-content-title {
          color: #a855f7;
        }

        .rm-content-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .rm-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .rm-btn-primary {
          background: linear-gradient(135deg, #6ee7b7, #3b82f6);
          color: #0d1117;
        }

        .rm-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(110,231,183,0.3);
        }

        .rm-btn-ghost {
          background: rgba(255,255,255,0.06);
          color: #94a3b8;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .rm-btn-ghost:hover {
          background: rgba(255,255,255,0.1);
          color: #e2e8f0;
        }

        .rm-btn-success {
          background: rgba(110,231,183,0.12);
          color: #6ee7b7;
          border: 1px solid rgba(110,231,183,0.25);
        }

        .rm-btn-success:hover {
          background: rgba(110,231,183,0.2);
        }

        .rm-name-input {
          width: 100%;
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: #e2e8f0;
          font-size: 14px;
          padding: 12px 16px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
        }

        .rm-name-input:focus {
          border-color: rgba(110,231,183,0.4);
        }

        .rm-textarea {
          width: 100%;
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(110,231,183,0.3);
          border-radius: 10px;
          padding: 20px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.7;
          color: #cbd5e1;
          min-height: 450px;
          resize: vertical;
          outline: none;
        }

        .rm-preview {
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 20px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.7;
          color: #cbd5e1;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 550px;
          overflow-y: auto;
        }

        .rm-preview::-webkit-scrollbar {
          width: 5px;
        }

        .rm-preview::-webkit-scrollbar-track {
          background: transparent;
        }

        .rm-preview::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }

        .rm-placeholder {
          text-align: center;
          padding: 80px 20px;
          color: #64748b;
        }

        .rm-placeholder-icon {
          margin-bottom: 16px;
          color: #475569;
        }

        .rm-placeholder-text {
          font-size: 15px;
          margin-bottom: 8px;
        }

        .rm-placeholder-hint {
          font-size: 13px;
          color: #475569;
        }
      `}</style>

      {/* Sidebar - Version List */}
      <div className="rm-sidebar">
        <div className="rm-sidebar-title">
          <FileText size={20} style={{ color: '#6ee7b7' }} />
          Resume Versions
        </div>

        {/* Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleUploadResume}
          style={{ display: 'none' }}
        />
        <button
          className="rm-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          title="Upload a resume file (PDF, DOCX, or TXT)"
        >
          {isUploading ? (
            <>
              <div style={{ animation: 'spin 1s linear infinite' }}>⏳</div>
              Uploading...
            </>
          ) : (
            <>
              <Upload size={16} />
              Upload Resume
            </>
          )}
        </button>

        {uploadError && (
          <div className="rm-upload-error">
            {uploadError}
          </div>
        )}

        {versions.length === 0 ? (
          <div className="rm-empty">
            No resume versions yet. Upload a resume above or use the Assembly view to create one!
          </div>
        ) : (
          <div className="rm-version-list">
            {versions.map(version => {
              const isLeft = leftVersion?.id === version.id;
              const isRight = rightVersion?.id === version.id;
              const activeClass = isLeft && isRight ? 'active-both' : isLeft ? 'active-left' : isRight ? 'active-right' : '';
              
              return (
                <div
                  key={version.id}
                  className={`rm-version-card ${activeClass}`}
                >
                  <div className="rm-version-name">{version.name}</div>
                  <div className="rm-version-date">
                    {new Date(version.updated_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="rm-version-actions">
                    <button
                      className="rm-version-btn rm-version-btn-left"
                      onClick={() => handleView(version, 'left')}
                      title="Open in left panel"
                    >
                      <Eye size={12} /> L
                    </button>
                    <button
                      className="rm-version-btn rm-version-btn-right"
                      onClick={() => handleView(version, 'right')}
                      title="Open in right panel"
                    >
                      <Eye size={12} /> R
                    </button>
                    <button
                      className="rm-version-btn rm-version-btn-delete"
                      onClick={() => handleDelete(version.id)}
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Left Panel */}
      {renderPanel('left')}

      {/* Right Panel */}
      {renderPanel('right')}
    </div>
  );
}
