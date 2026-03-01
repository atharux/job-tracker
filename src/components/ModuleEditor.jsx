import React, { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2 } from 'lucide-react';

/**
 * ModuleEditor Component
 * Edits individual resume modules with type-specific forms
 * Implements Requirements 3.1-3.5 from resume-builder-manager spec
 */
export default function ModuleEditor({ module, onSave, onCancel, mode = 'edit' }) {
  const [moduleType, setModuleType] = useState(module?.type || 'experience');
  const [content, setContent] = useState(module?.content || getDefaultContent('experience'));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (module) {
      setModuleType(module.type);
      setContent(module.content);
    }
  }, [module]);

  // Get default content structure for each module type
  function getDefaultContent(type) {
    switch (type) {
      case 'experience':
        return {
          company: '',
          position: '',
          location: '',
          startDate: '',
          endDate: '',
          achievements: [''],
          technologies: []
        };
      case 'education':
        return {
          institution: '',
          degree: '',
          field: '',
          startDate: '',
          endDate: '',
          gpa: '',
          honors: []
        };
      case 'skills':
        return {
          category: 'technical',
          skills: ['']
        };
      case 'certification':
        return {
          name: '',
          issuer: '',
          date: '',
          expiryDate: '',
          credentialId: ''
        };
      case 'summary':
        return {
          text: ''
        };
      case 'custom':
        return {
          title: '',
          format: 'text',
          data: ''
        };
      default:
        return {};
    }
  }

  // Handle module type change (only in create mode)
  const handleTypeChange = (newType) => {
    setModuleType(newType);
    setContent(getDefaultContent(newType));
    setErrors({});
  };

  // Validate module content
  const validateContent = () => {
    const newErrors = {};

    switch (moduleType) {
      case 'experience':
        if (!content.company?.trim()) newErrors.company = 'Company is required';
        if (!content.position?.trim()) newErrors.position = 'Position is required';
        if (!content.startDate) newErrors.startDate = 'Start date is required';
        if (!content.endDate) newErrors.endDate = 'End date is required';
        break;
      case 'education':
        if (!content.institution?.trim()) newErrors.institution = 'Institution is required';
        if (!content.degree?.trim()) newErrors.degree = 'Degree is required';
        if (!content.field?.trim()) newErrors.field = 'Field is required';
        if (!content.startDate) newErrors.startDate = 'Start date is required';
        if (!content.endDate) newErrors.endDate = 'End date is required';
        break;
      case 'skills':
        if (!content.category?.trim()) newErrors.category = 'Category is required';
        if (!content.skills || content.skills.filter(s => s.trim()).length === 0) {
          newErrors.skills = 'At least one skill is required';
        }
        break;
      case 'certification':
        if (!content.name?.trim()) newErrors.name = 'Certification name is required';
        if (!content.issuer?.trim()) newErrors.issuer = 'Issuer is required';
        if (!content.date) newErrors.date = 'Date is required';
        break;
      case 'summary':
        if (!content.text?.trim()) newErrors.text = 'Summary text is required';
        break;
      case 'custom':
        if (!content.title?.trim()) newErrors.title = 'Title is required';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validateContent()) {
      return;
    }

    onSave({
      ...module,
      type: moduleType,
      content
    });
  };

  // Render type-specific form
  const renderForm = () => {
    switch (moduleType) {
      case 'experience':
        return renderExperienceForm();
      case 'education':
        return renderEducationForm();
      case 'skills':
        return renderSkillsForm();
      case 'certification':
        return renderCertificationForm();
      case 'summary':
        return renderSummaryForm();
      case 'custom':
        return renderCustomForm();
      default:
        return null;
    }
  };

  const renderExperienceForm = () => (
    <>
      <div className="form-row">
        <div className="form-group">
          <label>Company *</label>
          <input
            type="text"
            value={content.company || ''}
            onChange={(e) => setContent({ ...content, company: e.target.value })}
            placeholder="e.g., Tech Corp"
            className={errors.company ? 'error' : ''}
          />
          {errors.company && <span className="error-text">{errors.company}</span>}
        </div>
        <div className="form-group">
          <label>Position *</label>
          <input
            type="text"
            value={content.position || ''}
            onChange={(e) => setContent({ ...content, position: e.target.value })}
            placeholder="e.g., Senior Engineer"
            className={errors.position ? 'error' : ''}
          />
          {errors.position && <span className="error-text">{errors.position}</span>}
        </div>
      </div>

      <div className="form-group">
        <label>Location</label>
        <input
          type="text"
          value={content.location || ''}
          onChange={(e) => setContent({ ...content, location: e.target.value })}
          placeholder="e.g., San Francisco, CA"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Start Date *</label>
          <input
            type="month"
            value={content.startDate || ''}
            onChange={(e) => setContent({ ...content, startDate: e.target.value })}
            className={errors.startDate ? 'error' : ''}
          />
          {errors.startDate && <span className="error-text">{errors.startDate}</span>}
        </div>
        <div className="form-group">
          <label>End Date *</label>
          <div className="date-input-group">
            <input
              type="month"
              value={content.endDate === 'Present' ? '' : content.endDate || ''}
              onChange={(e) => setContent({ ...content, endDate: e.target.value })}
              disabled={content.endDate === 'Present'}
              className={errors.endDate ? 'error' : ''}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={content.endDate === 'Present'}
                onChange={(e) => setContent({ ...content, endDate: e.target.checked ? 'Present' : '' })}
              />
              Present
            </label>
          </div>
          {errors.endDate && <span className="error-text">{errors.endDate}</span>}
        </div>
      </div>

      <div className="form-group">
        <label>Achievements</label>
        {content.achievements?.map((achievement, index) => (
          <div key={index} className="list-item-input">
            <input
              type="text"
              value={achievement}
              onChange={(e) => {
                const newAchievements = [...content.achievements];
                newAchievements[index] = e.target.value;
                setContent({ ...content, achievements: newAchievements });
              }}
              placeholder="Describe an achievement..."
            />
            <button
              type="button"
              onClick={() => {
                const newAchievements = content.achievements.filter((_, i) => i !== index);
                setContent({ ...content, achievements: newAchievements });
              }}
              className="btn-icon delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setContent({ ...content, achievements: [...content.achievements, ''] })}
          className="btn-secondary"
        >
          <Plus size={16} /> Add Achievement
        </button>
      </div>

      <div className="form-group">
        <label>Technologies (comma-separated)</label>
        <input
          type="text"
          value={content.technologies?.join(', ') || ''}
          onChange={(e) => setContent({ ...content, technologies: e.target.value.split(',').map(t => t.trim()) })}
          placeholder="e.g., React, Node.js, PostgreSQL"
        />
      </div>
    </>
  );

  const renderEducationForm = () => (
    <>
      <div className="form-group">
        <label>Institution *</label>
        <input
          type="text"
          value={content.institution || ''}
          onChange={(e) => setContent({ ...content, institution: e.target.value })}
          placeholder="e.g., University of California"
          className={errors.institution ? 'error' : ''}
        />
        {errors.institution && <span className="error-text">{errors.institution}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Degree *</label>
          <input
            type="text"
            value={content.degree || ''}
            onChange={(e) => setContent({ ...content, degree: e.target.value })}
            placeholder="e.g., Bachelor of Science"
            className={errors.degree ? 'error' : ''}
          />
          {errors.degree && <span className="error-text">{errors.degree}</span>}
        </div>
        <div className="form-group">
          <label>Field *</label>
          <input
            type="text"
            value={content.field || ''}
            onChange={(e) => setContent({ ...content, field: e.target.value })}
            placeholder="e.g., Computer Science"
            className={errors.field ? 'error' : ''}
          />
          {errors.field && <span className="error-text">{errors.field}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Start Date *</label>
          <input
            type="month"
            value={content.startDate || ''}
            onChange={(e) => setContent({ ...content, startDate: e.target.value })}
            className={errors.startDate ? 'error' : ''}
          />
          {errors.startDate && <span className="error-text">{errors.startDate}</span>}
        </div>
        <div className="form-group">
          <label>End Date *</label>
          <input
            type="month"
            value={content.endDate || ''}
            onChange={(e) => setContent({ ...content, endDate: e.target.value })}
            className={errors.endDate ? 'error' : ''}
          />
          {errors.endDate && <span className="error-text">{errors.endDate}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>GPA</label>
          <input
            type="text"
            value={content.gpa || ''}
            onChange={(e) => setContent({ ...content, gpa: e.target.value })}
            placeholder="e.g., 3.8"
          />
        </div>
        <div className="form-group">
          <label>Honors (comma-separated)</label>
          <input
            type="text"
            value={content.honors?.join(', ') || ''}
            onChange={(e) => setContent({ ...content, honors: e.target.value.split(',').map(h => h.trim()) })}
            placeholder="e.g., Cum Laude, Dean's List"
          />
        </div>
      </div>
    </>
  );

  const renderSkillsForm = () => (
    <>
      <div className="form-group">
        <label>Category *</label>
        <select
          value={content.category || 'technical'}
          onChange={(e) => setContent({ ...content, category: e.target.value })}
          className={errors.category ? 'error' : ''}
        >
          <option value="technical">Technical</option>
          <option value="soft">Soft Skills</option>
          <option value="languages">Languages</option>
          <option value="tools">Tools</option>
        </select>
        {errors.category && <span className="error-text">{errors.category}</span>}
      </div>

      <div className="form-group">
        <label>Skills *</label>
        {content.skills?.map((skill, index) => (
          <div key={index} className="list-item-input">
            <input
              type="text"
              value={skill}
              onChange={(e) => {
                const newSkills = [...content.skills];
                newSkills[index] = e.target.value;
                setContent({ ...content, skills: newSkills });
              }}
              placeholder="Enter a skill..."
            />
            <button
              type="button"
              onClick={() => {
                const newSkills = content.skills.filter((_, i) => i !== index);
                setContent({ ...content, skills: newSkills });
              }}
              className="btn-icon delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {errors.skills && <span className="error-text">{errors.skills}</span>}
        <button
          type="button"
          onClick={() => setContent({ ...content, skills: [...content.skills, ''] })}
          className="btn-secondary"
        >
          <Plus size={16} /> Add Skill
        </button>
      </div>
    </>
  );

  const renderCertificationForm = () => (
    <>
      <div className="form-group">
        <label>Certification Name *</label>
        <input
          type="text"
          value={content.name || ''}
          onChange={(e) => setContent({ ...content, name: e.target.value })}
          placeholder="e.g., AWS Certified Solutions Architect"
          className={errors.name ? 'error' : ''}
        />
        {errors.name && <span className="error-text">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label>Issuer *</label>
        <input
          type="text"
          value={content.issuer || ''}
          onChange={(e) => setContent({ ...content, issuer: e.target.value })}
          placeholder="e.g., Amazon Web Services"
          className={errors.issuer ? 'error' : ''}
        />
        {errors.issuer && <span className="error-text">{errors.issuer}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Date Obtained *</label>
          <input
            type="month"
            value={content.date || ''}
            onChange={(e) => setContent({ ...content, date: e.target.value })}
            className={errors.date ? 'error' : ''}
          />
          {errors.date && <span className="error-text">{errors.date}</span>}
        </div>
        <div className="form-group">
          <label>Expiry Date</label>
          <input
            type="month"
            value={content.expiryDate || ''}
            onChange={(e) => setContent({ ...content, expiryDate: e.target.value })}
          />
        </div>
      </div>

      <div className="form-group">
        <label>Credential ID</label>
        <input
          type="text"
          value={content.credentialId || ''}
          onChange={(e) => setContent({ ...content, credentialId: e.target.value })}
          placeholder="e.g., ABC123XYZ"
        />
      </div>
    </>
  );

  const renderSummaryForm = () => (
    <div className="form-group">
      <label>Professional Summary *</label>
      <textarea
        value={content.text || ''}
        onChange={(e) => setContent({ ...content, text: e.target.value })}
        placeholder="Write a brief professional summary..."
        rows={6}
        className={errors.text ? 'error' : ''}
      />
      {errors.text && <span className="error-text">{errors.text}</span>}
    </div>
  );

  const renderCustomForm = () => (
    <>
      <div className="form-group">
        <label>Section Title *</label>
        <input
          type="text"
          value={content.title || ''}
          onChange={(e) => setContent({ ...content, title: e.target.value })}
          placeholder="e.g., Publications, Awards, Projects"
          className={errors.title ? 'error' : ''}
        />
        {errors.title && <span className="error-text">{errors.title}</span>}
      </div>

      <div className="form-group">
        <label>Format</label>
        <select
          value={content.format || 'text'}
          onChange={(e) => setContent({ ...content, format: e.target.value })}
        >
          <option value="text">Text</option>
          <option value="list">List</option>
        </select>
      </div>

      <div className="form-group">
        <label>Content</label>
        <textarea
          value={typeof content.data === 'string' ? content.data : content.data?.join('\n') || ''}
          onChange={(e) => {
            const value = content.format === 'list' 
              ? e.target.value.split('\n')
              : e.target.value;
            setContent({ ...content, data: value });
          }}
          placeholder={content.format === 'list' ? 'Enter one item per line...' : 'Enter content...'}
          rows={6}
        />
      </div>
    </>
  );

  return (
    <div className="module-editor">
      <div className="module-editor-header">
        <h3>{mode === 'create' ? 'Create New Module' : 'Edit Module'}</h3>
      </div>

      <div className="module-editor-body">
        {mode === 'create' && (
          <div className="form-group">
            <label>Module Type</label>
            <select
              value={moduleType}
              onChange={(e) => handleTypeChange(e.target.value)}
            >
              <option value="experience">Experience</option>
              <option value="education">Education</option>
              <option value="skills">Skills</option>
              <option value="certification">Certification</option>
              <option value="summary">Summary</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        )}

        {renderForm()}
      </div>

      <div className="module-editor-footer">
        <button onClick={onCancel} className="btn-cancel">
          <X size={16} /> Cancel
        </button>
        <button onClick={handleSave} className="btn-save">
          <Save size={16} /> Save Module
        </button>
      </div>
    </div>
  );
}
