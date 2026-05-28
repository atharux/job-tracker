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
npx tsx scripts/importResume.ts
```

## Three CV Tracks
| Track | Role | Accent | Focus |
|-------|------|--------|-------|
| `ux` | UX Engineer | `#06b6d4` | Design systems, Figma, prototyping, React |
| `pm` | Product Manager | `#8b5cf6` | Lean Six Sigma, analytics, team leadership |
| `devrel` | Developer Relations | `#f97316` | React, LLM APIs, AI tooling, community |

## Project Structure
```
src/
  agents/           ← 8 autonomous AI agents
    scout.ts        ← job discovery (Arbeitnow, Remotive, GermanTechJobs, EURemoteJobs, Greenhouse, SmartRecruiters, Lever, Recruitee)
    classifier.ts   ← Groq: scores job fit 0–10, assigns cv_track
    cvSelector.ts   ← reads cv_versions from Supabase
    resumeTailor.ts ← rewrites CV bullets per JD (callAI → free model)
    coverLetterWriter.ts ← generates cover letters (callAI → free model)
    formMapper.ts   ← maps application form fields
    screenshotCapturer.ts ← before/after screenshots
    statusTracker.ts ← tracks email responses via Gmail MCP
    openRouterClient.ts  ← unified AI client: OpenRouter > Groq > Anthropic (from localStorage)
  services/
    agentOrchestrator.ts ← pipeline: scout → classify → documents → review → submit
  pages/
    ReviewQueue.tsx  ← human approval UI
  components/
    ApiKeySettings.jsx ← Settings modal (stores keys in localStorage)
```

## API Keys (stored in browser localStorage via Settings modal)
The app reads keys from localStorage — no `.env` file needed for the agents:
- `openrouter_api_key` → OpenRouter (needed for Perplexity Sonar live search)
- `groq_api_key` → Groq free tier (works for all agents except live Scout search)
- `anthropic_api_key` → fallback for direct Anthropic calls

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

**To add a company:** append to the relevant `*_COMPANIES` array in `src/agents/scout.ts`

## Target Companies (pending scraping/ATS discovery)
Taktile · Almedia · Welo Data · Lovehoney Group · Yepoda · Truffls · Malt · Get-in-IT · Jobvector

## Database Tables (Supabase)
- `jobs` — discovered postings
- `agent_runs` — full audit log per agent call
- `application_artifacts` — generated docs per job (resume_tailored, cover_letter, form_mapping, screenshots)
- `application_review_queue` — human approval state machine
- `cv_versions` — base CV content per track (ux / pm / devrel)
- `resume_versions`, `resume_modules`, `version_modules` — resume builder

## Key Decisions
- Document agents use `callAI()` from `openRouterClient.ts` (not Anthropic SDK) so they work with any key from Settings
- Scout uses free job board APIs — no Perplexity credits needed
- Human approval is a hard gate before any application is submitted
- All agent runs are logged to `agent_runs` with input/output snapshots and token counts

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
