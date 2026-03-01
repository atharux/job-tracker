import React from 'react';
import { Briefcase, GraduationCap, Code, FileText, Award, Edit2, Trash2 } from 'lucide-react';

/**
 * ModuleCard Component
 * Displays a single resume module with type-specific rendering
 * Implements Requirements 2.1, 2.2, 2.3 from resume-builder-manager spec
 */
export default function ModuleCard({ module, onEdit, onDelete }) {
  // Get icon based on module type
  const getModuleIcon = (type) => {
    switch (type) {
      case 'experience':
        return <Briefcase size={20} />;
      case 'education':
        return <GraduationCap size={20} />;
      case 'skills':
        return <Code size={20} />;
      case 'certification':
        return <Award size={20} />;
      case 'summary':
      case 'custom':
      default:
        return <FileText size={20} />;
    }
  };

  // Get module title based on type and content
  const getModuleTitle = () => {
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

  // Get module subtitle/details
  const getModuleDetails = () => {
    const content = module.content;
    
    switch (module.type) {
      case 'experience':
        return `${content.startDate} - ${content.endDate}`;
      case 'education':
        return `${content.field} • ${content.startDate} - ${content.endDate}`;
      case 'skills':
        return `${content.skills.length} skill${content.skills.length !== 1 ? 's' : ''}`;
      case 'certification':
        return `${content.issuer} • ${content.date}`;
      case 'summary':
        return content.text.substring(0, 100) + (content.text.length > 100 ? '...' : '');
      case 'custom':
        return content.format;
      default:
        return '';
    }
  };

  // Get type badge color
  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'experience':
        return 'badge-experience';
      case 'education':
        return 'badge-education';
      case 'skills':
        return 'badge-skills';
      case 'certification':
        return 'badge-certification';
      case 'summary':
        return 'badge-summary';
      case 'custom':
      default:
        return 'badge-custom';
    }
  };

  return (
    <div className="module-card">
      <div className="module-card-header">
        <div className="module-card-icon">
          {getModuleIcon(module.type)}
        </div>
        <div className="module-card-info">
          <h3 className="module-card-title">{getModuleTitle()}</h3>
          <p className="module-card-details">{getModuleDetails()}</p>
        </div>
        <span className={`module-type-badge ${getTypeBadgeClass(module.type)}`}>
          {module.type}
        </span>
      </div>

      <div className="module-card-actions">
        <button
          onClick={() => onEdit(module)}
          className="btn-icon"
          title="Edit module"
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={() => onDelete(module.id)}
          className="btn-icon delete"
          title="Delete module"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
