# Job Tracker — Claude Code Context

## Owner
Athar Hafiz — UX Engineer / AI Product Consultant / Developer Relations
- Based in Berlin, Germany
- Portfolio: https://atharux.com
- Email: athar.hafiz@gmail.com
- LinkedIn: https://www.linkedin.com/in/atharhafiz
- German: B2 (conversational), English: native

## Resume & CV Files
**Primary source of truth for all CV content:**
```
/Users/a1/2026 Resume/2026CVversions/resume_ats_english.md   ← main EN CV (ATS)
/Users/a1/2026 Resume/2026CVversions/resume_ats_german.md    ← DE CV
/Users/a1/2026 Resume/2026Portfolio/EN_Athar_Resume v2026_ATS.md  ← portfolio version
/Users/a1/2026 Resume/using now/AtharHafizCV.pdf              ← current active CV
```

When modifying CV content or agent prompts that reference Athar's background, read
these files first rather than using training-data assumptions.

**To sync CV changes to Supabase:**
```bash
IMPORT_EMAIL=… IMPORT_PASSWORD=… npx tsx scripts/importResume.ts
```
> `importResume.ts` holds the CV content inline (all 3 tracks) and upserts `cv_versions`.
> As of 2026-07-13 it includes NeuroFlow (recruiter-gated, no public URL) and honest Apple
> framing ("contributed to guideline discussions", not "authored policies"). The contextual
> assistant grounds answers in `cv_versions`, so run this to keep grounding accurate.

## Three CV Tracks
| Track | Role | Accent | Focus |
|-------|------|--------|-------|
| `ux` | UX Engineer | `#06b6d4` | Design systems, Figma, prototyping, React |
| `pm` | Product Manager | `#8b5cf6` | Lean Six Sigma, analytics, team leadership |
| `devrel` | Developer Relations | `#f97316` | React, LLM APIs, AI tooling, community |

## Project Structure
```
src/
  agents/           ← application pipeline (9-step) + supporting AI modules
    scout.ts        ← job discovery + verification gate + company-finder
                       (Arbeitnow, Remotive, RSS, Greenhouse, Ashby, SmartRecruiters, Lever, Recruitee)
                       matchesRole() unions ROLE_KEYWORDS with SearchProfile keywords
                       findCompanyBoard()/findAndAddCompany() probe ATS boards live
    classifier.ts   ← scores job fit 0–10, cv_track, asymmetric rubric (verdict/hard_cap)
                       buildPrompt() injects SearchProfile prefs (only when a custom profile is saved)
    cvSelector.ts · resumeTailor.ts · coverLetterWriter.ts · formMapper.ts
    screenshotCapturer.ts · statusTracker.ts · submitter.ts
    openRouterClient.ts  ← unified AI client: OpenRouter > Groq > Anthropic (from localStorage)
    refineSearchProfile.ts ← free-text intent → structured SearchProfile (callAI)
    companyRegistry.ts    ← localStorage registry of user-added ATS companies
    cogneeClient.ts       ← OPTIONAL Cognee graph memory (unconfigured; re-exports localJobSearch)
    contextAssistant/     ← reusable DB-assistant seam (portable to other projects)
      types.ts            ← DataSource + AssistantEngine interfaces
      jobTrackerAdapter.ts ← Supabase applications+jobs + CV-grounded profile context
      lightweightEngine.ts ← DEFAULT engine: LLM-over-records (Cognee is optional, not this)
      whyThisFits.ts · index.ts (runContextAssistant, localJobSearch)
  config/
    searchProfile.ts ← user-owned SearchProfile model (localStorage)
    userProfile.ts · releases.ts (changelog data)
  services/
    agentOrchestrator.ts ← pipeline: scout → verify → classify → documents → review → submit
  pages/
    ReviewQueue.tsx  ← human approval UI (UNVERIFIED badge)
    review-queue/JobDetailPanel.tsx ← manual doc-gen + WhyThisFits summary
  components/
    PipelineVisualization.tsx ← INTEL page: multi-turn contextual assistant
    ApiKeySettings.jsx ← Settings modal, left-sidebar tabbed nav
    SearchProfilePanel.jsx · CompanyFinder.jsx · WhyThisFits.tsx · ReleaseNotesPanel.jsx
```

## API Keys (stored in browser localStorage via Settings modal)
The app reads keys/config from localStorage — no `.env` file needed for the agents:
- `openrouter_api_key` → OpenRouter (needed for Perplexity Sonar live search)
- `groq_api_key` → Groq free tier (works for all agents except live Scout search)
- `anthropic_api_key` → fallback for direct Anthropic calls
- `cognee_api_key` / `cognee_base_url` → optional Cognee graph memory (Cloud or self-host)
- `langfuse_public_key` / `langfuse_secret_key` / `langfuse_host` → optional observability
- `search_profile` → user's SearchProfile (tune-my-search)
- `custom_ats_companies` → user-added ATS company boards (company-finder)
- `changelog_last_seen_version` → What's New "new since last seen" marker

## Job Sources
| Source | Type | API |
|--------|------|-----|
| Arbeitnow | REST API | free, no key |
| Remotive | REST API | free, no key |
| GermanTechJobs | RSS | free |
| EURemoteJobs | RSS | free |
| Talon.one | Greenhouse API | free, no key |
| Awin Global | Greenhouse API | free, no key |
| Delivery Hero | SmartRecruiters API | free, no key |
| Air Apps | Recruitee API | free, no key |

**To add a company:** either append to the relevant `*_COMPANIES` array in `src/agents/scout.ts` (built-in), OR use the live **company-finder** in Settings → Search — enter a name/domain, it probes ATS boards and adds the verified slug to the `custom_ats_companies` registry (never a guessed slug). Scout scans built-in ∪ registry.

## Target Companies (pending scraping/ATS discovery)
Taktile · Almedia · Welo Data · Lovehoney Group · Yepoda · Truffls · Malt · Get-in-IT · Jobvector

## Database Tables (Supabase)
- `jobs` — discovered postings (+ `verified`, `verdict`, `hard_cap_reason` scoring/verification columns — needs the `add_verification_and_scoring_columns` migration)
- `agent_runs` — full audit log per agent call
- `application_artifacts` — generated docs per job (resume_tailored, cover_letter, form_mapping, screenshots)
- `application_review_queue` — human approval state machine
- `cv_versions` — base CV content per track (ux / pm / devrel)
- `resume_versions`, `resume_modules`, `version_modules` — resume builder

## Key Decisions
- Document agents use `callAI()` from `openRouterClient.ts` (not Anthropic SDK) so they work with any key from Settings
- Scout uses free job board APIs — no Perplexity credits needed
- Human approval is a hard gate before any application is submitted
- **Search tuning is user-owned** (`SearchProfile` in localStorage), not hardcoded. Consumed only when a custom profile is saved, so default scoring/rubric is unchanged. Build new search behavior through it.
- **Contextual assistant lives behind a reusable seam** (`agents/contextAssistant/`: `DataSource` + `AssistantEngine`) so it can port to other projects. The **lightweight LLM-over-Supabase engine is the default**; Cognee is an OPTIONAL graph upgrade — do NOT reintroduce it as a hard dependency.
- **Scout verification gate**: listings are verified against a live ATS source before reaching the classifier/review queue; unverified never auto-apply.
- **No fabrication**: the company-finder only stores a slug after a live board returns jobs; assistant/fit summaries are grounded only in real DB/CV data.
- Doc generation is **manual** (button in JobDetailPanel), not auto-on-open.
- All agent runs are logged to `agent_runs` with input/output snapshots and token counts

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
