import React, { useState, useEffect } from 'react';
import { Plus, FileText, Download, Copy } from 'lucide-react';
import ResumeUploader from './ResumeUploader';
import ModuleLibrary from './ModuleLibrary';
import ModuleEditor from './ModuleEditor';
import VersionManager from './VersionManager';
import { 
  fetchResumeVersions, 
  fetchResumeModules, 
  createResumeModule, 
  updateResumeModule, 
  deleteResumeModule,
  batchCreateModules,
  createResumeVersion,
  cloneResumeVersion
} from '../utils/resumeDatabase';

/**
 * ResumeBuilder Component
 * Main container for resume builder functionality
 * Integrates upload, module management, and version management
 */
export default function ResumeBuilder({ user }) {
  const [view, setView] = useState('library'); // 'library', 'upload', 'edit-module', 'manage-version'
  const [modules, setModules] = useState([]);
  const [versions, setVersions] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [modulesData, versionsData] = await Promise.all([
        fetchResumeModules(),
        fetchResumeVersions()
      ]);
      setModules(modulesData);
      setVersions(versionsData);
    } catch (error) {
      console.error('Failed to load resume data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resume upload and processing
  const handleResumeProcessed = async (data) => {
    if (data.allowManualEntry) {
      // AI parsing failed - show message and allow manual module creation
      alert(data.message || 'Resume uploaded. You can now create modules manually.');
      setView('library');
      return;
    }

    try {
      // Convert parsed data to modules
      const newModules = [];

      // Add summary if present
      if (data.parsedData.summary) {
        newModules.push({
          type: 'summary',
          content: { text: data.parsedData.summary }
        });
      }

      // Add experience modules
      if (data.parsedData.experience) {
        data.parsedData.experience.forEach(exp => {
          newModules.push({
            type: 'experience',
            content: exp
          });
        });
      }

      // Add education modules
      if (data.parsedData.education) {
        data.parsedData.education.forEach(edu => {
          newModules.push({
            type: 'education',
            content: edu
          });
        });
      }

      // Add skills modules
      if (data.parsedData.skills) {
        Object.entries(data.parsedData.skills).forEach(([category, skills]) => {
          if (skills && skills.length > 0) {
            newModules.push({
              type: 'skills',
              content: { category, skills }
            });
          }
        });
      }

      // Add certification modules
      if (data.parsedData.certifications) {
        data.parsedData.certifications.forEach(cert => {
          newModules.push({
            type: 'certification',
            content: cert
          });
        });
      }

      // Save modules to database
      const createdModules = await batchCreateModules(newModules);
      
      // Create default version with all modules
      const defaultVersion = await createResumeVersion({
        name: `Resume from ${data.filename}`,
        template_id: 'default'
      });

      // Link modules to version (handled by VersionManager)
      
      // Reload data
      await loadData();
      
      alert(`Successfully created ${createdModules.length} modules!`);
      setView('library');
    } catch (error) {
      console.error('Failed to process resume:', error);
      alert('Failed to save resume modules. Please try again.');
    }
  };

  // Handle module creation/editing
  const handleSaveModule = async (moduleData) => {
    try {
      if (moduleData.id) {
        // Update existing module
        await updateResumeModule(moduleData.id, {
          type: moduleData.type,
          content: moduleData.content
        });
      } else {
        // Create new module
        await createResumeModule({
          type: moduleData.type,
          content: moduleData.content
        });
      }
      
      await loadData();
      setView('library');
      setSelectedModule(null);
    } catch (error) {
      console.error('Failed to save module:', error);
      alert('Failed to save module. Please try again.');
    }
  };

  // Handle module deletion
  const handleDeleteModule = async (moduleId) => {
    if (!confirm('Delete this module? It will be removed from all resume versions.')) {
      return;
    }

    try {
      await deleteResumeModule(moduleId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete module:', error);
      alert('Failed to delete module. Please try again.');
    }
  };

  // Handle version cloning
  const handleCloneVersion = async (versionId) => {
    try {
      const clonedVersion = await cloneResumeVersion(versionId);
      await loadData();
      alert(`Created "${clonedVersion.name}"`);
    } catch (error) {
      console.error('Failed to clone version:', error);
      alert('Failed to clone version. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="resume-builder-loading">
        <p>Loading resume builder...</p>
      </div>
    );
  }

  return (
    <div className="resume-builder">
      {/* Header */}
      <div className="resume-builder-header">
        <div>
          <h1 className="resume-builder-title">Resume Builder</h1>
          <p className="resume-builder-subtitle">
            Create and manage modular resumes for different applications
          </p>
        </div>
        <div className="resume-builder-actions">
          <button
            onClick={() => setView('upload')}
            className="btn-primary"
          >
            <FileText size={16} /> Upload Resume
          </button>
          <button
            onClick={() => {
              setSelectedModule(null);
              setView('edit-module');
            }}
            className="btn-primary"
          >
            <Plus size={16} /> New Module
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="resume-stats">
        <div className="stat-card">
          <span className="stat-label">Modules</span>
          <span className="stat-value">{modules.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Versions</span>
          <span className="stat-value">{versions.length}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="resume-builder-content">
        {view === 'library' && (
          <ModuleLibrary
            modules={modules}
            onModuleSelect={(module) => {
              setSelectedModule(module);
              setView('edit-module');
            }}
            onModuleEdit={(module) => {
              setSelectedModule(module);
              setView('edit-module');
            }}
            onModuleDelete={handleDeleteModule}
            onCreateNew={() => {
              setSelectedModule(null);
              setView('edit-module');
            }}
          />
        )}

        {view === 'upload' && (
          <div className="resume-builder-section">
            <button
              onClick={() => setView('library')}
              className="btn-back"
            >
              ← Back to Library
            </button>
            <ResumeUploader
              onResumeProcessed={handleResumeProcessed}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
            />
          </div>
        )}

        {view === 'edit-module' && (
          <div className="resume-builder-section">
            <button
              onClick={() => {
                setView('library');
                setSelectedModule(null);
              }}
              className="btn-back"
            >
              ← Back to Library
            </button>
            <ModuleEditor
              module={selectedModule}
              onSave={handleSaveModule}
              onCancel={() => {
                setView('library');
                setSelectedModule(null);
              }}
              mode={selectedModule ? 'edit' : 'create'}
            />
          </div>
        )}

        {view === 'manage-version' && (
          <div className="resume-builder-section">
            <button
              onClick={() => setView('library')}
              className="btn-back"
            >
              ← Back to Library
            </button>
            <VersionManager
              version={selectedVersion}
              allModules={modules}
              onSave={async () => {
                await loadData();
                setView('library');
              }}
              onCancel={() => setView('library')}
            />
          </div>
        )}
      </div>

      {/* Version List Sidebar */}
      {view === 'library' && versions.length > 0 && (
        <div className="version-sidebar">
          <h3>Resume Versions</h3>
          <div className="version-list">
            {versions.map(version => (
              <div key={version.id} className="version-item">
                <div className="version-info">
                  <span className="version-name">{version.name}</span>
                  <span className="version-date">
                    {new Date(version.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="version-actions">
                  <button
                    onClick={() => {
                      setSelectedVersion(version);
                      setView('manage-version');
                    }}
                    className="btn-icon"
                    title="Edit version"
                  >
                    <FileText size={14} />
                  </button>
                  <button
                    onClick={() => handleCloneVersion(version.id)}
                    className="btn-icon"
                    title="Clone version"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    className="btn-icon"
                    title="Export ATS"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              setSelectedVersion(null);
              setView('manage-version');
            }}
            className="btn-secondary w-full"
          >
            <Plus size={16} /> New Version
          </button>
        </div>
      )}
    </div>
  );
}
