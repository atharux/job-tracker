import { callAI } from './openRouterClient'
import type { CVContent, TailoredResume } from './types'

const SYSTEM_PROMPT =
  'You are a precise resume editor. Return only valid JSON. No markdown. No preamble.'

function buildPrompt(baseResume: CVContent, rawJd: string): string {
  return `Tailor this resume to match the job description below.

RULES (non-negotiable):
- Do NOT invent experience, metrics, or achievements that do not exist in the base resume
- Do NOT change company names, role titles, or dates
- Rewrite bullet points using the XYZ formula: "Accomplished [X] as measured by [Y] by doing [Z]"
  - X = what you achieved (the outcome)
  - Y = how you measured it (numbers, %, $, time — use exact figures from the base resume)
  - Z = what you actually did (the method)
  - If a bullet has no measurable Y, lead with the outcome and method; never fabricate metrics
- Rewrite the summary to match the job's language and priorities
- Emphasise skills and experience most relevant to the job description
- Copy contact, education, projects, languages, and certifications EXACTLY — do not change them
- Produce a diff array showing every changed bullet and the summary

BASE RESUME (JSON):
${JSON.stringify(baseResume, null, 2)}

JOB DESCRIPTION:
${rawJd}

Return ONLY valid JSON in this exact shape:
{
  "contact": <copy contact object exactly from base resume, or null if absent>,
  "summary": "<rewritten summary targeting this specific role>",
  "experience": [
    {
      "company": "<same company name>",
      "role": "<same role title>",
      "dates": "<copy dates exactly from base resume>",
      "bullets": ["<XYZ-formula bullet>", ...]
    }
  ],
  "skills": ["<skill>", ...],
  "education": <copy education array exactly, or null if absent>,
  "projects": <copy projects array exactly, or null if absent>,
  "languages": <copy languages array exactly, or null if absent>,
  "certifications": <copy certifications array exactly, or null if absent>,
  "diff": [
    {
      "field": "<e.g. summary | experience[0].bullets[1]>",
      "original": "<original text>",
      "tailored": "<new text>"
    }
  ]
}`
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

export async function tailorResume(
  baseResume: CVContent,
  rawJd: string
): Promise<TailoredResume> {
  const text = await callAI({
    model: 'meta-llama/llama-4-maverick:free',
    groqModel: 'llama-3.3-70b-versatile',
    max_tokens: 4000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(baseResume, rawJd) },
    ],
  })

  const parsed = JSON.parse(stripMarkdown(text)) as TailoredResume

  // Free LLMs sometimes return null for static sections despite the prompt.
  // Fall back to base resume values so they are never silently dropped.
  if (!parsed.languages || parsed.languages.length === 0) {
    parsed.languages = baseResume.languages ?? []
  }
  if (!parsed.certifications || parsed.certifications.length === 0) {
    parsed.certifications = baseResume.certifications ?? []
  }
  if (!parsed.education || parsed.education.length === 0) {
    parsed.education = baseResume.education ?? []
  }
  if (!parsed.projects || parsed.projects.length === 0) {
    parsed.projects = baseResume.projects ?? []
  }
  if (!parsed.contact) {
    parsed.contact = baseResume.contact
  }

  return parsed
}
