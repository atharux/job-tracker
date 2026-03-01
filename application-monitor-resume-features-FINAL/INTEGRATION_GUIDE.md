# RESUME FEATURES - INTEGRATION GUIDE

## Files Included

**New Components:**
- `ResumeUploader.jsx` - Upload & AI modularization
- `ResumeModuleEditor.jsx` - Edit resume modules
- `atsExport.js` - ATS export utility

**Database:**
- `schema.sql` - Run this in Supabase SQL editor

**Modified:**
- `App.jsx` - Needs integration (see below)
- `App.css` - Add new styles (see below)

---

## Step 1: Run SQL

In Supabase SQL Editor, run `schema.sql` to create resumes table.

---

## Step 2: Add Imports to App.jsx

Add these imports at the top of App.jsx (after line 3):

```javascript
import ResumeUploader from './ResumeUploader.jsx';
import ResumeModuleEditor from './ResumeModuleEditor.jsx';
import { downloadATSResume } from './atsExport.js';
```

Update the imports from lucide-react to include FileText:

```javascript
import { Trash2, Plus, Edit2, X, Check, Download, LogOut, Upload, FileText } from 'lucide-react';
```

---

## Step 3: Add State Variables

After line ~35 (after `formData` state), add:

```javascript
  // Resume features state
  const [resumes, setResumes] = useState([]);
  const [currentResume, setCurrentResume] = useState(null);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isResumeProcessing, setIsResumeProcessing] = useState(false);
```

---

## Step 4: Add Resume Loading

In the `useEffect` that loads data (around line 70), add:

```javascript
  useEffect(() => {
    if (user) {
      loadApplications();
      loadGamificationState();
      loadResumes(); // ADD THIS LINE
    }
  }, [user]);
```

---

## Step 5: Add Resume Functions

After `handleLogout` function (around line 200), add:

```javascript
  const loadResumes = async () => {
    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Load resumes error:', error);
        return;
      }

      setResumes(data || []);
      if (data && data.length > 0) {
        setCurrentResume(data[0]);
      }
    } catch (e) {
      console.error('Failed to load resumes:', e);
    }
  };

  const handleResumeProcessed = async (resumeData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('resumes')
        .insert([{
          user_id: user.id,
          original_filename: resumeData.filename,
          base_content: resumeData.base_content,
          modules: resumeData.modules
        }])
        .select()
        .single();

      if (error) {
        console.error('Save resume error:', error);
        alert('Failed to save resume');
        return;
      }

      setResumes(prev => [data, ...prev]);
      setCurrentResume(data);
      setIsResumeProcessing(false);
      alert('Resume processed successfully!');
    } catch (e) {
      console.error('Resume save error:', e);
      alert('Failed to save resume');
      setIsResumeProcessing(false);
    }
  };

  const handleExportATS = () => {
    if (!currentResume) {
      alert('Please upload a resume first');
      return;
    }

    downloadATSResume(
      currentResume.modules,
      { name: user.email.split('@')[0], email: user.email },
      `${currentResume.original_filename || 'resume'}-ats.txt`
    );
  };
```

---

## Step 6: Add Resume Upload Button

In the `<div className="controls">` section (around line 750), add after the "New Application" button:

```javascript
          <button 
            onClick={() => setIsResumeModalOpen(true)}
            className="btn-primary"
            style={{ background: '#8b5cf6' }}
          >
            <FileText size={18} /> {currentResume ? 'Manage Resume' : 'Upload Resume'}
          </button>
```

---

## Step 7: Add ATS Export Button

In the export buttons section, add:

```javascript
            <button 
              onClick={handleExportATS}
              className="btn-export"
              disabled={!currentResume}
              title="Export ATS-optimized plain text resume"
            >
              <Download size={16} /> ATS Resume
            </button>
```

---

## Step 8: Add Resume Modal

Before the closing `</div>` of the main return statement (around line 1100), add:

```javascript
      {/* Resume Modal */}
      {isResumeModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsResumeModalOpen(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {currentResume ? 'Manage Resume' : 'Upload Resume'}
              </h2>
              <button
                onClick={() => setIsResumeModalOpen(false)}
                className="modal-close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {!currentResume ? (
                <ResumeUploader
                  onResumeProcessed={handleResumeProcessed}
                  isProcessing={isResumeProcessing}
                  setIsProcessing={setIsResumeProcessing}
                />
              ) : (
                <div>
                  <div className="resume-info">
                    <p className="text-slate-300">
                      <strong>Current Resume:</strong> {currentResume.original_filename}
                    </p>
                    <p className="text-slate-400 text-sm">
                      Uploaded: {new Date(currentResume.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <ResumeModuleEditor
                    modules={currentResume.modules}
                    onSave={async (updatedModules) => {
                      const { error } = await supabase
                        .from('resumes')
                        .update({ modules: updatedModules })
                        .eq('id', currentResume.id);
                      
                      if (!error) {
                        setCurrentResume({ ...currentResume, modules: updatedModules });
                        alert('Resume updated!');
                      }
                    }}
                    onCancel={() => setIsResumeModalOpen(false)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
```

---

## Step 9: Add CSS Styles

Add to App.css:

```css
/* Resume Uploader */
.resume-uploader {
  border: 2px dashed #475569;
  border-radius: 0.75rem;
  padding: 3rem;
  text-align: center;
  transition: all 0.2s;
  cursor: pointer;
  background: rgba(51, 65, 85, 0.2);
}

.resume-uploader.drag-active {
  border-color: #0891b2;
  background: rgba(6, 182, 212, 0.1);
}

.upload-label {
  cursor: pointer;
  display: block;
}

.upload-icon {
  margin: 0 auto 1rem;
  color: #94a3b8;
}

.upload-text {
  font-size: 1.125rem;
  color: #cbd5e1;
  margin-bottom: 0.5rem;
}

.upload-subtext {
  font-size: 0.875rem;
  color: #64748b;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Module Editor */
.module-editor {
  max-height: 60vh;
  overflow-y: auto;
}

.module-section {
  margin-bottom: 2rem;
}

.module-section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #f8fafc;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.module-textarea, .module-input {
  width: 100%;
  background: #334155;
  border: 1px solid #475569;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  color: #f8fafc;
  font-family: inherit;
  margin-bottom: 0.5rem;
}

.module-textarea {
  resize: vertical;
}

.experience-item {
  background: rgba(51, 65, 85, 0.3);
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.achievement-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-remove-achievement {
  background: #ef4444;
  color: white;
  padding: 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-add-achievement {
  background: #0891b2;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  margin-top: 0.5rem;
  cursor: pointer;
}

.skills-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.skill-label {
  display: block;
  font-size: 0.875rem;
  color: #cbd5e1;
  margin-bottom: 0.5rem;
}

.module-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #334155;
}

.modal-wide {
  max-width: 50rem;
}

.resume-info {
  background: rgba(51, 65, 85, 0.3);
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}
```

---

## Done!

Your app now has:
✅ Resume upload with AI modularization
✅ Resume module editing
✅ ATS-optimized export
✅ Link resumes to job applications

Test by uploading a resume, then creating a new application.
