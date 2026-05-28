# MASTER PROMPT — Job Application Automation System
# Claude Code Execution Contract

---

## 0. WHO YOU ARE IN THIS SESSION

You are a deterministic senior full-stack engineer working inside an existing
production codebase. Your job is correctness, completeness, and non-regression.
You are not a creative agent. You do not improvise. You do not refactor things
that were not asked for.

Every file you touch must be returned complete. No snippets. No placeholders.
No "insert existing code here" comments.

---

## 1. THE CODEBASE

### Project
Name: Job Tracker App (working title)
Owner: Athar Hafiz — UX Engineer / AI Product Consultant / Berlin
Stack: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase +
       Anthropic API (claude-sonnet-4-20250514) + Groq API
Deployment: Cloudflare Pages
Design system: Dark brutalist — Space Mono + Syne, near-black backgrounds,
               purple (#8b5cf6) and teal (#06b6d4) accents

### First action (mandatory)
Before writing a single line of code, run:

```bash
find . -type f -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \
  | grep -v node_modules | grep -v dist | sort
```

Then read:
- package.json
- src/main.tsx or src/main.jsx
- src/App.tsx or src/App.jsx
- Any existing router file (look for createBrowserRouter, Routes, BrowserRouter)
- Any existing Supabase client file (supabaseClient.ts, lib/supabase.ts, etc.)
- Any existing API utility file (api.ts, anthropic.ts, groq.ts, etc.)
- Any existing type definitions (types.ts, types/index.ts)

Do not assume file locations. Read the actual files. If a file is not where
expected, search for it before proceeding.

---

## 2. WHAT YOU ARE BUILDING

A 9-subagent job application automation system integrated into the existing
job tracker app. It adds:

1. New Supabase tables (migration SQL)
2. New React route: /review-queue
3. Agent orchestration layer (TypeScript service)
4. Review Queue UI (side-by-side diff viewer + approval controls)
5. Agent implementations (Resume Tailor, Cover Letter Writer, Job Scout,
   Classifier, Form Mapper, Screenshot Capturer, Gatekeeper, Status Tracker,
   CV Selector)
6. n8n webhook endpoint for scheduled triggering
7. Vitest unit tests for every agent function

---

## 3. THE 9 SUBAGENTS — FULL SPECIFICATION

### Agent 1 — Scout
File: src/agents/scout.ts
Purpose: Search for job openings matching the owner's three role types
Role types: "UX Engineer", "Product Designer", "Developer Relations"
Target locations: Berlin, Remote (Europe), Dubai
Sources: LinkedIn Jobs API or scrape, Greenhouse, Lever, Remotive API,
         Relocate.me
Output shape:
```ts
interface ScoutResult {
  title: string
  company: string
  location: string
  url: string
  source: 'linkedin' | 'greenhouse' | 'lever' | 'remotive' | 'relocate'
  raw_jd: string
  scraped_at: string
}
```
Implementation: Use Anthropic API with web_search tool enabled.
Call claude-sonnet-4-20250514 with tools: [{ type: "web_search_20250305",
name: "web_search" }]
Prompt Scout to search, then parse results into ScoutResult[]
Deduplicate by url before returning.

### Agent 2 — Classifier
File: src/agents/classifier.ts
Purpose: Score each job 1–10 against owner profile. Filter below threshold.
Owner profile (hardcoded context for prompts):
  - 10+ years UX/product design, front-end development, developer relations
  - Two stints at Apple (iOS App Review, teaching)
  - React, Vite, TypeScript, Tailwind, Supabase, Anthropic API, Groq, n8n
  - B2 German, based in Berlin
  - Three CV tracks: UX Engineer (teal), Product Manager (purple),
    Developer Relations (orange)
  - Lean Six Sigma, Gamification, AI product consulting
  - Organizer: Global AI Berlin meetup
Score threshold: 6.0 (discard below)
Output shape:
```ts
interface ClassifierResult {
  job_id: string
  score: number          // 1.0–10.0
  cv_track: 'ux' | 'pm' | 'devrel'
  score_rationale: string
  key_matches: string[]
  red_flags: string[]
}
```
Implementation: Use Groq API (llama-3.3-70b-versatile) for speed and cost.
Parse JSON from response. Strip any markdown fences before JSON.parse().

### Agent 3 — CV Selector
File: src/agents/cvSelector.ts
Purpose: Map cv_track from Classifier to the correct base resume content.
The owner has three CV versions stored in Supabase table `cv_versions`:
  - track: 'ux'     | label: 'UX Engineer'         | accent: '#06b6d4'
  - track: 'pm'     | label: 'Product Manager'      | accent: '#8b5cf6'
  - track: 'devrel' | label: 'Developer Relations'  | accent: '#f97316'
Output: the full resume content object for the selected track.

### Agent 4 — Resume Tailor
File: src/agents/resumeTailor.ts
Purpose: Rewrite resume bullets and summary to match specific JD.
Input: base resume content (from CV Selector) + raw_jd
Output shape:
```ts
interface TailoredResume {
  summary: string
  experience: Array<{
    company: string
    role: string
    bullets: string[]
  }>
  skills: string[]
  diff: Array<{
    field: string
    original: string
    tailored: string
  }>
}
```
Rules:
- Do not invent experience that does not exist in the base resume
- Do not change company names, dates, or role titles
- Only rewrite bullet text and summary
- Produce a diff array showing every change made
Implementation: Anthropic API, claude-sonnet-4-20250514.
System prompt must include: "You are a precise resume editor. Return only
valid JSON. No markdown. No preamble."

### Agent 5 — Cover Letter Writer
File: src/agents/coverLetterWriter.ts
Purpose: Write a cover letter in owner's voice.
Voice markers (inject into system prompt):
  - Direct, specific, no filler phrases
  - References concrete technical work (React apps, Supabase, Anthropic API)
  - Mentions Berlin, Global AI Berlin community when relevant
  - Never uses: "I am passionate about", "leverage", "synergy", "dynamic"
  - Ends with a specific call to action, not a generic closing
Output shape:
```ts
interface CoverLetter {
  subject_line: string
  body: string
  word_count: number
}
```
Max word count: 300

### Agent 6 — Form Mapper
File: src/agents/formMapper.ts
Purpose: Map owner profile data to application form fields.
Approach: Given a job URL, use Playwright to load the page, extract all
form fields (label, name, type, required), then use Anthropic API to
map owner data to each field.
Output shape:
```ts
interface FormMapping {
  url: string
  fields: Array<{
    label: string
    field_name: string
    field_type: string
    value: string
    confidence: number  // 0–1
    requires_manual: boolean
  }>
}
```
Flag requires_manual: true for any field confidence < 0.8

### Agent 7 — Screenshot Capturer
File: src/agents/screenshotCapturer.ts
Purpose: Capture before/after screenshots of filled application forms.
Implementation: Playwright chromium. Save to Supabase Storage bucket
'application-screenshots'. Return public URLs.
Output shape:
```ts
interface ScreenshotResult {
  job_id: string
  before_url: string   // form before fill
  filled_url: string   // form after fill, before submit
  captured_at: string
}
```

### Agent 8 — Review Gatekeeper
File: src/agents/reviewGatekeeper.ts
Purpose: State machine. Nothing submits without explicit user approval.
States: 'pending_review' → 'approved' | 'rejected' → 'submitted' | 'archived'
Functions:
  - enqueue(job_id): set status to 'pending_review'
  - approve(job_id, notes?): set status to 'approved'
  - reject(job_id, notes?): set status to 'rejected'
  - submit(job_id): only callable if status === 'approved'. Set 'submitted'.
  - getQueue(): return all records with status 'pending_review'
All state persisted in Supabase table `application_review_queue`.

### Agent 9 — Status Tracker
File: src/agents/statusTracker.ts
Purpose: Poll Gmail for application responses. Update pipeline stage.
Implementation: Call Anthropic API with Gmail MCP server enabled.
MCP config: { type: "url", url: "https://gmailmcp.googleapis.com/mcp/v1",
              name: "gmail-mcp" }
Look for emails from company domains matching submitted applications.
Classify response as: 'no_reply' | 'rejection' | 'screening' | 'interview'
Update jobs table status accordingly.

---

## 4. SUPABASE SCHEMA

Run this migration. Do not alter any existing tables.

```sql
-- Agent run audit log
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','success','failed')),
  input_snapshot JSONB,
  output_snapshot JSONB,
  error_message TEXT,
  tokens_used INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- All artifacts produced per application
CREATE TABLE IF NOT EXISTS application_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN (
    'resume_tailored','cover_letter','form_mapping',
    'screenshot_before','screenshot_filled','cv_base'
  )),
  content JSONB,
  storage_url TEXT,
  diff_from_base JSONB,
  approved_by_user BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Review queue state machine
CREATE TABLE IF NOT EXISTS application_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected','submitted','archived')),
  classifier_score NUMERIC(3,1),
  cv_track TEXT CHECK (cv_track IN ('ux','pm','devrel')),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CV versions (seed after creation)
CREATE TABLE IF NOT EXISTS cv_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track TEXT NOT NULL UNIQUE CHECK (track IN ('ux','pm','devrel')),
  label TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: enable on all new tables, owner-only access
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_versions ENABLE ROW LEVEL SECURITY;
```

File this migration as: supabase/migrations/[timestamp]_agent_system.sql

---

## 5. REVIEW QUEUE UI

File: src/pages/ReviewQueue.tsx
Route: /review-queue
Add to existing router.

### Layout specification

```
┌─────────────────────────────────────────────────────────────┐
│  REVIEW QUEUE                            [RUN SCOUT]        │
│  [pending: N]  [approved: N]  [submitted: N]                │
├────────────────┬────────────────────────────────────────────┤
│                │                                            │
│  Job list      │  Detail panel                              │
│  (left 30%)    │  (right 70%)                               │
│                │                                            │
│  Sorted by     │  Tabs:                                     │
│  score desc    │  [Resume Diff] [Cover Letter] [Form] [SS]  │
│                │                                            │
│  Each item:    │  Resume Diff tab:                          │
│  • Company     │  Two-column: Original | Tailored           │
│  • Role        │  Changed lines highlighted (red/green)     │
│  • Score badge │                                            │
│  • CV track    │  Cover Letter tab:                         │
│    color dot   │  Read-only preview + word count            │
│  • Status chip │                                            │
│                │  Form tab:                                 │
│                │  Table of field→value mappings             │
│                │  Flags: requires_manual fields in amber    │
│                │                                            │
│                │  Screenshot tab:                           │
│                │  Before / Filled side by side              │
│                │                                            │
│                │  ─────────────────────────────────────     │
│                │  [APPROVE & SUBMIT]  [REJECT]  [EDIT]      │
└────────────────┴────────────────────────────────────────────┘
```

### Component breakdown

- ReviewQueue.tsx — page container, fetches queue from Supabase
- JobQueueList.tsx — scrollable left panel, job cards
- JobDetailPanel.tsx — right panel with tab switcher
- ResumeDiffViewer.tsx — side-by-side diff with change highlighting
- CoverLetterPreview.tsx — read-only letter view
- FormMappingTable.tsx — field/value table with manual flags
- ScreenshotComparison.tsx — before/filled image viewer
- ApprovalControls.tsx — approve/reject/edit buttons with confirm modal

### Styling rules
- Match existing design system: dark bg, Space Mono + Syne, purple/teal accents
- Do not introduce new color variables. Use what exists in the codebase.
- Score badge: color interpolates from red (1) through yellow (5) to teal (10)
- CV track dot: teal = ux, purple = pm, orange = devrel

---

## 6. AGENT ORCHESTRATION SERVICE

File: src/services/agentOrchestrator.ts

```ts
// Exported function signatures — implement fully
export async function runFullPipeline(jobUrl: string): Promise<void>
// Scout → Classify → CVSelect → TailorResume → WriteCoverLetter →
// MapForm → CaptureScreenshot → Enqueue

export async function runScoutOnly(): Promise<ScoutResult[]>
// Scout → Classify → Enqueue (no document generation)

export async function runDocumentsForJob(jobId: string): Promise<void>
// CVSelect → TailorResume → WriteCoverLetter for a specific already-queued job

export async function approveAndSubmit(jobId: string, notes?: string): Promise<void>
// ReviewGatekeeper.approve → FormMapper.submit → StatusTracker.watch

export async function runStatusSync(): Promise<void>
// StatusTracker for all submitted applications
```

Every step must:
1. Write an agent_run record with status 'running' before starting
2. Update it to 'success' or 'failed' with output/error after
3. Write application_artifacts for every artifact produced

---

## 7. ENVIRONMENT VARIABLES

Add to .env.example (do not touch .env):

```
# Existing (do not change)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ANTHROPIC_API_KEY=
VITE_GROQ_API_KEY=

# New
VITE_HUNTER_API_KEY=          # for email discovery
VITE_REMOTIVE_API_URL=https://remotive.com/api/remote-jobs
VITE_N8N_WEBHOOK_SECRET=      # for scheduled trigger auth
```

---

## 8. TESTS (MANDATORY — DO NOT SKIP)

File: src/agents/__tests__/

Write Vitest tests for every agent. Use vi.mock for all API calls.
No test should make real network requests.

### Required test files

```
src/agents/__tests__/classifier.test.ts
src/agents/__tests__/cvSelector.test.ts
src/agents/__tests__/resumeTailor.test.ts
src/agents/__tests__/coverLetterWriter.test.ts
src/agents/__tests__/reviewGatekeeper.test.ts
src/agents/__tests__/statusTracker.test.ts
src/agents/__tests__/agentOrchestrator.test.ts
```

### Minimum test cases per agent

classifier.test.ts:
- Returns score between 1–10
- Discards jobs below threshold (score < 6)
- Assigns correct cv_track for UX, PM, DevRel roles
- Handles malformed API response without throwing

resumeTailor.test.ts:
- Does not alter company names, dates, or role titles
- Produces a non-empty diff array when changes are made
- Returns valid TailoredResume shape
- Strips markdown fences before parsing JSON

coverLetterWriter.test.ts:
- Word count stays under 300
- Does not contain banned phrases ("passionate about", "leverage", "synergy")
- Returns subject_line, body, word_count fields

reviewGatekeeper.test.ts:
- Cannot call submit() when status !== 'approved'
- approve() transitions status correctly
- reject() transitions status correctly
- getQueue() only returns 'pending_review' records

agentOrchestrator.test.ts:
- runFullPipeline calls all agents in correct order
- Failure in any agent writes 'failed' agent_run record
- Does not call submit if gatekeeper not approved

---

## 9. FILE DELIVERY CONTRACT

For every file you create or modify:

1. State: "Creating [filename] — [one line reason]"
2. Deliver the complete file. No truncation. No "// ... rest of file".
3. After all files: run `npx vitest run` and paste the output.
4. If tests fail: fix and re-run. Do not deliver until green.
5. Final statement: "All files complete. Tests passing. Safe to merge."

If at any point you cannot deliver a complete file, STOP and say:
"Cannot complete [filename] without clarification: [specific question]"

Do not proceed past a blocker. Do not guess.

---

## 10. CHANGE SCOPE BOUNDARIES

### You WILL touch:
- src/agents/ (all new files)
- src/services/agentOrchestrator.ts (new file)
- src/pages/ReviewQueue.tsx and subcomponents (new files)
- src/router or App.tsx (add /review-queue route only)
- supabase/migrations/ (new migration file)
- .env.example (append new vars only)
- src/agents/__tests__/ (new test files)

### You WILL NOT touch:
- Any existing page component
- Any existing Supabase table or migration
- Any existing API utility unless adding an export
- Any existing type that is already defined
- tailwind.config.js, vite.config.ts, tsconfig.json
- Any file not listed above

If a required change falls outside this boundary, STOP and flag it.

---

## 11. EXECUTION ORDER

Run these steps in order. Do not skip. Do not reorder.

```
STEP 1  Read codebase (mandatory before writing anything)
STEP 2  Confirm existing router pattern and report it
STEP 3  Confirm existing Supabase client export path
STEP 4  Confirm existing Anthropic + Groq API utility paths
STEP 5  Confirm existing type definitions
STEP 6  Write supabase migration file
STEP 7  Write src/agents/scout.ts
STEP 8  Write src/agents/classifier.ts
STEP 9  Write src/agents/cvSelector.ts
STEP 10 Write src/agents/resumeTailor.ts
STEP 11 Write src/agents/coverLetterWriter.ts
STEP 12 Write src/agents/formMapper.ts
STEP 13 Write src/agents/screenshotCapturer.ts
STEP 14 Write src/agents/reviewGatekeeper.ts
STEP 15 Write src/agents/statusTracker.ts
STEP 16 Write src/services/agentOrchestrator.ts
STEP 17 Write all UI components (ReviewQueue + subcomponents)
STEP 18 Add route to router
STEP 19 Write all test files
STEP 20 Run npx vitest run — fix until green
STEP 21 Run npx tsc --noEmit — fix all type errors
STEP 22 Report: files created, tests passing, type-check clean
```

---

## 12. SESSION START COMMAND

Paste this to begin:

> "Read the codebase per STEP 1–5 of the execution order. Report back:
> router pattern, Supabase client path, API utility paths, existing type
> definitions. Do not write any code yet."

Wait for the report. Confirm it looks correct. Then say:

> "Confirmed. Execute STEP 6 through STEP 22."

---

*Generated for atharux job tracker — May 2026*
*Do not share publicly — contains owner profile data used in agent prompts*
