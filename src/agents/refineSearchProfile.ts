// Model-assisted search-profile refinement: compile a job seeker's free-text
// intent into the structured SearchProfile fields, for the user to review and
// edit before saving. Uses the same free-model client as the other agents.

import { callAIJson, getPreferredFreeModel } from './openRouterClient'
import type { SearchProfile } from '../config/searchProfile'

function stripMarkdown(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export async function refineSearchProfile(
  intentText: string,
): Promise<Partial<SearchProfile>> {
  const parsed = await callAIJson<Record<string, unknown>>(
    {
      model: getPreferredFreeModel(),
      groqModel: 'llama-3.3-70b-versatile',
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content:
            "You convert a job seeker's free-text search intent into a structured JSON profile. Output ONLY valid JSON — no markdown, no preamble. Do not invent preferences the text does not imply; leave a field empty if the text gives no signal for it.",
        },
        {
          role: 'user',
          content: `Search intent:\n"""${intentText}"""\n\nReturn ONLY this JSON shape:\n{\n  "preferredTitles": string[],\n  "keywords": string[],\n  "antiSignals": string[],\n  "targetCompanyProfile": string,\n  "locations": string[],\n  "seniorityBand": string\n}\n- preferredTitles: job titles the person wants.\n- keywords: short role/skill phrases to widen job discovery.\n- antiSignals: things that should DOWN-weight a role (e.g. "people management", "Head of").\n- targetCompanyProfile: one short phrase describing the kind of company.\n- locations: acceptable locations / work arrangements.\n- seniorityBand: e.g. "mid", "mid–senior", "senior".`,
        },
      ],
    },
    (text) => JSON.parse(stripMarkdown(text)) as Record<string, unknown>,
  )
  return {
    preferredTitles: asStringArray(parsed.preferredTitles),
    keywords: asStringArray(parsed.keywords),
    antiSignals: asStringArray(parsed.antiSignals),
    targetCompanyProfile: asString(parsed.targetCompanyProfile),
    locations: asStringArray(parsed.locations),
    seniorityBand: asString(parsed.seniorityBand),
  }
}
