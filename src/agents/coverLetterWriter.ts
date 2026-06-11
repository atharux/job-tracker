import { callAI } from './openRouterClient'
import type { CoverLetter } from './types'

const MAX_WORDS = 350

const TRACK_VOICE: Record<string, string> = {
  ux: `Track: UX Engineer
Voice: Athar designs AND ships — Figma to React. He cares about systems that scale and interfaces that don't need instructions. Reference real technical work (React, TypeScript, Supabase, Figma, design systems, Anthropic API). He is based in Berlin, active in the AI community.
Opening hook: Open with a specific observation about the company's product or design challenge — not a generic statement about Athar.`,

  pm: `Track: Product Manager
Voice: Data-informed, not data-paralysed. Athar moves products from ambiguous signal to shipped feature. Lean Six Sigma background, strong on prioritisation and stakeholder alignment. Reference specific methodologies and quantified outcomes.
Opening hook: Open with the specific problem space this role addresses — show the JD has been read carefully.`,

  devrel: `Track: Developer Relations
Voice: Technically credible communicator who builds the demos that get developers unstuck. Athar explains agent architecture clearly, writes sharp API docs, grows communities with substance. Active in Global AI Berlin. Reference LLMs, MCP, developer tooling, agentic systems.
Opening hook: Open with a concrete observation about the developer experience gap this company is solving.`,
}

const BASE_RULES = `Writing rules (non-negotiable):
- Direct and specific — no filler phrases
- Address 2–3 specific requirements from the JD by name — list them in key_requirements
- NEVER use: "I am passionate about", "leverage", "synergy", "dynamic", "I am excited to", "I look forward to hearing from you"
- Closing: specific call to action naming the role or company
- Maximum ${MAX_WORDS} words in the body — do not exceed this
- No placeholder text — write the complete letter`

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

function buildPrompt(jobTitle: string, company: string, rawJd: string, cvTrack: string): string {
  const trackVoice = TRACK_VOICE[cvTrack] ?? TRACK_VOICE.ux
  const cleanJd = stripHtml(rawJd).slice(0, 2500)

  return `Write a cover letter for Athar Hafiz applying to this role.

${trackVoice}

${BASE_RULES}

Role: ${jobTitle}
Company: ${company}

Job Description:
${cleanJd}

Return ONLY valid JSON in this exact shape:
{
  "subject_line": "<concise email subject: 'Application: [role] — Athar Hafiz'>",
  "key_requirements": ["<specific requirement 1 from JD>", "<specific requirement 2>", "<specific requirement 3>"],
  "body": "<full cover letter, max ${MAX_WORDS} words, each key_requirement addressed explicitly>",
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

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/)
  return match ? match[0] : text
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export async function writeCoverLetter(
  jobTitle: string,
  company: string,
  rawJd: string,
  cvTrack: 'ux' | 'pm' | 'devrel' = 'ux'
): Promise<CoverLetter> {
  const text = await callAI({
    model: 'meta-llama/llama-4-maverick:free',
    groqModel: 'llama-3.3-70b-versatile',
    max_tokens: 1500,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content: 'You write cover letters for job applications. Return only valid JSON. No markdown. No preamble.',
      },
      { role: 'user', content: buildPrompt(jobTitle, company, rawJd, cvTrack) },
    ],
  })

  const letter = JSON.parse(extractJson(stripMarkdown(text))) as CoverLetter
  letter.word_count = countWords(letter.body)
  return letter
}
