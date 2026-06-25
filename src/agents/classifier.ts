import type { ScoutResult, ClassifierResult } from './types'
import { callAI } from './openRouterClient'
import { USER_PROFILE } from '../config/userProfile'

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

function buildPrompt(job: ScoutResult, jobId: string): string {
  return `You are a job-fit classifier. Score this job for the candidate described below.

CANDIDATE PROFILE:
${OWNER_PROFILE}

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
  "red_flags": ["<flag 1>", ...]
}

Scoring guide:
9–10: Near-perfect fit across skills, seniority, location
7–8:  Strong fit, minor gaps
5–6:  Partial fit, significant gaps
3–4:  Weak fit
1–2:  Wrong domain or location`
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
      model: 'deepseek/deepseek-chat-v3-0324:free',
      groqModel: 'llama-3.3-70b-versatile',
      max_tokens: 800,
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

  let parsed: ClassifierResult
  try {
    parsed = JSON.parse(stripMarkdown(responseText)) as ClassifierResult
  } catch {
    return null
  }

  if (typeof parsed.score !== 'number') return null
  if (!parsed.industry) parsed.industry = 'Other'

  return parsed
}

export async function classifyBatch(
  jobs: Array<ScoutResult & { id: string }>
): Promise<ClassifierResult[]> {
  const results: ClassifierResult[] = []

  for (const job of jobs) {
    const result = await classifyJob(job, job.id)
    if (result) {
      results.push({ ...result, passedThreshold: result.score >= SCORE_THRESHOLD })
    }
  }

  return results
}

export { SCORE_THRESHOLD }
