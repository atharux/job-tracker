import type { ScoutResult, ClassifierResult } from './types'
import { callAI, getPreferredFreeModel } from './openRouterClient'
import { USER_PROFILE } from '../config/userProfile'
import { loadSearchProfile, hasSearchProfile } from '../config/searchProfile'

const SCORE_THRESHOLD = 3.0

const { name, background, languages, locationPreferences, community, tracks } = USER_PROFILE

const langLine = languages.length
  ? `- Languages: ${languages.map(l => `${l.language} (${l.level})`).join(', ')}`
  : ''

const communityLine = community ? `- ${community}` : ''

const trackLines = Object.entries(tracks)
  .map(([key, t]) => `    ${key.padEnd(6)} → ${t.label} (${t.color})`)
  .join('\n')

const OWNER_PROFILE = `
${name} — ${Object.values(tracks).map(t => t.label).join(' / ')}
- ${background}
${langLine}
- Location preference: ${locationPreferences}
- CV tracks:
${trackLines}
${communityLine}
`.trim()

// User-tuned search preferences injected into the classifier prompt. Returns ''
// when the user has not saved a custom profile, so default scoring is unchanged.
export function searchPreferences(): string {
  if (!hasSearchProfile()) return ''
  const p = loadSearchProfile()
  const lines: string[] = []
  if (p.preferredTitles.length) lines.push(`- Preferred titles: ${p.preferredTitles.join(', ')}`)
  if (p.keywords.length) lines.push(`- Interest keywords: ${p.keywords.join(', ')}`)
  if (p.antiSignals.length) lines.push(`- Anti-signals (LOWER the score for roles matching these): ${p.antiSignals.join(', ')}`)
  if (p.targetCompanyProfile) lines.push(`- Target company profile: ${p.targetCompanyProfile}`)
  if (p.locations.length) lines.push(`- Preferred locations: ${p.locations.join(', ')}`)
  if (p.seniorityBand) lines.push(`- Target seniority: ${p.seniorityBand}`)
  if (p.intentText.trim()) lines.push(`- In the candidate's words: ${p.intentText.trim().slice(0, 300)}`)
  if (lines.length === 0) return ''
  return `\n\nUSER SEARCH PREFERENCES (tuned by the candidate — weight these alongside the profile above):
${lines.join('\n')}
Reward strong matches to the preferred titles and company profile; LOWER the score for roles that match the anti-signals.`
}

function buildPrompt(job: ScoutResult, jobId: string): string {
  return `You are a job-fit classifier. Score this job for the candidate described below.

Default posture: skeptical, not neutral. Do not flatter the fit. Optimize for
not wasting application effort, not for maximizing apparent fit — a role that
reads well but has a real disqualifier should not be scored to look attractive.

CANDIDATE PROFILE:
${OWNER_PROFILE}${searchPreferences()}

JOB TO SCORE:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Job Description:
${job.raw_jd}

Return ONLY valid JSON with this exact shape — no markdown, no preamble:
{
  "job_id": "${jobId}",
  "score": <number 1.0–10.0, one decimal place>,
  "cv_track": <"ux" | "pm" | "devrel">,
  "industry": <one of: "Fintech" | "E-commerce" | "Health/MedTech" | "EdTech" | "B2B SaaS" | "Developer Tools" | "Consumer Apps" | "AI/ML" | "Gaming" | "Media/Entertainment" | "Travel/Mobility" | "Food/Delivery" | "Climate/CleanTech" | "HR Tech" | "Ad Tech" | "Other">,
  "score_rationale": "<2–3 sentence explanation>",
  "key_matches": ["<match 1>", "<match 2>", ...],
  "red_flags": ["<flag 1>", ...],
  "hard_cap_stack_years": <true only if the role requires 5+ years of production experience in a specific stack/technology the candidate's background does not show, else false>,
  "seniority_assessment": <"junior" | "mid" | "senior" | "staff_principal" | "unclear">,
  "comp_text": <verbatim comp/salary range stated in the posting, or null if none stated>,
  "bonus_ai_native": <true only if the team is explicitly AI-native/AI-forward in tooling or product>,
  "bonus_devrel_build_blend": <true only if the role blends DevRel/community work with hands-on technical building>,
  "bonus_fde_customer_facing": <true only if there's a direct customer-facing technical component, forward-deployed-engineer-adjacent>,
  "ds_core_degree_required": <true only if a graduate degree in a quantitative discipline is a stated requirement, not softened by "or equivalent" elsewhere in the posting>,
  "ds_core_ml_tooling_required": <true only if hands-on fine-tuning, Text2SQL, or classical ML tooling (pandas/scikit-learn/PyTorch) is core day-to-day work, not incidental>,
  "ds_core_ml_deployment_primary": <true only if production ML deployment ownership on AWS/Azure/GCP is a primary responsibility, not just "familiarity with">,
  "ds_core_data_infra_required": <true only if Databricks/Spark/distributed data processing is required, not preferred>,
  "ds_core_title_match": <true only if the title contains "Data Scientist", "ML Engineer", or "Applied Scientist" with no DevRel/Solutions/FDE/customer-facing modifier>,
  "devrel_fde_title_match": <true if title or description includes Developer Advocate, Developer Relations, Forward Deployed Engineer, Solutions Engineer, Technical Evangelist, or a customer-facing + technical hybrid framing>,
  "devrel_fde_values_public_facing": <true if the role explicitly values public speaking, community building, technical content, or customer enablement alongside building>,
  "devrel_fde_flexible_degree": <true only if "or equivalent practical experience" appears as a genuine alternative to a degree requirement — check that other requirements in the posting are similarly flexible, not just boilerplate>
}

Scoring guide (score reflects general fit only — hard caps and bonuses are applied separately downstream, do not fold them into this number):
9–10: Near-perfect fit across skills, seniority, location
7–8:  Strong fit, minor gaps
5–6:  Partial fit, significant gaps
3–4:  Weak fit
1–2:  Wrong domain or location`
}

// ── Asymmetric scoring rubric ────────────────────────────────────────────────
// Hard caps override bonuses — a role can never bonus its way out of a cap.
// Seniority mismatch is a full disqualifier (verdict: skipped). Stack-years
// only lowers the ceiling (verdict: worth_a_look, never apply_first) per the
// rule's own wording. Comp mismatch is wired but inert until a target comp
// range exists in userProfile.ts — comp_text is captured for that future use.
//
// DS-Core vs DevRel/FDE disambiguation: roles that mention GenAI/LLM keywords
// can still be core data-science roles, not the DevRel/FDE/technical-build-
// and-explain track Athar actually fits. 2+ ds_core_* signals cap the verdict
// at skipped ("ds-core-mismatch") — this overrides GenAI/LLM keyword bonuses
// on their own. But if a genuine DevRel/FDE bonus signal also fires on the
// same posting, that's a mixed signal, not an auto-resolve: surface it as
// "mixed-ds-core-devrel-review-manually" for a human instead of silently
// skipping a role that might be a real fit.

interface RubricSignals {
  hard_cap_stack_years?: boolean
  seniority_assessment?: 'junior' | 'mid' | 'senior' | 'staff_principal' | 'unclear'
  comp_text?: string | null
  bonus_ai_native?: boolean
  bonus_devrel_build_blend?: boolean
  bonus_fde_customer_facing?: boolean
  ds_core_degree_required?: boolean
  ds_core_ml_tooling_required?: boolean
  ds_core_ml_deployment_primary?: boolean
  ds_core_data_infra_required?: boolean
  ds_core_title_match?: boolean
  devrel_fde_title_match?: boolean
  devrel_fde_values_public_facing?: boolean
  devrel_fde_flexible_degree?: boolean
}

function applyRubric(
  parsed: { score: number } & RubricSignals
): Pick<ClassifierResult, 'verdict' | 'hard_cap_reason' | 'bonus_count'> {
  const dsCoreSignalCount = [
    parsed.ds_core_degree_required,
    parsed.ds_core_ml_tooling_required,
    parsed.ds_core_ml_deployment_primary,
    parsed.ds_core_data_infra_required,
    parsed.ds_core_title_match,
  ].filter(b => b === true).length
  const isDsCoreMismatch = dsCoreSignalCount >= 2

  const bonus_count = [
    parsed.bonus_ai_native,
    parsed.bonus_devrel_build_blend,
    parsed.bonus_fde_customer_facing,
    parsed.devrel_fde_title_match,
    parsed.devrel_fde_values_public_facing,
    parsed.devrel_fde_flexible_degree,
  ].filter(b => b === true).length

  if (isDsCoreMismatch && bonus_count > 0) {
    return { verdict: 'worth_a_look', hard_cap_reason: 'mixed-ds-core-devrel-review-manually', bonus_count }
  }
  if (isDsCoreMismatch) {
    return { verdict: 'skipped', hard_cap_reason: 'ds-core-mismatch', bonus_count }
  }

  const seniority = parsed.seniority_assessment
  if (seniority === 'staff_principal' || seniority === 'junior') {
    return {
      verdict: 'skipped',
      hard_cap_reason: seniority === 'staff_principal' ? 'seniority-reach' : 'seniority-underleveled',
      bonus_count,
    }
  }

  if (parsed.hard_cap_stack_years === true) {
    return { verdict: 'worth_a_look', hard_cap_reason: 'stack-years', bonus_count }
  }

  if (bonus_count >= 2 && parsed.score >= SCORE_THRESHOLD) {
    return { verdict: 'apply_first', hard_cap_reason: null, bonus_count }
  }

  return { verdict: 'worth_a_look', hard_cap_reason: null, bonus_count }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

export async function classifyJob(
  job: ScoutResult,
  jobId: string
): Promise<ClassifierResult | null> {
  let responseText: string
  try {
    responseText = await callAI({
      model: getPreferredFreeModel(),
      groqModel: 'llama-3.3-70b-versatile',
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content: 'You are a precise job-fit classifier. Return only valid JSON. No markdown. No preamble.',
        },
        {
          role: 'user',
          content: buildPrompt(job, jobId),
        },
      ],
    })
  } catch {
    return null
  }

  let parsed: ClassifierResult & RubricSignals
  try {
    parsed = JSON.parse(stripMarkdown(responseText)) as ClassifierResult & RubricSignals
  } catch {
    return null
  }

  if (typeof parsed.score !== 'number') return null
  if (!parsed.industry) parsed.industry = 'Other'

  const rubric = applyRubric(parsed)
  parsed.verdict = rubric.verdict
  parsed.hard_cap_reason = rubric.hard_cap_reason
  parsed.bonus_count = rubric.bonus_count

  return parsed
}

export async function classifyBatch(
  jobs: Array<ScoutResult & { id: string }>
): Promise<ClassifierResult[]> {
  const results: ClassifierResult[] = []

  for (const job of jobs) {
    const result = await classifyJob(job, job.id)
    if (result) {
      // Override job_id with the real Supabase UUID — LLMs sometimes hallucinate a slug
      // A skipped verdict (hard cap) blocks the review queue regardless of numeric score.
      results.push({
        ...result,
        job_id: job.id,
        passedThreshold: result.verdict !== 'skipped' && result.score >= SCORE_THRESHOLD,
      })
    }
  }

  return results
}

export { SCORE_THRESHOLD }
