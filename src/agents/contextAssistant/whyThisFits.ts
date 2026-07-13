// "Why this fits you" — an on-demand fit summary for a single record, grounded
// in the user's CV/profile context (reuses the job-tracker DataSource from #22)
// and the record's job description. Honest and non-fabricating by construction.

import { jobTrackerDataSource } from './jobTrackerAdapter'

export async function whyThisFits(input: {
  title: string
  company: string
  jd: string
}): Promise<string> {
  const { callAI } = await import('../openRouterClient')
  const profileContext = await jobTrackerDataSource.getProfileContext()
  const jd = (input.jd || '').slice(0, 2500)

  const user = [
    `Candidate profile:\n${profileContext}`,
    `Role: ${input.title}${input.company ? ` at ${input.company}` : ''}`,
    `Job description:\n${jd || '(no job description available)'}`,
    'In 2–4 short sentences, explain why this candidate fits this role. Use ONLY',
    'facts present in the profile and job description above — do not invent skills,',
    'experience, tools, or claims. If the fit is weak or the evidence is thin, say',
    'so plainly rather than overselling.',
  ].join('\n\n')

  return callAI({
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    groqModel: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content:
          'You assess candidate-to-role fit. Be specific, honest, and grounded only in the provided evidence. Never fabricate skills or experience.',
      },
      { role: 'user', content: user },
    ],
    max_tokens: 300,
  })
}
