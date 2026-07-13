// Lightweight engine: LLM over the in-context records, grounded in the profile
// context. This is the default engine. It is a faithful extraction of the logic
// previously inline in cogneeClient.localJobSearch() — including the plain-text
// fallback used when the LLM is unavailable, so no behavior changes.

import type { AssistantEngine, AssistantRecord, AssistantLink } from './types'

// Plain-text summary — always works regardless of LLM rate limits. Groups
// records by their label, preserving first-seen order, capped at 10 per group.
function buildFallbackAnswer(records: AssistantRecord[], query: string): string {
  const parts: string[] = [`Results for: "${query}"\n`]
  const order: string[] = []
  const byGroup = new Map<string, AssistantRecord[]>()
  for (const r of records) {
    if (!byGroup.has(r.groupLabel)) {
      byGroup.set(r.groupLabel, [])
      order.push(r.groupLabel)
    }
    byGroup.get(r.groupLabel)!.push(r)
  }
  order.forEach((label, idx) => {
    parts.push(idx === 0 ? `**${label}**` : `\n**${label}**`)
    byGroup.get(label)!.slice(0, 10).forEach(r => parts.push(r.fallbackLine))
  })
  return parts.join('\n')
}

export const lightweightEngine: AssistantEngine = {
  async answer({ query, records, profileContext }) {
    const { callAI } = await import('../openRouterClient')

    const allLinks: AssistantLink[] = records.map(r => r.link)
    const fallbackAnswer = buildFallbackAnswer(records, query)

    // Try LLM for a smarter answer — fall back to the plain list if unavailable.
    try {
      const lines = records.map(
        (r, i) => `R-${i + 1} [${r.groupLabel}] [id:${r.id}] ${r.promptLine}`,
      )

      const timeout = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('llm timeout')), 8_000),
      )
      const raw = await Promise.race([
        callAI({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          groqModel: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are a job search assistant helping a specific candidate evaluate their records.

CANDIDATE PROFILE:
${profileContext}

Answer queries by cross-referencing the candidate's background against the records. Be specific and actionable.
Format your response as:
<answer>
Your prose answer here (bullet points ok).
</answer>
<ids>
["id-uuid-1", "id-uuid-2"]
</ids>
The ids array must contain only the exact UUID values from [id:...] for records most relevant to the query. Max 8 ids. Empty array if none are specifically relevant.`,
            },
            {
              role: 'user',
              content: `Records:\n${lines.join('\n')}\n\nQuery: ${query}`,
            },
          ],
          max_tokens: 700,
        }),
        timeout,
      ])

      const answerMatch = raw.match(/<answer>([\s\S]*?)<\/answer>/)
      const idsMatch = raw.match(/<ids>([\s\S]*?)<\/ids>/)
      const answer = answerMatch ? answerMatch[1].trim() : raw.trim()

      let matchedIds: string[] = []
      if (idsMatch) {
        try { matchedIds = JSON.parse(idsMatch[1].trim()) } catch { /* ignore */ }
      }

      const idSet = new Set(matchedIds)
      const links = allLinks.filter(l => idSet.has(l.id))
      return { answer, links: links.length ? links : allLinks.slice(0, 8) }
    } catch {
      // LLM unavailable — return plain list
      return { answer: fallbackAnswer, links: allLinks.slice(0, 8) }
    }
  },
}
