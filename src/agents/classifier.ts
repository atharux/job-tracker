import type { ScoutResult, ClassifierResult } from './types'
import { callAI } from './openRouterClient'

const SCORE_THRESHOLD = 6.0

const OWNER_PROFILE = `
Athar Hafiz — UX Engineer / Product Designer / Developer Relations
- 10+ years experience in UX/product design, front-end development, developer relations
- Two stints at Apple (iOS App Review team, teaching)
- Technical stack: React, Vite, TypeScript, Tailwind CSS, Supabase, Anthropic API, Groq, n8n
- German: B2 level; based in Berlin
- Three CV tracks:
    ux     → UX Engineer (teal accent #06b6d4)
    pm     → Product Manager (purple accent #8b5cf6)
    devrel → Developer Relations (orange accent #f97316)
- Lean Six Sigma certified, Gamification practitioner, AI product consultant
- Organizer: Global AI Berlin meetup
- Open to: Berlin (on-site/hybrid), Remote Europe, Dubai
`

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
      model: 'meta-llama/llama-4-maverick:free',
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

  return parsed
}

export async function classifyBatch(
  jobs: Array<ScoutResult & { id: string }>
): Promise<ClassifierResult[]> {
  const results: ClassifierResult[] = []

  for (const job of jobs) {
    const result = await classifyJob(job, job.id)
    if (result && result.score >= SCORE_THRESHOLD) {
      results.push(result)
    }
  }

  return results
}

export { SCORE_THRESHOLD }
