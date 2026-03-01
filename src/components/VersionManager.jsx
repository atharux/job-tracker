import React, { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import {
  createResumeVersion,
  updateResumeVersion,
  batchAddModulesToVersion,
  fetchVersionModules,
  updateModuleOrder
} from '../utils/resumeDatabase';

/**
 * VersionManager Component
 * Creates and manages resume versions with module selection
 * Implements Requirements 4.1-4.6 from resume-builder-manager spec
 */
export default function VersionManager({ version, allModules, onSave, onCancel }) {
  const [versionName, setVersionName] = useState(version?.name || '');
  const [selectedModuleIds, setSelectedModuleIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (version) {
      setVersionName(version.name);
      loadVersionModules();
    }
  }, [version]);

  const loadVersionModules = async () => {
    if (!version) return;
    
    try {
      const modules = await fetchVersionModules(version.id);
      setSelectedModuleIds(modules.map(m => m.id));
    } catch (error) {
      console.error('Failed to load version modules:', error);
    }
  };

  const handleToggleModule = (moduleId) => {
    setSelectedModuleIds(prev => {
      if (prev.includes(moduleId)) {
        return prev.filter(id => id !== moduleId);
      } else {
        return [...prev, moduleId];
      }
    });
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!versionName.trim()) {
      newErrors.name = 'Version name is required';
    }
    
    if (selectedModuleIds.length === 0) {
      newErrors.modules = 'Select at least one module';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      if (version) {
        // Update existing version
        await updateResumeVersion(version.id, { name: versionName });
        
        // Update module links
        const moduleOrders = selectedModuleIds.map((moduleId, index) => ({
          module_id: moduleId,
          display_order: index
        }));
        await updateModuleOrder(version.id, moduleOrders);
      } else {
        // Create new version
        const newVersion = await createResumeVersion({
          name: versionName,
          template_id: 'default'
        });
        
        // Add modules to version
        await batchAddModulesToVersion(newVersion.id, selectedModuleIds);
      }
      
      onSave();
    } catch (error) {
      console.error('Failed to save version:', error);
      alert('Failed to save version. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Group modules by type
  const modulesByType = allModules.reduce((acc, module) => {
    if (!acc[module.type]) {
      acc[module.type] = [];
    }
    acc[module.type].push(module);
    return acc;
  }, {});

  const getModuleTitle = (module) => {
    const content = module.content;
    switch (module.type) {
      case 'experience':
        return `${content.position} at ${content.company}`;
      case 'education':
        return `${content.degree} - ${content.institution}`;
      case 'skills':
        return `${content.category} Skills`;
      case 'certification':
        return content.name;
      case 'summary':
        return 'Professional Summary';
      case 'custom':
        return content.title || 'Custom Section';
      default:
        return 'Module';
    }
  };

  return (
    <div className="version-manager">
      <div className="version-manager-header">
        <h3>{version ? 'Edit Resume Version' : 'Create Resume Version'}</h3>
      </div>

      <div className="version-manager-body">
        <div className="form-group">
          <label>Version Name *</label>
          <input
            type="text"
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            placeholder="e.g., Software Engineer Resume, Data Science Resume"
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label>Select Modules *</label>
          {errors.modules && <span className="error-text">{errors.modules}</span>}
          
          <div className="module-selection">
            {Object.entries(modulesByType).map(([type, modules]) => (
              <div key={type} className="module-type-group">
                <h4 className="module-type-title">{type}</h4>
                <div className="module-checkboxes">
                  {modules.map(module => (
                    <label key={module.id} className="module-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedModuleIds.includes(module.id)}
                        onChange={() => handleToggleModule(module.id)}
                      />
                      <span>{getModuleTitle(module)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="selected-count">
          {selectedModuleIds.length} module{selectedModuleIds.length !== 1 ? 's' : ''} selected
        </div>
      </div>

      <div className="version-manager-footer">
        <button onClick={onCancel} className="btn-cancel" disabled={isLoading}>
          <X size={16} /> Cancel
        </button>
        <button onClick={handleSave} className="btn-save" disabled={isLoading}>
          <Save size={16} /> {isLoading ? 'Saving...' : 'Save Version'}
        </button>
      </div>
    </div>
  );
}
