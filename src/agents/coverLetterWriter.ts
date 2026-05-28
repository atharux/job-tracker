import { callAI } from './openRouterClient'
import type { CoverLetter } from './types'

const MAX_WORDS = 300

const SYSTEM_PROMPT = `You are writing a cover letter for Athar Hafiz, a UX Engineer / AI Product Consultant based in Berlin.

Voice rules (non-negotiable):
- Direct and specific — no filler phrases
- References concrete technical work (React apps, Supabase, Anthropic API, n8n, TypeScript)
- Mentions Berlin and Global AI Berlin community when contextually relevant
- NEVER uses these phrases: "I am passionate about", "leverage", "synergy", "dynamic"
- Ends with a specific call to action, not a generic closing
- Maximum ${MAX_WORDS} words in the body

Return ONLY valid JSON. No markdown. No preamble.`

function buildPrompt(jobTitle: string, company: string, rawJd: string): string {
  return `Write a cover letter for this job.

Role: ${jobTitle}
Company: ${company}

Job Description:
${rawJd}

Return this exact JSON shape:
{
  "subject_line": "<email subject line>",
  "body": "<full cover letter text, max ${MAX_WORDS} words>",
  "word_count": <number>
}`
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export async function writeCoverLetter(
  jobTitle: string,
  company: string,
  rawJd: string
): Promise<CoverLetter> {
  const text = await callAI({
    model: 'meta-llama/llama-4-maverick:free',
    groqModel: 'llama-3.3-70b-versatile',
    max_tokens: 2000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(jobTitle, company, rawJd) },
    ],
  })

  const letter = JSON.parse(stripMarkdown(text)) as CoverLetter
  letter.word_count = countWords(letter.body)
  return letter
}
