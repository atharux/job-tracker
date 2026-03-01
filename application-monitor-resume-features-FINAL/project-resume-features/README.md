# Application Monitor - Resume Features Pack

## What's Included

### New Features
✅ **AI Resume Modularization** - Upload PDF/DOCX/TXT resume, AI breaks it into editable modules
✅ **ATS-Optimized Export** - Generate plain text resume optimized for Applicant Tracking Systems
✅ **Resume Module Editor** - Edit and customize resume sections per job application
✅ **Database Integration** - Store resumes with applications in Supabase

### Files
- `ResumeUploader.jsx` - Upload component with drag & drop
- `ResumeModuleEditor.jsx` - Module editing interface
- `atsExport.js` - ATS export utilities
- `schema.sql` - Database schema for resumes table
- `INTEGRATION_GUIDE.md` - Step-by-step integration instructions
- All existing files (App.jsx, App.css, etc.)

## Installation

### Quick Start (30 seconds)

1. **Extract ZIP** to your project folder
2. **Run SQL** - Open `schema.sql` in Supabase SQL Editor and execute
3. **Follow INTEGRATION_GUIDE.md** - Copy/paste code snippets into your existing files
4. **Test** - Upload a resume, create an application

### What You'll Need to Modify

- `App.jsx` - Add ~10 code blocks (imports, state, functions, UI)
- `App.css` - Add resume styles at the end

**Estimated Time:** 10-15 minutes

## Features Breakdown

### Feature 1: Resume Upload & AI Modularization
- Drag & drop or click to upload
- Supports PDF, DOCX, TXT (max 5MB)
- AI automatically extracts:
  - Professional summary
  - Experience (company, position, achievements)
  - Skills (technical & soft)
  - Education
  - Certifications
- Saves to Supabase `resumes` table

### Feature 2: ATS Export
- One-click export to plain text
- Keyword-optimized format
- No tables, columns, or graphics (ATS-friendly)
- Includes all resume sections
- Downloads as .txt file

### Feature 3: Module Editor
- Edit any resume section
- Add/remove experience items
- Modify achievements
- Update skills
- Customize per job application

## Architecture

### Database Schema
```
resumes table:
- id (bigserial)
- user_id (uuid, FK to auth.users)
- original_filename (text)
- base_content (text)
- modules (jsonb)
- created_at, updated_at

applications table additions:
- resume_id (bigint, FK to resumes)
- tailored_modules (jsonb) - for future per-app customization
```

### Component Structure
```
App.jsx
├── ResumeUploader (drag & drop, AI processing)
├── ResumeModuleEditor (edit modules)
└── atsExport.js (export utilities)
```

## API Usage

The resume upload feature uses the Claude API (Anthropic) to modularize resumes. The API key is handled by Claude's built-in artifact system - no configuration needed.

## Troubleshooting

### Resume upload fails
- Check file size (<5MB)
- Verify file type (PDF, DOCX, TXT only)
- Check browser console for errors

### ATS export button disabled
- Upload a resume first
- Check `currentResume` state exists

### Module editor not saving
- Verify Supabase RLS policies allow updates
- Check browser console for errors

## Next Steps

After integration:
1. Test resume upload
2. Try ATS export
3. Edit modules
4. Link resume to application

## Support

For issues:
1. Check INTEGRATION_GUIDE.md
2. Verify SQL ran successfully
3. Check browser console for errors
4. Verify Supabase RLS policies

---

**Built with:** React, Supabase, Claude API, Lucide Icons
**Gamification:** Remains dormant (can be fixed separately)
