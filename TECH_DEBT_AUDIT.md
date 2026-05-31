# Job Tracker — Technical Debt Audit
**Date:** 2026-05-31  
**Scope:** `src/` — agents, services, components, AI layer, config

---

## Scoring Formula
**Priority = (Impact + Risk) × (6 − Effort)**  
Higher = fix sooner. Impact/Risk/Effort on 1–5 scale (Effort inverted: 1=trivial, 5=major).

---

## CRITICAL (Priority ≥ 20)

### 1. Supabase anon key hardcoded in source — `supabaseClient.js`
| | |
|---|---|
| **Type** | Infrastructure / Security |
| **Impact** | 4 — key is in git history, exposed to anyone with repo access |
| **Risk** | 5 — anon key + Supabase URL is enough to enumerate tables if RLS has gaps |
| **Effort** | 1 — delete fallback strings; set VITE_ vars in Vercel/Netlify env panel |
| **Priority** | **45** |

```js
// CURRENT (bad)
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGci...';

// FIX
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_ANON_KEY) throw new Error('Missing VITE_SUPABASE_ANON_KEY');
```
**Action:** Remove hardcoded fallback. Rotate the key in Supabase dashboard. Verify RLS is enabled on all tables.

---

### 2. `classifyBatch` is fully sequential — `classifier.ts:102`
| | |
|---|---|
| **Type** | Code / Performance |
| **Impact** | 5 — for 50 jobs, each LLM call is ~2–4 s; total wall time = 100–200 s |
| **Risk** | 3 — no crash risk, but pipeline timeout is a real UX problem |
| **Effort** | 2 — replace `for` loop with `Promise.allSettled` + concurrency limiter |
| **Priority** | **32** |

```ts
// CURRENT
for (const job of jobs) {
  const result = await classifyJob(job, job.id)  // sequential ❌
}

// FIX — concurrency-limited parallel
import pLimit from 'p-limit'
const limit = pLimit(5)
const results = await Promise.allSettled(jobs.map(job => limit(() => classifyJob(job, job.id))))
```
**Action:** Add `p-limit` (1 kB). Run up to 5 classifiers in parallel. Groq rate limit is ~30 req/min on free tier — keep concurrency ≤ 5.

---

### 3. `App.jsx` and `App1.jsx` — 3,720-line dead twin
| | |
|---|---|
| **Type** | Code debt |
| **Impact** | 5 — two 2000+ line monolithic files with duplicated logic; new features go in the wrong one |
| **Risk** | 4 — it's unclear which is canonical; merge conflicts are inevitable |
| **Effort** | 3 — requires careful diff + extraction into feature components |
| **Priority** | **27** |

`App1.jsx` (1,643 lines) is a changelog-commented prior version of `App.jsx` (2,077 lines). The file comment at the top of `App1.jsx` describes features already present in `App.jsx`.

**Action:** Delete `App1.jsx`. Confirm all features from its changelog are present in `App.jsx`. Then split `App.jsx` into route-level page components (Kanban, Resume Builder, Agent Pipeline, etc.) targeting ≤ 300 lines per file.

---

## HIGH (Priority 15–19)

### 4. `stripMarkdown` duplicated in 3 agent files
| | |
|---|---|
| **Type** | Code debt |
| **Impact** | 3 — any fix to the regex must be applied in 3 places |
| **Risk** | 2 — divergence has already begun (subtle differences in trim behavior) |
| **Effort** | 1 — extract to `src/agents/utils.ts` and re-import |
| **Priority** | **25** |

Appears identically (or near-identically) in `classifier.ts:52`, `resumeTailor.ts:56`, `coverLetterWriter.ts:35`.

**Action:** Create `src/agents/utils.ts` with `stripMarkdown` + a safe `parseJSON<T>()` wrapper. Import everywhere.

---

### 5. Model names hardcoded across 4 agent files
| | |
|---|---|
| **Type** | Code debt / Maintainability |
| **Impact** | 3 — swapping from `llama-4-maverick:free` requires touching every agent |
| **Risk** | 3 — free model names change; hardcoded strings silently break |
| **Effort** | 1 — create a `src/agents/models.ts` constants file |
| **Priority** | **25** |

`'meta-llama/llama-4-maverick:free'` and `'llama-3.3-70b-versatile'` appear in `classifier.ts`, `resumeTailor.ts`, `coverLetterWriter.ts`, `statusTracker.ts`.

**Action:**
```ts
// src/agents/models.ts
export const MODELS = {
  default:   'meta-llama/llama-4-maverick:free',
  groq:      'llama-3.3-70b-versatile',
  premium:   'claude-sonnet-4-5',
} as const
```

---

### 6. Dead `src/ai/` layer — parallel AI client that nothing uses
| | |
|---|---|
| **Type** | Code debt |
| **Impact** | 3 — confusing for anyone reading the repo; unclear which client to extend |
| **Risk** | 2 — won't cause bugs but wastes 178 lines and sets wrong precedent |
| **Effort** | 1 — delete the folder after confirming no imports |
| **Priority** | **25** |

`src/ai/aiClient.js`, `modelRouter.js`, `outputFormatter.js`, `promptEngine.js`, `systemPrompts.js`, `toolStrategies.js` — 178 lines total. The production agent system uses `src/agents/openRouterClient.ts` exclusively.

**Action:** `grep -r "from.*src/ai"` to confirm no imports, then delete the folder.

---

### 7. No error boundary or retry logic in agent calls — silent `null` returns
| | |
|---|---|
| **Type** | Code debt / Reliability |
| **Impact** | 4 — classifier returning `null` silently drops a job from the pipeline |
| **Risk** | 4 — users see "0 results" with no indication of what failed |
| **Effort** | 3 — add retry wrapper + surface errors to the review queue UI |
| **Priority** | **21** |

`classifyJob` catches all errors and returns `null`. `tailorResume` and `writeCoverLetter` throw but the orchestrator doesn't surface granular failure state to the UI — the job just disappears.

**Action:** Add a `withRetry(fn, maxAttempts=2)` utility. Propagate failure status per-agent into `application_review_queue` so the UI can show "Classification failed — retry".

---

## MEDIUM (Priority 8–14)

### 8. API keys stored in `localStorage` with no expiry or scope control
| | |
|---|---|
| **Type** | Security / Architecture |
| **Impact** | 3 |
| **Risk** | 4 — XSS on any dependency reads all keys from localStorage |
| **Effort** | 4 — proper solution needs a backend session layer |
| **Priority** | **14** |

The README describes this as an intentional design for BYOK. Acceptable for a personal tool but not safe for a multi-user release.

**Action (short-term):** Add a `sessionStorage`-first path (already partially done in `openRouterClient.ts`) and document the risk. **(Long-term):** Move to Supabase Edge Function as a proxy; keys never touch the browser.

---

### 9. `@supabase/supabase-js` and `react-beautiful-dnd` divergence risks
| | |
|---|---|
| **Type** | Dependency debt |
| **Impact** | 3 |
| **Risk** | 3 — `react-beautiful-dnd` v13 is unmaintained; no React 19 support planned |
| **Effort** | 2 — migrate to `@dnd-kit/core` (maintained, smaller) |
| **Priority** | **18** |

Also: `@anthropic-ai/sdk` and `groq-sdk` are in production `dependencies` but agents call the APIs directly via `fetch` — the SDKs are unused dead weight.

**Action:** Remove `@anthropic-ai/sdk` and `groq-sdk` from `dependencies` (saves ~500 kB bundle). Replace `react-beautiful-dnd` with `@dnd-kit/sortable`.

---

### 10. Test coverage: 8 test files for 45 source files (~18%)
| | |
|---|---|
| **Type** | Test debt |
| **Impact** | 3 |
| **Risk** | 3 — zero UI component tests; zero integration tests for the pipeline |
| **Effort** | 4 |
| **Priority** | **12** |

Existing tests mock everything via `vi.mock` — they test orchestration logic but not actual LLM parsing, JSON shape validation, or UI rendering.

**Action:** Add Vitest tests for `stripMarkdown`, `parseJSON`, and the three agent prompt-builders (pure functions, easy to test). Add one `@testing-library/react` smoke test per page component.

---

### 11. `OWNER_PROFILE` hardcoded string in `classifier.ts`
| | |
|---|---|
| **Type** | Code debt / Maintainability |
| **Impact** | 2 |
| **Risk** | 2 — CV changes in Supabase won't reflect in classifier scoring |
| **Effort** | 2 — fetch the active CV tracks from Supabase at classification time |
| **Priority** | **12** |

The candidate profile used for scoring is a static string in the source file, duplicating data that lives in `cv_versions` table.

**Action:** At pipeline start, load the three CV summaries from Supabase and interpolate into the classifier prompt dynamically.

---

## LOW (Priority < 8)

### 12. `ApiKeySettings.jsx` — ~200 lines of inline CSS in a `<style>` tag
| | |
|---|---|
| **Type** | Code debt |
| **Impact** | 2 | **Risk** | 1 | **Effort** | 2 | **Priority** | **9** |

The entire component's styles are a tagged template literal inside the JSX. No Tailwind, no CSS module — just an island of CSS-in-JSX.

**Action:** Extract to `ApiKeySettings.module.css` or convert to Tailwind utility classes during the next component pass.

---

### 13. `src/ResumeUploader.jsx` duplicated at root and `src/components/`
| | |
|---|---|
| **Type** | Code debt |
| **Impact** | 2 | **Risk** | 2 | **Effort** | 1 | **Priority** | **15** |

`/src/ResumeUploader.jsx` and `/src/components/ResumeUploader.jsx` both exist. One is likely stale.

**Action:** Diff and delete the root-level file.

---

### 14. No CI pipeline, no lint-on-commit, no type-check gate
| | |
|---|---|
| **Type** | Infrastructure debt |
| **Impact** | 3 | **Risk** | 3 | **Effort** | 2 | **Priority** | **18** |

`package.json` has `lint` and `test` scripts but no GitHub Actions workflow. TypeScript `build` (`tsc`) is not run in CI.

**Action:** Add `.github/workflows/ci.yml` — `npm run lint && npx tsc --noEmit && npm test`. Free on GitHub for public repos.

---

## Prioritized Remediation Roadmap

### Phase 1 — This week (low effort, high impact)
| # | Item | Est. time |
|---|------|-----------|
| 1 | Remove hardcoded Supabase key + rotate | 30 min |
| 2 | Delete `App1.jsx` | 15 min |
| 3 | Extract `stripMarkdown` → `utils.ts` | 30 min |
| 4 | Create `models.ts` constants | 20 min |
| 5 | Audit + delete `src/ai/` folder | 15 min |
| 6 | Remove unused `@anthropic-ai/sdk` + `groq-sdk` deps | 10 min |
| 7 | Delete duplicate `src/ResumeUploader.jsx` | 10 min |

**Total: ~2 hours. Zero functional risk.**

---

### Phase 2 — Next sprint (moderate effort)
| # | Item | Est. time |
|---|------|-----------|
| 8 | Parallelize `classifyBatch` with `p-limit` | 2 hours |
| 9 | Add CI GitHub Actions workflow | 1 hour |
| 10 | Replace `react-beautiful-dnd` → `@dnd-kit` | 3 hours |
| 11 | Add retry + error surface for agent failures | 3 hours |

**Total: ~1 day. Unlocks production-readiness.**

---

### Phase 3 — Pre-launch hardening
| # | Item | Est. time |
|---|------|-----------|
| 12 | Split `App.jsx` into page components | 1 day |
| 13 | Dynamic `OWNER_PROFILE` from Supabase | 2 hours |
| 14 | Add component smoke tests + pure-function unit tests | 1 day |
| 15 | API key proxy via Supabase Edge Function | 2 days |

---

## Summary Table

| # | Item | Type | Priority Score |
|---|------|------|---------------|
| 1 | Hardcoded Supabase key | Security | **45** |
| 2 | Sequential classifier | Performance | **32** |
| 3 | App.jsx / App1.jsx twin | Code | **27** |
| 4 | `stripMarkdown` duplication | Code | **25** |
| 5 | Hardcoded model names | Code | **25** |
| 6 | Dead `src/ai/` layer | Code | **25** |
| 7 | No error recovery in agents | Reliability | **21** |
| 14 | No CI pipeline | Infrastructure | **18** |
| 9 | Unmaintained deps | Dependencies | **18** |
| 8 | API keys in localStorage | Security | **14** |
| 10 | Low test coverage | Testing | **12** |
| 11 | Hardcoded OWNER_PROFILE | Code | **12** |
| 13 | Duplicate ResumeUploader | Code | **15** |
| 12 | Inline CSS in ApiKeySettings | Code | **9** |
