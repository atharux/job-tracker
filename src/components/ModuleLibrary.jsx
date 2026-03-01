import React, { useState } from 'react';
import { Grid, List, Search, Plus } from 'lucide-react';
import ModuleCard from './ModuleCard';

/**
 * ModuleLibrary Component
 * Displays and manages all resume modules with search and filtering
 * Implements Requirements 2.1-2.5 from resume-builder-manager spec
 */
export default function ModuleLibrary({ 
  modules, 
  onModuleSelect, 
  onModuleEdit, 
  onModuleDelete,
  onCreateNew 
}) {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Filter modules based on search and type
  const filteredModules = modules.filter(module => {
    // Type filter
    if (filterType !== 'all' && module.type !== filterType) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const content = module.content;
      
      // Search in different fields based on module type
      switch (module.type) {
        case 'experience':
          return (
            content.company?.toLowerCase().includes(query) ||
            content.position?.toLowerCase().includes(query) ||
            content.achievements?.some(a => a.toLowerCase().includes(query))
          );
        case 'education':
          return (
            content.institution?.toLowerCase().includes(query) ||
            content.degree?.toLowerCase().includes(query) ||
            content.field?.toLowerCase().includes(query)
          );
        case 'skills':
          return (
            content.category?.toLowerCase().includes(query) ||
            content.skills?.some(s => s.toLowerCase().includes(query))
          );
        case 'certification':
          return (
            content.name?.toLowerCase().includes(query) ||
            content.issuer?.toLowerCase().includes(query)
          );
        case 'summary':
          return content.text?.toLowerCase().includes(query);
        case 'custom':
          return content.title?.toLowerCase().includes(query);
        default:
          return false;
      }
    }

    return true;
  });

  // Sort modules by creation date (newest first)
  const sortedModules = [...filteredModules].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  return (
    <div className="module-library">
      {/* Header with controls */}
      <div className="module-library-header">
        <div className="module-library-title">
          <h2>Module Library</h2>
          <span className="module-count">{sortedModules.length} module{sortedModules.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="module-library-controls">
          {/* Search */}
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="experience">Experience</option>
            <option value="education">Education</option>
            <option value="skills">Skills</option>
            <option value="certification">Certifications</option>
            <option value="summary">Summary</option>
            <option value="custom">Custom</option>
          </select>

          {/* View mode toggle */}
          <div className="view-mode-toggle">
            <button
              onClick={() => setViewMode('grid')}
              className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              title="Grid view"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>

          {/* Create new button */}
          <button onClick={onCreateNew} className="btn-primary">
            <Plus size={16} /> New Module
          </button>
        </div>
      </div>

      {/* Module grid/list */}
      {sortedModules.length === 0 ? (
        <div className="empty-state">
          <p>No modules found.</p>
          {searchQuery || filterType !== 'all' ? (
            <p className="text-sm">Try adjusting your search or filter.</p>
          ) : (
            <button onClick={onCreateNew} className="btn-primary mt-4">
              <Plus size={16} /> Create Your First Module
            </button>
          )}
        </div>
      ) : (
        <div className={`module-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
          {sortedModules.map(module => (
            <ModuleCard
              key={module.id}
              module={module}
              onEdit={onModuleEdit}
              onDelete={onModuleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
