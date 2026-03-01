import React, { useState } from 'react';
import { Save, X } from 'lucide-react';

export default function ResumeModuleEditor({ modules, onSave, onCancel }) {
  const [editedModules, setEditedModules] = useState(
    JSON.parse(JSON.stringify(modules || {}))
  );

  const updateSummary = (value) => {
    setEditedModules({ ...editedModules, summary: value });
  };

  const updateExperience = (index, field, value) => {
    const newExp = [...(editedModules.experience || [])];
    newExp[index] = { ...newExp[index], [field]: value };
    setEditedModules({ ...editedModules, experience: newExp });
  };

  const updateAchievement = (expIndex, achIndex, value) => {
    const newExp = [...(editedModules.experience || [])];
    newExp[expIndex].achievements[achIndex] = value;
    setEditedModules({ ...editedModules, experience: newExp });
  };

  const addAchievement = (expIndex) => {
    const newExp = [...(editedModules.experience || [])];
    newExp[expIndex].achievements = newExp[expIndex].achievements || [];
    newExp[expIndex].achievements.push('');
    setEditedModules({ ...editedModules, experience: newExp });
  };

  const removeAchievement = (expIndex, achIndex) => {
    const newExp = [...(editedModules.experience || [])];
    newExp[expIndex].achievements.splice(achIndex, 1);
    setEditedModules({ ...editedModules, experience: newExp });
  };

  return (
    <div className="module-editor">
      <div className="module-section">
        <h3 className="module-section-title">Professional Summary</h3>
        <textarea
          value={editedModules.summary || ''}
          onChange={(e) => updateSummary(e.target.value)}
          rows={4}
          className="module-textarea"
          placeholder="Professional summary..."
        />
      </div>

      <div className="module-section">
        <h3 className="module-section-title">Experience</h3>
        {editedModules.experience?.map((exp, expIdx) => (
          <div key={expIdx} className="experience-item">
            <div className="form-row">
              <input
                type="text"
                value={exp.company || ''}
                onChange={(e) => updateExperience(expIdx, 'company', e.target.value)}
                placeholder="Company"
                className="module-input"
              />
              <input
                type="text"
                value={exp.position || ''}
                onChange={(e) => updateExperience(expIdx, 'position', e.target.value)}
                placeholder="Position"
                className="module-input"
              />
            </div>
            <input
              type="text"
              value={exp.duration || ''}
              onChange={(e) => updateExperience(expIdx, 'duration', e.target.value)}
              placeholder="Duration (e.g., Jan 2020 - Present)"
              className="module-input"
            />
            <div className="achievements-list">
              <label className="achievement-label">Achievements:</label>
              {exp.achievements?.map((ach, achIdx) => (
                <div key={achIdx} className="achievement-row">
                  <input
                    type="text"
                    value={ach}
                    onChange={(e) => updateAchievement(expIdx, achIdx, e.target.value)}
                    placeholder="Achievement"
                    className="module-input"
                  />
                  <button
                    onClick={() => removeAchievement(expIdx, achIdx)}
                    className="btn-remove-achievement"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addAchievement(expIdx)}
                className="btn-add-achievement"
              >
                + Add Achievement
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="module-section">
        <h3 className="module-section-title">Skills</h3>
        <div className="skills-grid">
          <div>
            <label className="skill-label">Technical Skills</label>
            <textarea
              value={editedModules.skills?.technical?.join(', ') || ''}
              onChange={(e) =>
                setEditedModules({
                  ...editedModules,
                  skills: {
                    ...editedModules.skills,
                    technical: e.target.value.split(',').map((s) => s.trim())
                  }
                })
              }
              rows={3}
              className="module-textarea"
              placeholder="JavaScript, Python, React..."
            />
          </div>
          <div>
            <label className="skill-label">Soft Skills</label>
            <textarea
              value={editedModules.skills?.soft?.join(', ') || ''}
              onChange={(e) =>
                setEditedModules({
                  ...editedModules,
                  skills: {
                    ...editedModules.skills,
                    soft: e.target.value.split(',').map((s) => s.trim())
                  }
                })
              }
              rows={3}
              className="module-textarea"
              placeholder="Leadership, Communication..."
            />
          </div>
        </div>
      </div>

      <div className="module-actions">
        <button onClick={onCancel} className="btn-cancel">
          <X size={18} /> Cancel
        </button>
        <button onClick={() => onSave(editedModules)} className="btn-save">
          <Save size={18} /> Save Changes
        </button>
      </div>
    </div>
  );
}

