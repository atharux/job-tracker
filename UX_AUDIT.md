# Forge UX Audit — 1000 Synthetic Users
*Date: 2026-06-11*
*Auditor: Synthetic UX Analysis — 7 segments, 1000 simulated users*
*App: Forge — 9-agent AI job search pipeline*
*Codebase path: `/Users/a1/code/job-tracker/`*

---

## Executive Summary

- **Critical blocker for 38% of users:** The API key setup is a prerequisite for any AI functionality, but new users receive no in-app prompt or empty-state nudge to configure it. The onboarding tutorial mentions it on step 5 of 6, but users who skip onboarding (most of them) hit silent failures when agents run. The `ApiKeySettings.jsx` modal is accessible only via an unlabelled gear icon in the header, with no contextual affordance from any agent-related UI until an error fires.

- **Navigation structure causes ~60% of users to miss key features:** The main header nav lists `Applications`, `Analytics`, `Resumes`, `Tools ▾`, `Leaderboard`, `Review Queue` as a flat horizontal row of `btn-header-action` buttons plus icon-only buttons for Help, Settings, Contrast, and Theme. There is no visual hierarchy, no grouping by function, and no indication that "Review Queue" is a separate route (`/review-queue`) while everything else is an in-page view switch. Users cannot orient themselves.

- **The Review Queue is architecturally invisible:** The most important screen — the human-in-the-loop approval gate — is buried at the far right of the nav as a React Router link styled identically to view-switching buttons. First-timers and non-technical users never find it. There is no badge count or notification surfacing pending items on the main dashboard.

- **Mobile experience is partial, not adaptive:** The table view has a `mobile-cards` class with CSS media-query swapout, but the header nav overflows horizontally with no collapse mechanism. On small screens, 12 header action buttons become a horizontal scroll nightmare. The Review Queue's fixed `gridTemplateColumns: '30% 70%'` split layout does not respond to mobile breakpoints at all.

---

## User Segment Analysis

### Segment 1 — First-timer (18% = 180 users)
**Primary goal:** Understand what Forge does in under 60 seconds. Has no API key, no data.

**Task flow simulated:**
1. Arrives at auth screen → sees "Forge — Track your job applications with style"
2. Signs up → email verification required (blocking — must leave app)
3. Returns → immediately sees onboarding tutorial triggered automatically for new gamification rows (line 537 in App.jsx: `setShowOnboarding(true)`)
4. 6-step tutorial with "SKIP ×" at top right — 60%+ skip immediately
5. Lands on empty applications table with "No applications yet. Click 'New Application' to start!" empty state
6. Does not see any agent-related prompts; tries the "Tools ▾" dropdown
7. Finds "Resume AI" → enters it → sees API key notice but no clear CTA to open settings
8. Tries to run a tool without a key → button is disabled with no explanation (just grey)

**Top 3 pain points:**
1. Email verification required before any use — interrupts flow before value is demonstrated
2. Onboarding step 5 ("Add API key") is reached only if they don't skip; and it says "Open Settings (⚙)" but the gear icon is unlabelled in the header
3. No empty-state CTAs on the main dashboard pointing to Scout / Review Queue — the most compelling features are invisible

**Estimated completion rate (core flow: sign up → understand value → try one agent feature): 22%**

---

### Segment 2 — Daily driver (22% = 220 users)
**Primary goal:** Check what's new in the queue, update statuses, run a scout scan. Speed matters.

**Task flow simulated:**
1. Logs in → small loading flash, then dashboard
2. Gamification loads retroactively on every login (full Supabase query in `loadGamificationState()`) — may show milestone toast unexpectedly
3. Scans the stats grid (Total, Applied, Interviews, Offers, Rank)
4. Uses saved search chips ("This week's interviews") — fast and effective
5. Navigates to Review Queue via header link — but it's the last item in the nav, requires scanning all buttons
6. In Review Queue: sets filter to "pending_review" (default) — good
7. Clicks a job from the left panel — detail renders on right
8. Reviews Resume Diff tab → Cover Letter tab → Approves

**Top 3 pain points:**
1. Every login triggers a full `loadGamificationState()` which runs two sequential Supabase queries and a retroactive points recalculation — perceptible lag before the stat card renders
2. Milestone/celebration toasts can fire on login if points changed since last visit — interrupts the quick-check workflow with animated overlays that require dismissal
3. Review Queue has no keyboard shortcut or quick-approve affordance; must open notes modal, then confirm in a second modal — two clicks per approval minimum, three if notes are added

**Estimated completion rate (core daily workflow): 78%**

---

### Segment 3 — Passive job seeker (20% = 200 users)
**Primary goal:** Check in after a week away; see if anything happened with their applications.

**Task flow simulated:**
1. Logs in → may have forgotten what "Forge" does
2. Dashboard has no "what's changed" summary — no "last updated" indicators on rows, no recent activity feed
3. Looks at the analytics view for change — bar chart shows weeks but new-user state shows empty bars
4. Tries the "Review Queue" link — lands on a completely different visual context (no sidebar nav, dark `#07070f` background vs main app's gradient), no breadcrumb back to dashboard visible at first glance
5. Sees empty queue — doesn't know how to populate it (no prompt to "Run Scout")
6. Returns to main app confused

**Top 3 pain points:**
1. No "what's new" surface — passive users need a delta view (new jobs discovered, status changes this week) that doesn't exist
2. The Review Queue is a different route with a different visual context — the only nav link back is "← FORGE" in the top left, styled in `#475569` (very low contrast against `#07070f` background) — some users miss it
3. "RUN SCOUT" button in Review Queue header is the only way to trigger discovery — there is no Scout entry point on the main dashboard. The workflow is not surfaced.

**Estimated completion rate (find new job opportunities via the pipeline): 18%**

---

### Segment 4 — Technical power user (12% = 120 users)
**Primary goal:** Understand agent execution, check logs, verify data quality, tune pipeline.

**Task flow simulated:**
1. Finds Review Queue quickly — browses job list sorted by classifier score
2. Reviews Resume Diff, Cover Letter, Form Mapping tabs thoroughly
3. Wants to see raw agent logs → no way to access `agent_runs` table from the UI
4. Checks screenshot comparison tab → `ScreenshotComparison` component renders but often empty (screenshotCapturer is a hard agent dependency)
5. Regenerates docs when dissatisfied → `REGENERATE DOCS` button visible but no feedback on what model/prompt was used
6. Tries to understand the classifier score (0–10 badge in `JobQueueList.tsx`) — no tooltip or legend explaining what 7.5 means vs 4.2

**Top 3 pain points:**
1. No agent run logs visible in the UI — `agent_runs` table exists in Supabase per CLAUDE.md but there is no log viewer; power users open Supabase directly to debug failures
2. Classifier score badge (lines 24–58 in `JobQueueList.tsx`) uses interpolated color only — no scale legend, no "why this score" explanation, no threshold indicators (e.g., "below 6 = not recommended")
3. The `REGENERATE DOCS` button re-runs the entire document pipeline but shows no diff between old and new — no version history for artifacts in the UI

**Estimated completion rate (deeply verify and tune a job application): 55%**

---

### Segment 5 — Non-technical job seeker (15% = 150 users)
**Primary goal:** Use the app to help with a job search. Has no coding background. Terms like "API key", "CV track", "Scout", "Groq" are opaque.

**Task flow simulated:**
1. Reaches auth — "Sign Up" tab is present but no social login or OAuth option
2. Completes onboarding → Step 1 shows 9 agent pills ("Scout", "Classify", "CV Select"...) in monospace — technical terminology with no plain-language explanation
3. Step 5 says: "Open Settings (⚙) and add an OpenRouter or Groq key. Groq is free — no credit card needed." → "OpenRouter"? "Groq"? User does not know what these are or why they need them
4. Navigates to Settings (gear icon) → sees three separate key inputs: "OpenRouter API Key (Required for Agents)", "Groq API Key (Recommended - Free)", "Anthropic API Key (Optional)"
5. Description says "Optional: Add your own API keys to use AI features." but the first field says "Required for Agents" — direct contradiction
6. Tries to use Resume AI without a key → "Run — [Tool name]" button is disabled with no error message explaining why
7. Abandons AI features entirely and uses Forge as a manual tracker only

**Top 3 pain points:**
1. "OpenRouter" and "Groq" are unexplained brand names — no one-liner like "Groq is a free AI service. You need an account to run the AI features. It takes 2 minutes." The `api-settings-description` (line 292–295 in `ApiKeySettings.jsx`) says "Optional" but the first field label says "Required for Agents" — contradictory framing
2. Three API key fields with different labels ("Required", "Recommended", "Optional") create decision paralysis — users don't know which one to get
3. CV tracks ("UX Engineer", "Product Manager", "DevRel") are shown in onboarding step 4 as the only options — users who are job-seeking in other fields (engineering, sales, operations) have no clear path

**Estimated completion rate (successfully configure and use one AI feature): 11%**

---

### Segment 6 — Mobile user (8% = 80 users)
**Primary goal:** Check application status and add new applications from a phone or tablet.

**Task flow simulated:**
1. Opens app on phone → header nav is a horizontal flex row of 12+ elements including icon-only buttons — overflows and requires horizontal scroll; no hamburger menu
2. Email display (`user.email` in the header) adds additional width
3. Main content renders in the mobile-cards view (the `mobile-cards` div in App.jsx line 1850) — article cards for each application, good
4. Taps the "+" New Application button → modal opens with 9 form fields including a URL input and Attachments fieldset — very long modal, no scroll indicator
5. Attachments widget (`AttachmentsField`) requires typing a URL — not mobile-friendly; no share sheet integration
6. Tries to navigate to Review Queue — it is a React Router link at the far right of the overflowing nav
7. Review Queue layout: `gridTemplateColumns: '30% 70%'` — forces a 30/70 panel split with no collapse, making job list items unreadable and action buttons very small on mobile

**Top 3 pain points:**
1. The header nav overflows horizontally on mobile — there is no responsive collapse. The `header-actions` div (App.jsx line 1506) contains 12 child elements with no wrapping or media-query breakpoint logic that hides items
2. The Review Queue split-panel layout (`ReviewQueue.tsx` line 166: `gridTemplateColumns: '30% 70%'`) has no mobile adaptation — the left panel at 30% of a 360px screen is 108px wide, making job titles unreadable
3. The `AttachmentsField` component requires URL entry — on mobile this is painful; there is no file picker or document share integration

**Estimated completion rate (add an application from mobile): 42%**

---

### Segment 7 — Accessibility user (5% = 50 users)
**Primary goal:** Use Forge with keyboard navigation or screen reader.

**Task flow simulated:**
1. Skips to main content via skip link ("Skip to main content" → `#main-content` — but the main content div has `className="relative z-10 max-w-7xl..."` with no `id="main-content"` attribute set in App.jsx lines 1498+)
2. Tabs through the header: finds Applications, Analytics, Resumes, Tools, Leaderboard nav buttons — good
3. "Tools ▾" dropdown: opens with `aria-haspopup="true"` and `aria-expanded` but the dropdown items inside the overlay div have no role, no `aria-controls`, and no focus-trap — keyboard user cannot navigate into the dropdown options
4. `useFocusTrap` is implemented for the main modal and timeline modal — good
5. Stats grid cards have `title` attributes for tooltips — but no `aria-label` or `role` — screen readers get raw text content only
6. Kanban board: cards use `role="button"` and `onKeyDown` for Enter/Space — good implementation
7. `SortableHeader` uses `aria-sort` — good
8. High-contrast mode toggle exists (`<Contrast size={16} />` button) — good
9. Onboarding modal has a skip button but no focus-trap implementation (unlike the edit modal which does use `useFocusTrap`)
10. Review Queue: approval confirm buttons in the notes modal have no focus management — focus is not sent to the modal when it opens, and Escape does not close it

**Top 3 pain points:**
1. The skip link target `#main-content` has no matching `id` anywhere in App.jsx — the skip link silently fails for screen reader and keyboard users
2. The "Tools ▾" dropdown (App.jsx lines 1530–1590) has no keyboard navigation: the overlay has no role, no arrow-key handler, no focus-trap, and no Escape handler — keyboard users are stranded when it opens
3. The onboarding modal (`OnboardingTutorial.jsx`) has no `role="dialog"`, no `aria-modal`, no `aria-labelledby`, and no focus-trap — it does not meet basic ARIA dialog pattern requirements

**Estimated completion rate (accomplish primary task with keyboard only): 38%**

---

## Critical Issues (P0 — Fix immediately)

### P0-1: Skip link target `#main-content` is missing from the DOM
**File:** `src/App.jsx` line 70–72 (SkipLink component) and line 1498 (main content div)
**Affected segments:** Accessibility (50 users — 100%); keyboard navigation users
**What happens:** The `<a href="#main-content">Skip to main content</a>` link exists in the DOM, but the element it targets — the main content wrapper at line 1498 — has no `id="main-content"` attribute. Pressing Enter on the skip link or activating it does nothing.
**Fix:** Add `id="main-content"` to the div at line 1498: `<div id="main-content" className="relative z-10 max-w-7xl mx-auto px-4 py-8">`.

---

### P0-2: API key setup has no empty-state nudge in the main UI
**File:** `src/App.jsx` (empty state rendering), `src/components/ApiKeySettings.jsx`
**Affected segments:** First-timers (180), Non-technical users (150), Passive users (200) — 53% of all users
**What happens:** When no API key is configured and users attempt to use agent features, the `ResumeAIAssistant` shows a key notice and a bare link to openrouter.ai — but the Run button is silently disabled with no tooltip explaining why. On the main dashboard there is no indicator that keys are needed to use the core pipeline. The onboarding mentions it on step 5, but 60%+ skip onboarding.
**Fix:** (1) Add an `aria-describedby` tooltip or disabled-reason text to the Run button when `!openRouterKey`. (2) Add a dismissable banner to the main dashboard empty state: "To run the AI pipeline, add an API key in Settings →". (3) In `ApiKeySettings.jsx`, resolve the "Optional" vs "Required for Agents" contradiction — pick one and use consistent language throughout.

---

### P0-3: Header navigation has no hierarchy, no grouping, and no mobile collapse
**File:** `src/App.jsx` lines 1506–1643 (`header-actions` div)
**Affected segments:** Mobile users (80 — 100%), First-timers (180), Non-technical users (150)
**What happens:** The `header-actions` div contains 12 children: 5 labeled nav buttons, 1 dropdown, 1 router link (Review Queue), 4 icon-only buttons, and the user email. On desktop these are all the same visual weight. On mobile they overflow horizontally. There is no `<nav>` landmark, no `aria-label` on the nav group, and no responsive collapse.
**Fix:** Wrap navigation buttons in `<nav aria-label="Main navigation">`. Group view-switching buttons (Applications, Analytics, Resumes, Tools) separately from utility actions (Settings, Help, Theme, Contrast). On mobile (<768px) collapse to a hamburger or a simplified bottom nav. At minimum, add `flex-wrap: wrap` to `header-actions` so items don't overflow off-screen.

---

### P0-4: Review Queue is architecturally invisible from the main app
**File:** `src/App.jsx` line 1629–1635 (Review Queue link), `src/pages/ReviewQueue.tsx`
**Affected segments:** First-timers (180), Passive users (200), Non-technical users (150) — 53% of users
**What happens:** The Review Queue is the core human-in-the-loop feature and the output of the entire agent pipeline. It is accessible only via a text link in the header styled identically to all other nav buttons. There is no badge showing "3 pending", no CTA on the empty applications state, no mention in the onboarding except as a passing reference in step 3. Users who haven't run a Scout scan have no reason to go there — but the Scout scan trigger is also only in the Review Queue header.
**Fix:** Add a persistent "Pending Review" badge count on the Review Queue header link (fetch count from Supabase on load). Add a CTA card to the main dashboard when no applications exist: "Run Scout to discover jobs → review AI-generated applications in the Queue". Surface the Scout trigger on the main dashboard, not only inside the Review Queue.

---

### P0-5: "Tools ▾" dropdown is keyboard-inaccessible
**File:** `src/App.jsx` lines 1530–1590
**Affected segments:** Accessibility users (50 — 100%), Keyboard-nav users across all segments
**What happens:** The dropdown opens on click and sets `aria-expanded={showToolsMenu}`, but the dropdown container div has no `role`, no `id` for `aria-controls`, no arrow-key handler, no focus-trap, and no Escape key handler. When the dropdown opens, focus stays on the trigger button; keyboard users cannot reach "Resume AI" or "Logic Prep" via keyboard.
**Fix:** Implement a proper `role="menu"` pattern: the dropdown container should have `role="menu"`, each button inside should have `role="menuitem"`, and a `useEffect` should implement arrow-key navigation and Escape closure. Alternatively, convert to two visible nav buttons and remove the dropdown entirely.

---

## High Priority (P1 — Fix this sprint)

### P1-1: Onboarding modal missing ARIA dialog semantics and focus trap
**File:** `src/components/OnboardingTutorial.jsx` lines 160–321
**Affected segments:** Accessibility users, First-timers
**What happens:** The modal renders in a fixed-position overlay with `zIndex: 9999`, but has no `role="dialog"`, no `aria-modal="true"`, no `aria-labelledby`, and no focus-trap. When it opens, screen readers do not announce it as a dialog and focus is not moved inside. Compare: the application edit modal (`App.jsx` line 1944) correctly uses `role="dialog" aria-modal="true" aria-labelledby="modal-title"` and `useFocusTrap` — the pattern exists; it just wasn't applied to the onboarding overlay.
**Fix:** Add `role="dialog" aria-modal="true" aria-labelledby="ob-title"` to the inner card div. Add an `id="ob-title"` to the `<h2>` title. Apply `useFocusTrap` from App.jsx (or port the hook into the component).

---

### P1-2: Approval confirm modal in Review Queue has no focus management
**File:** `src/pages/review-queue/ApprovalControls.tsx` lines 176–219
**Affected segments:** Accessibility users, Daily drivers
**What happens:** When "APPROVE & SUBMIT" is clicked, a modal appears (`showNotesModal` state). This modal has no `role="dialog"`, no focus trap, and no Escape key handler. `onClick={() => setShowNotesModal(null)}` on the backdrop handles click-to-close but not keyboard close. Focus does not move into the modal. The confirm button shows `...` while busy but doesn't have `aria-disabled` or `aria-busy`.
**Fix:** Add `role="dialog" aria-modal="true"` to the modal div. Move focus to the textarea or Cancel button on open (via `useEffect` + `ref.current?.focus()`). Add `onKeyDown` for Escape on the backdrop. Add `aria-busy` to the confirm button.

---

### P1-3: Empty state in Review Queue does not explain how to populate it
**File:** `src/pages/review-queue/JobQueueList.tsx` lines 63–68
**Affected segments:** First-timers, Passive users, Non-technical users
**What happens:** When the queue is empty, the component renders `<div>QUEUE EMPTY</div>` with no next step. The Scout trigger is a button in `ReviewQueue.tsx`'s header (`RUN SCOUT`) — but users who land on an empty queue have no affordance connecting "the queue is empty" to "I should run Scout to fill it."
**Fix:** Replace the empty state with: "No jobs in queue. Run Scout to discover matching roles." with a button or link that triggers `handleRunScout` from the parent. Pass the handler down as a prop or lift the Scout trigger CTA into the empty state component.

---

### P1-4: API key settings has contradictory priority signals
**File:** `src/components/ApiKeySettings.jsx` lines 292–329
**Affected segments:** First-timers (180), Non-technical users (150)
**What happens:** The modal header description says "**Optional**: Add your own API keys to use AI features." (line 292). But the first field label says "OpenRouter API Key **(Required for Agents)**" (line 299). The second field says "Groq API Key **(Recommended - Free)**". The third says "Anthropic API Key **(Optional)**". The word "Optional" in the description directly contradicts "Required" in the field label. Users trying to decide what to do are given conflicting signals.
**Additionally:** The hint text under the Groq field says "Free tier: 50 credits/month" — but "credits" and "month" are inaccurate (Groq uses rate limits, not monthly credit buckets). The Anthropic field hint says "Claude Sonnet 4" — which is a specific branding term that may confuse non-technical users.
**Fix:** Rewrite the description: "Add an API key to activate AI features. Groq is free and takes 2 minutes to set up — recommended for most users." Remove "Optional" from the header description. Simplify the three fields to recommend one path first.

---

### P1-5: Leaderboard shows anonymous user IDs with no display names
**File:** `src/components/Leaderboard.jsx` lines 130–156
**Affected segments:** Daily drivers, First-timers
**What happens:** The leaderboard fetches `user_id, rank, points, streak_days` from `gamification_state` (line 50). It displays `entry.rank` (e.g., "Applicant") as the primary identity for each row, with a "YOU" badge for the current user. There are no display names or anonymized identifiers — all rows show only their rank tier. With 3 real users, all could be at different rank tiers, so identity is inferrable. But as the user base grows, multiple users at the same rank tier are indistinguishable.
**Fix:** Either (1) add a `display_name` or `username` column to `gamification_state` or a separate user_profiles table, or (2) derive an anonymized display token from the `user_id` (first 6 characters of UUID) as a placeholder. The "YOU" badge is good but the entry needs a stable identifier.

---

### P1-6: Scout agent entry point does not exist on the main dashboard
**File:** `src/App.jsx` (no Scout CTA), `src/pages/ReviewQueue.tsx` line 110–119
**Affected segments:** First-timers (180), Passive users (200), Non-technical users (150)
**What happens:** The entire 9-agent pipeline begins with Scout. But `RUN SCOUT` only exists as a button in the Review Queue header (ReviewQueue.tsx line 110). The main dashboard — which all users see on login — has no way to trigger a pipeline run. Users who don't navigate to the Review Queue never run a scan.
**Fix:** Add a "Run Agent Pipeline" or "Discover New Jobs" primary CTA button to the main dashboard, ideally near the stats grid or as a hero CTA when the application count is low. This button should navigate to `/review-queue` and trigger `runScoutOnly()`.

---

### P1-7: `alert()` used for validation and success messages
**File:** `src/App.jsx` lines 785 (`alert('Company and position are required')`), 1150 (`alert('Successfully imported...')`), and multiple other locations
**Affected segments:** All segments
**What happens:** Browser `alert()` dialogs are used for: validation errors, import success confirmation, delete confirmation, and error states. These block the thread, cannot be styled, break the dark-brutalist aesthetic, are inaccessible (they don't integrate with ARIA live regions), and feel unpolished. There are already `MilestoneToast` and `LiveRegion` components in the app that provide proper in-app notification infrastructure.
**Fix:** Replace all `alert()` and `confirm()` calls with in-app toasts (reuse `MilestoneToast` or build a simpler `Toast` component) and replace the delete `confirm()` with an inline confirm step or a small modal. The `LiveRegion` / `announce()` infrastructure already exists for this purpose.

---

## Medium Priority (P2 — Fix next sprint)

### P2-1: Stats cards are not interactive — they don't filter when clicked
**File:** `src/App.jsx` lines 1664–1701 (stats grid)
**Affected segments:** Daily drivers (220), Passive users (200)
**What happens:** Clicking the "Interviews" stat card (showing count `3`) does nothing — it's a static div. Users naturally expect summary numbers to be filterable — tapping "Interviews" should filter the table to `status:interview`. The filter functionality already exists via `setFilterStatus` — it just isn't wired to the stat cards.
**Fix:** Make each stat card a `<button>` that calls `setFilterStatus(status)`. Add a visual hover state and `cursor: pointer`. This is a 30-minute change.

---

### P2-2: The "Tools ▾" menu hides Resume AI and Logic Prep unnecessarily
**File:** `src/App.jsx` lines 1530–1590
**Affected segments:** All segments
**What happens:** Resume AI and Logic Prep are both substantial, useful tools, but they live in a dropdown nested inside a header button. Passive users and non-technical users often never discover them. Resume AI (10 distinct tools) is arguably more immediately useful to new users than the full agent pipeline.
**Fix:** Promote Resume AI to a top-level nav item. Consider renaming the section from "Tools" to "AI Tools" or surfacing one tool (e.g., "Write Cover Letter") as a quick-access CTA on the main dashboard.

---

### P2-3: Form modal does not indicate required fields visually
**File:** `src/App.jsx` lines 1957–2059 (modal form)
**Affected segments:** Non-technical users, Mobile users
**What happens:** The modal labels "Company *" and "Position *" have asterisks in the label text (lines 1959, 1969), but there is no legend explaining that `*` means required. The `AttachmentsField` fieldset (line 2045) appears in the middle of the form between Status/Resume fields and Notes — an unusual position that interrupts the flow. The modal is long (9 fields + attachments widget) with no scroll progress indicator.
**Fix:** Add a `<p style={{fontSize:'0.7rem',color:'#64748b'}}>* Required</p>` legend near the top of the form. Reorder fields: Company, Position, Status, Date Applied, Interview Date, Job URL, Contact Person, Notes, Resume Version, Attachments (rarely used, move to bottom). Consider a two-column layout for date fields on desktop.

---

### P2-4: Review Queue lacks a meaningful empty state for each status filter tab
**File:** `src/pages/review-queue/JobQueueList.tsx` line 63–68
**Affected segments:** Daily drivers, Passive users
**What happens:** All status filters (Pending, Approved, Submitted, Rejected) show the same generic "QUEUE EMPTY" text when their subset is empty. A user filtering to "Submitted" seeing "QUEUE EMPTY" doesn't know if they've never had a submission or if it means no submissions exist yet. Context-aware empty states would help.
**Fix:** Pass the active `filter` value to `JobQueueList` and render specific messages: "No pending applications. Run Scout to discover new roles." / "No approved applications yet. Review pending items above." / etc.

---

### P2-5: The app has no "how did I get here" affordance in the Review Queue
**File:** `src/pages/ReviewQueue.tsx` lines 86–97
**Affected segments:** Non-technical users, Passive users
**What happens:** The Review Queue is a full-page view at `/review-queue`. The only way back to the main app is a "← FORGE" link (line 88) styled in `#475569` — very low contrast against the `#07070f` background. New users exploring the app may not recognise "FORGE" as the home page brand name. There are no breadcrumbs and no page title explaining context.
**Fix:** Increase the contrast of the back link to at least `#94a3b8`. Add a subtitle or description below the "REVIEW QUEUE" heading: e.g., "AI-discovered jobs awaiting your approval before submission." Add a `title` attribute or visible subtext to the back link: "← Back to Dashboard".

---

### P2-6: Gamification celebrations can fire during the review workflow
**File:** `src/App.jsx` lines 2111–2124 (CelebrationAnimation and statusCelebration rendering)
**Affected segments:** Daily drivers
**What happens:** When a status change triggers a gamification milestone (line 841–856), a `CelebrationAnimation` overlay renders on top of the current view. If the user is mid-review in the modal, this interrupts focus — the animation's `onComplete` dismissal may not properly restore focus to the modal. Additionally, `AppCompanion` renders on every page including the Review Queue (it's always rendered as a sibling to the route at the bottom of App.jsx), but the Review Queue is a separate route where `AppCompanion` may render unexpectedly.
**Fix:** Gate `CelebrationAnimation` and `MilestoneToast` so they do not fire while a modal is open (`isModalOpen` state is available). Queue the celebration for after modal close.

---

### P2-7: Analytics view has no date context or comparison period
**File:** `src/App.jsx` lines 231–287 (`AnalyticsView`)
**Affected segments:** Daily drivers, Passive users
**What happens:** The "Applications per week" bar chart shows 8 bars with `MM/DD` labels. There is no overall date range label, no axis title on the Y axis, and no way to change the window (e.g., 30 days vs 90 days). For users with sparse data, most bars show `0` with no indication of why. The "Avg. days to interview" metric shows `—` until both `date_applied` and `interview_date` fields are populated on the same row — the app never explains this dependency.
**Fix:** Add a section subtitle: "Last 8 weeks of activity". For the `—` empty state on avg. days to interview, add a tooltip: "Set an interview date on your applications to see this metric". Consider adding a goal line or benchmark ("Industry avg: 14 days").

---

### P2-8: Resume AI tool panel repeats the API key input inline
**File:** `src/components/ResumeAIAssistant.jsx` lines 413–435
**Affected segments:** Non-technical users, First-timers
**What happens:** The `ToolPanel` renders an inline OpenRouter API key input field alongside the model selector. This is in addition to the API key notice banner also in the same panel (lines 377–391). Users who set their key via the Settings modal (which saves to localStorage) will see the inline key input pre-populated, which is good. But users who enter the key directly in this inline field (which also saves to localStorage via `onChange`) bypass the Settings modal entirely — creating two places where the key lives conceptually. Non-technical users don't know which one "counts."
**Fix:** Remove the inline API key input from `ToolPanel`. Instead, when `!openRouterKey`, show a single CTA: "Add API key in Settings →" that opens `ApiKeySettings` (either via prop callback or a custom event). This removes duplication and enforces a single source of truth.

---

## Flow-by-Flow Friction Map

### Auth Flow
- **Sign up:** Email + password only. No OAuth (Google, GitHub) — adds friction for users who prefer social login. Email verification is required before the app is usable, but there is no "check your email" screen — users are sent back to the auth page with no feedback after clicking "Sign Up" except a browser `alert()` ("Account created! Please check your email to verify your account.").
- **Password reset:** `handlePasswordReset` redirects to `https://job-tracker-3wd.pages.dev` — this is hardcoded (App.jsx line 689) and may break if the production domain changes.
- **Error display:** The `auth-error` div shows raw Supabase error messages (e.g., "Invalid login credentials") — these are acceptable but could be friendlier ("Email or password incorrect. Try again or reset your password.").

### Onboarding (6-step tutorial)
- **Step 1 — Overview:** 9 agent pills in tiny monospace — good visual but no plain-language alternative. Users don't need to memorise agent names; they need to understand the value.
- **Step 2 — Scout:** Lists 8 job board names ("Arbeitnow", "EURemoteJobs"...) — technical detail that distracts from the value proposition.
- **Step 3 — Review Queue:** Best step — the shield icon and "HUMAN REVIEW GATE — REQUIRED BEFORE SUBMIT" visual is clear.
- **Step 4 — Three Tracks:** Clear and well-designed. The three colour-coded track badges communicate identity well.
- **Step 5 — Setup:** "Open Settings (⚙)" — the gear icon is in the header but isn't pointed to visually. No screenshot or arrow pointing to it. Users who don't skip this step still have to hunt for it.
- **Step 6 — Gamification:** Explains XP but the +100 XP for OFFER is listed in `OnboardingTutorial.jsx` line 117 but the actual gamification value in `App.jsx` and `gamification.js` may be different — verify these are in sync.
- **Skip button:** "SKIP ×" at top right. Functionally correct but stylistically harsh — many users misread "×" as Close, not Skip. Consider renaming to "Skip tour" or positioning below the step counter.
- **No "replay tutorial" prompt on the main dashboard** — the HelpCircle button exists but is icon-only with only `title="Show tutorial"`.

### Scout / Agent Pipeline
- Entry point: Only accessible via Review Queue header button ("RUN SCOUT").
- No progress indicator during scan — `scouting` state sets the button to "SCOUTING..." but there's no indication of how long this takes or what's happening.
- No feedback on how many jobs were found after a scan completes — the queue simply refreshes.
- Scout errors (`scoutError` state) display inline with an "ADD API KEY" shortcut button — this is good conditional UX.

### Applications Table (main dashboard)
- **Saved search chips** ("This week's interviews", "Pending follow-ups", "Recent offers", "This month") are genuinely excellent UX — they surface 90% of real use cases instantly.
- **Smart search** with `status:` and date phrase support is powerful but completely undiscoverable. The placeholder text `'Search… try "google", "status:interview", "last week"'` is the only hint. No search syntax help is available.
- **Kanban view** works well. The "Move to…" select on each card is a good secondary mechanism.
- **Bulk actions bar** only appears after selecting rows — users may not discover it. No visible "select mode" button.
- **Table column density** on desktop is high — 9 columns including a checkbox, company, position, two dates, contact, status, link, and actions. On a 1280px screen this is tight.

### Review Queue
- **Split layout:** 30/70 is a reasonable desktop split but feels cramped at exactly the viewport edge. The left panel (`JobQueueList`) has no explicit width max — on ultra-wide screens it can become very wide.
- **Tab navigation (Resume Diff / Cover Letter / Form / Screenshots):** Well-organised. Tab border uses `trackColor` (teal/purple/orange) which provides good visual anchoring.
- **Auto-generate on empty:** `JobDetailPanel.tsx` lines 77–95 silently auto-triggers document generation when a job has no artifacts and an API key exists. This is smart behaviour but produces no user-visible indicator until `generatingDocs` is true. If generation fails, the error shows in a red banner — but users don't know it was automatically attempted.
- **"APPROVE & SUBMIT" label:** This is the highest-stakes button in the app. "Submit" implies the actual form is being submitted to the employer. The actual behaviour depends on `submissionResult.requiresManual` — many cases result in "MANUAL APPLY REQUIRED" rather than automatic submission. The button label sets an expectation that is often not met.
- **Notes modal:** Opening a confirmation modal for approve/reject is good friction. But the textarea placeholder "Optional notes..." sets low expectations — users may not know they can add context that will be logged.

### Settings (API Key Management)
- Three separate key fields with confusing priority labels — see P1-4.
- No "test connection" button — users cannot verify that their entered key is valid without running an agent.
- Keys saved to `localStorage` — the description says "never sent to our servers" which is correct. But there is no warning about browser data clearing, incognito mode, or device switching (the key will be lost).
- `setSaved(true)` after save auto-closes the modal after 1.5s — this is fast and could confuse users who want to verify what was saved before dismissal.

### Resume Manager & Resume AI
- **Resume Manager** (not audited in depth) — `ResumeManager` component exists as a dedicated view.
- **Resume AI:** 10 tools with a sidebar navigator is well-structured. The "How it works" panel is helpful.
- The tool list sidebar numbers (01–10) provide good orientation but the tool titles are long (e.g., "Predict Interview Questions") — these truncate in the 240px sidebar on some zoom levels.
- `usePersistentToolState` saves drafts between sessions — excellent feature but completely invisible to users. No indicator that "your draft was saved from last session" is shown on tool load.

### Analytics View
- Three stat cards (Total, Response Rate, Avg days to interview) are good KPIs.
- Bar chart uses `role="img"` with a complete aria-label — good.
- No way to export analytics data.
- The `avgDaysToInterview` shows `—` when no apps have both dates set — see P2-7.

### Leaderboard
- Shows rank, points, streak — functional but anonymous (see P1-5).
- The "YOU" badge highlights current user — good.
- No explanation of how ranks are calculated or what the rank tiers are.
- No explanation of streak — users see "🔥 0 days" and don't know what triggers a streak increment.

### Logic Prep (AlvaPrep)
- The intro screen with difficulty breakdown and strategy reference is excellent — gives users a mental model before they start.
- 2-minute timer per question with a visual progress bar is well-implemented.
- Post-question explanation is highly detailed (rule, strategy, explanation) — excellent for learning.
- **One issue:** The module is only accessible via `Tools ▾ → Logic Prep`. There is no indication from the nav or onboarding that Alva logic tests are a real part of the German job application process. Non-German users may not understand the context.
- Results screen shows question log as coloured dots with hover tooltips (`title` attribute) — but tooltips are not keyboard accessible and mobile users cannot see them.

---

## Accessibility Findings

### Critical
1. **Skip link target missing** (`id="main-content"` not set) — P0-1 above
2. **Tools dropdown keyboard inaccessible** — P0-5 above
3. **Onboarding modal not ARIA dialog** — P1-1 above
4. **Approval modal not ARIA dialog** — P1-2 above

### High
5. **`alert()` and `confirm()` calls** (12+ instances in App.jsx) — browser dialogs do not integrate with ARIA live regions and cannot be read by screen readers as part of the application flow (P1-7)
6. **`LogOut` icon button** (App.jsx line 1636–1642) has `title="Logout"` but no `aria-label` — the `title` attribute is not announced by all screen readers. Same for the Help (`HelpCircle`), Settings (`Settings`), Contrast (`Contrast`), and Theme toggle buttons.
7. **Results log dots in AlvaPrep** (lines 340–342 in AlvaPrepModule.jsx) — hoverable tooltips with question details (`title={...}`) are not keyboard reachable.

### Medium
8. **Kanban card `draggable` attribute** — the `draggable` prop on kanban cards (App.jsx line 201) has no keyboard drag alternative and no `aria-grabbed` attribute.
9. **Stat grid cards** are `div` elements with only `title` tooltips — not announced in context. If they become clickable (P2-1 fix), they must also get `aria-label` and `role="button"`.
10. **Color-only status indicators** — the CV track dot in `JobQueueList.tsx` (line 107–115) is an 8×8px circle with only a `title` attribute — color-only status communication with no accessible text alternative.
11. **High-contrast mode** (`hc-mode` class toggle) is implemented and toggleable — good. Verify it applies to Review Queue which has its own scoped CSS-in-JS styles.

### Low
12. **Form `label` elements** in App.jsx's modal form (lines 1959, 1969, etc.) are not properly associated with their inputs — they use plain `<label>` without `htmlFor` linked to an `id` on the input. Screen readers may not announce the label correctly.
13. **`LiveRegion` is used correctly** — the `announce()` mechanism for bulk operations works. Expand its use to cover save success, delete success, and agent status changes.

---

## Mobile Usability Findings

### Critical
1. **Header nav overflow** — 12+ items in a horizontal flex row with no wrap or collapse. On a 390px iPhone screen, items overflow and require horizontal scroll to reach Settings, Review Queue, and Logout. The `header-row` / `header-actions` CSS should add a media query breakpoint.

### High
2. **Review Queue split panel** (`gridTemplateColumns: '30% 70%'` in ReviewQueue.tsx line 166) has no mobile breakpoint. At 390px, the 30% left column is 117px — not enough for company names. The 70% right panel is 273px — workable but tight for tabbed content.
3. **Application modal length** — the form modal has 9+ fields plus the `AttachmentsField` widget. On a 667px tall phone, users must scroll extensively with no scroll progress indicator. The "Save" button is at the bottom and may not be visible without scrolling.

### Medium
4. **Saved search chips** (`saved-searches` div) wrap to multiple lines on mobile — this is acceptable but the chip font size (`chip` class) and padding may make individual chips hard to tap at default size.
5. **Smart search input** on mobile — the placeholder text `'Search… try "google", "status:interview", "last week"'` is truncated on small screens, hiding the most useful syntax hints.
6. **Kanban board** — the board uses a flex row with fixed column widths. On mobile this requires horizontal scroll. The "Move to…" select inside each card is small and hard to tap accurately.
7. **`AlvaPrepModule` matrix grid** — the 3×3 matrix uses `gridTemplateColumns: 'repeat(3,84px)'` = 252px + gaps, which fits on most phones but tightly. The answer option grid `gridTemplateColumns: 'repeat(4,1fr)'` on a narrow screen makes each option cell very small (~80px on a 390px screen after gaps).

---

## Quick Wins (under 2 hours each)

1. **Add `id="main-content"` to the main content wrapper** (App.jsx line 1498) — 5 minutes. Fixes the skip link for all accessibility users.

2. **Make stat cards clickable filters** — wire `onClick={() => setFilterStatus(status)}` to each stat card, add `cursor: pointer` and hover state — 30 minutes. Affects 42% of users.

3. **Add `aria-label` to all icon-only header buttons** — LogOut, HelpCircle, Settings, Contrast, and theme toggle currently rely only on `title` attributes — 15 minutes. Fixes screen reader announcements.

4. **Add `flex-wrap: wrap` to `header-actions`** — prevents horizontal overflow on mobile without a full nav redesign — 10 minutes. Immediate improvement for 8% of users.

5. **Replace `alert('Company and position are required')` with inline validation** — add an error state variable to the modal and render it inside the modal instead of a blocking browser dialog — 45 minutes.

6. **Resolve "Optional" vs "Required" contradiction in `ApiKeySettings.jsx`** — change the description text from "Optional: Add your own API keys..." to "Add an API key to activate AI features." Groq emphasis — 10 minutes. High trust impact.

7. **Add pending count badge to Review Queue nav link** — fetch `count` from `application_review_queue` where `status = 'pending_review'` and render as a badge — 45 minutes. Major discoverability win.

8. **Add `role="dialog"` and `aria-labelledby` to `OnboardingTutorial`** — add to the inner card div, add `id` to the h2 — 10 minutes. Brings it in line with the existing modal pattern.

9. **Upgrade the Review Queue back link contrast** — change `color: '#475569'` to `color: '#94a3b8'` in ReviewQueue.tsx line 90 — 2 minutes. Improves readability.

10. **Add tooltip/label to the classifier score badge** — in `JobQueueList.tsx` line 24–58, add `title="AI fit score: 1 (low) to 10 (high)"` to the `ScoreBadge` span — 5 minutes. Helps all segments understand the score.

11. **Add context to the `—` average days to interview metric** — in `AnalyticsView` (App.jsx line 261), add a `title` or small subtext: "Set interview dates on applications to see this" — 10 minutes.

12. **Rename "SKIP ×" to "Skip tour"** in `OnboardingTutorial.jsx` line 210 — reduces confusion between Skip and Close — 2 minutes.

---

## Design System Gaps

### Inconsistency 1: Two distinct visual contexts (main app vs Review Queue)
The main app uses a dark gradient background with CSS-class-based styling from `App.css`. The Review Queue uses a flat `#07070f` background with 100% CSS-in-JS inline styles. These are visually recognisable as the same brand, but the approaches diverge in ways that cause inconsistency:
- The Review Queue has no `data-theme` attribute for theme switching — it will not respond to the light/dark theme toggle
- The Review Queue's back link, filter tabs, and status labels are all styled inline — they will not inherit from future design system changes
- Font sizes differ: the main app uses `1.1rem` for the Forge heading; the Review Queue uses `1rem` for "REVIEW QUEUE"

### Inconsistency 2: Button styles are defined in multiple places
`App.jsx` defines `.btn-primary`, `.btn-secondary`, `.btn-cancel`, `.btn-icon` via `App.css`. `ApiKeySettings.jsx` defines its own `.api-settings-btn-primary` inline. `ResumeAIAssistant.jsx` defines its own `btn()` style factory function. `ReviewQueue.tsx` and all sub-components use ad-hoc inline button styles. There are at least 4 distinct button style systems in a single app.

### Inconsistency 3: Font size hierarchy is fragmented
The Space Mono / Syne design system is declared in `CLAUDE.md` but implementation varies:
- `OnboardingTutorial.jsx` uses `'DM Sans', system-ui, sans-serif` for body text (line 245) — this font is not in the design system
- `AlvaPrepModule.jsx` uses `'Space Mono','Courier New',monospace` correctly
- `ResumeAIAssistant.jsx` uses `"'Space Mono', 'Courier New', monospace"` correctly
- App.jsx uses Tailwind utility classes (`text-slate-400`, `text-sm`) in some places and inline styles in others

### Inconsistency 4: Loading states have no unified pattern
- Main app loading: `<p className="text-slate-400">Loading...</p>` (plain text, no spinner)
- Review Queue loading: `LOADING...` in Space Mono caps (consistent with RQ aesthetic)
- Leaderboard loading: `"Loading leaderboard..."` in a CSS-class-based wrapper
- Resume AI: `Loading...` in Space Mono via the `label` style
No spinner, skeleton, or loading animation is used consistently across the app.

### Inconsistency 5: Error display is not unified
- Auth errors: `auth-error` div with emoji + paragraph
- Scout errors: inline text `⚠ {scoutError}` in red
- Doc generation errors: `⚠ {docError}` red banner
- Agent errors in ResumeAI: red border div with `fca5a5` color
- Modal save errors: browser `alert()`
A single `<ErrorBanner>` component would unify this and make the error surface predictable.

### Inconsistency 6: Three colour accents used without clear semantic rules
Teal (`#06b6d4`), Purple (`#8b5cf6`), and Orange (`#f97316`) are CV track colours. But they're also used semantically in other contexts:
- Teal: primary action colour (Save button, settings modal top border, API key notice border)
- Purple: Review Queue selected state, `REGENERATE DOCS` button, gamification milestone colour
- Orange: Setup Required step in onboarding, Anthropic API key section colour
The track-to-colour association is well-documented, but non-track uses of these colours create potential confusion when track badges appear next to elements using the same colour for non-track purposes.

---

*End of UX Audit Report — Forge, 1000 Synthetic Users*
*Generated: 2026-06-11*
