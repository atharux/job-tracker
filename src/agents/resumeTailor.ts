import { callAI } from './openRouterClient'
import type { CVContent, TailoredResume } from './types'

const SYSTEM_PROMPT =
  'You are a precise resume editor. Return only valid JSON. No markdown. No preamble.'

const TRACK_CONTEXT: Record<string, string> = {
  ux: `CV TRACK: UX Engineer
Prioritise: design systems, Figma, prototyping, React/TypeScript, component libraries, design tokens, interaction design, user research, accessibility.
Tone: builder who bridges design and engineering — precise, outcome-driven, ships.
Reorder skills so design systems, React, TypeScript, Figma lead.`,

  pm: `CV TRACK: Product Manager
Prioritise: product strategy, roadmap ownership, stakeholder alignment, data analysis, A/B testing, Lean Six Sigma, OKRs, cross-functional delivery, go-to-market.
Tone: data-informed decision-maker who quantifies impact and is clear on trade-offs.
Reorder skills so strategy, analytics, Lean Six Sigma, leadership lead.`,

  devrel: `CV TRACK: Developer Relations
Prioritise: API documentation, developer education, community building, technical demos, open source, conference talks, LLM/AI tooling, SDK experience, content creation.
Tone: technically credible communicator who explains complex systems simply and builds trust with developers.
Reorder skills so AI/LLM APIs, React, TypeScript, technical writing lead.`,
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function buildPrompt(baseResume: CVContent, rawJd: string, cvTrack: string): string {
  const trackCtx = TRACK_CONTEXT[cvTrack] ?? TRACK_CONTEXT.ux
  const cleanJd = stripHtml(rawJd).slice(0, 3500)

  return `Tailor this resume for the job below.

${trackCtx}

RULES (non-negotiable):
- Do NOT invent experience, metrics, or achievements absent from the base resume
- Do NOT change company names, role titles, or dates
- Rewrite bullet points using XYZ formula: "Accomplished [X] as measured by [Y] by doing [Z]"
  - Use exact figures from the base resume — never fabricate metrics
  - If no measurable Y exists, lead with outcome and method
- Rewrite the summary to reflect this track's tone and the job's language
- Reorder skills to surface the most relevant for this role and track first
- Emphasise experience and projects most relevant to the CV track and job description
- Copy contact, education, languages, and certifications EXACTLY
- Produce a diff array covering every changed bullet and the summary

BASE RESUME (JSON):
${JSON.stringify(baseResume, null, 2)}

JOB DESCRIPTION:
${cleanJd}

Return ONLY valid JSON in this exact shape:
{
  "contact": <copy contact exactly from base resume, or null>,
  "summary": "<rewritten summary targeting this specific role and track>",
  "experience": [
    {
      "company": "<same company name>",
      "role": "<same role title>",
      "dates": "<copy dates exactly>",
      "bullets": ["<XYZ-formula bullet>", ...]
    }
  ],
  "skills": ["<skill>", ...],
  "education": <copy exactly, or null>,
  "projects": <copy exactly, or null>,
  "languages": <copy exactly, or null>,
  "certifications": <copy exactly, or null>,
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

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/)
  return match ? match[0] : text
}

export async function tailorResume(
  baseResume: CVContent,
  rawJd: string,
  cvTrack: 'ux' | 'pm' | 'devrel' = 'ux'
): Promise<TailoredResume> {
  const text = await callAI({
    model: 'deepseek/deepseek-chat-v3-0324:free',
    groqModel: 'llama-3.3-70b-versatile',
    max_tokens: 5000,
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(baseResume, rawJd, cvTrack) },
    ],
  })

  const parsed = JSON.parse(extractJson(stripMarkdown(text))) as TailoredResume

  if (!parsed.languages?.length)       parsed.languages       = baseResume.languages ?? []
  if (!parsed.certifications?.length)  parsed.certifications  = baseResume.certifications ?? []
  if (!parsed.education?.length)       parsed.education       = baseResume.education ?? []
  if (!parsed.projects?.length)        parsed.projects        = baseResume.projects ?? []
  if (!parsed.contact)                 parsed.contact         = baseResume.contact
  if (!parsed.diff)                    parsed.diff            = []

  return parsed
}
