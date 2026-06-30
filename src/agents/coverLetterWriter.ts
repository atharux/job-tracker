import { callAI, getPreferredFreeModel } from './openRouterClient'
import type { CoverLetter } from './types'
import { USER_PROFILE } from '../config/userProfile'

const MAX_WORDS = 350

const TRACK_VOICE: Record<string, string> = Object.fromEntries(
  Object.entries(USER_PROFILE.tracks).map(([key, t]) => [
    key,
    `Track: ${t.label}\nVoice: ${t.voice}\nOpening hook: Open with a specific observation about the company relevant to this role — not a generic statement about the applicant.`,
  ])
)

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

  return `Write a cover letter for ${USER_PROFILE.name} applying to this role.

${trackVoice}

${BASE_RULES}

Role: ${jobTitle}
Company: ${company}

Job Description:
${cleanJd}

Return ONLY valid JSON in this exact shape:
{
  "subject_line": "<concise email subject: 'Application: [role] — ${USER_PROFILE.name}'>",
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
    model: getPreferredFreeModel(),
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

  let letter: CoverLetter
  try {
    letter = JSON.parse(extractJson(stripMarkdown(text))) as CoverLetter
  } catch {
    throw new Error('Cover letter writer: LLM returned incomplete JSON — the model likely hit its output limit. Try again, or add a Groq API key in Settings for more reliable output.')
  }
  letter.word_count = countWords(letter.body)
  return letter
}
