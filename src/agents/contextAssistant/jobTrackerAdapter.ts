// Job-tracker DataSource: pulls applications + jobs from Supabase and exposes
// the candidate profile context. This is the ONLY project-specific piece of the
// context assistant — other projects supply their own DataSource.
//
// Logic here is a faithful extraction of what previously lived inline in
// cogneeClient.localJobSearch(); behavior is unchanged.

import type { DataSource, AssistantRecord } from './types'
import type { CVContent } from '../types'

export const jobTrackerDataSource: DataSource = {
  async getRecords() {
    const { supabase } = await import('../../supabaseClient')

    const [appsResult, jobsResult] = await Promise.all([
      supabase
        .from('applications')
        .select('id, company, position, status, date_applied, interview_date, job_posting_url')
        .order('date_applied', { ascending: false })
        .limit(80),
      supabase
        .from('jobs')
        .select('id, title, company, location, classifier_score, cv_track, url')
        .order('created_at', { ascending: false })
        .limit(40),
    ])

    const apps = appsResult.data ?? []
    const jobs = jobsResult.data ?? []

    if (apps.length === 0 && jobs.length === 0) {
      const appsErr = appsResult.error?.message ?? 'none'
      const jobsErr = jobsResult.error?.message ?? 'none'
      const emptyReason = `No data found in your pipeline.\n\napplications query error: ${appsErr}\njobs query error: ${jobsErr}\n\nIf both say "none", your tables are empty — add a job or run Scout first.`
      return { records: [], emptyReason }
    }

    const records: AssistantRecord[] = [
      ...apps.map((a): AssistantRecord => ({
        id: a.id,
        groupLabel: 'Applications',
        promptLine: `${a.position} @ ${a.company} | status:${a.status} | applied:${a.date_applied ?? 'unknown'}${a.interview_date ? ` | interview:${a.interview_date}` : ''}`,
        fallbackLine: `• ${a.position} @ ${a.company} — ${a.status}${a.date_applied ? ` (${a.date_applied})` : ''}`,
        link: {
          id: a.id,
          title: a.position,
          company: a.company,
          url: a.job_posting_url ?? null,
          meta: a.status,
          source: 'application',
        },
      })),
      ...jobs.map((j): AssistantRecord => {
        const score = j.classifier_score != null ? ` · score ${j.classifier_score}` : ''
        const track = j.cv_track ? ` · ${j.cv_track}` : ''
        const scorePrompt = j.classifier_score != null ? ` | score:${j.classifier_score}` : ''
        const trackPrompt = j.cv_track ? ` | track:${j.cv_track}` : ''
        return {
          id: j.id,
          groupLabel: 'Pipeline jobs',
          promptLine: `${j.title} @ ${j.company}${scorePrompt}${trackPrompt} | ${j.location ?? 'remote'}`,
          fallbackLine: `• ${j.title} @ ${j.company}${score}${track}`,
          link: {
            id: j.id,
            title: j.title,
            company: j.company,
            url: j.url ?? null,
            meta: j.classifier_score != null ? `score ${j.classifier_score}${j.cv_track ? ` · ${j.cv_track}` : ''}` : j.cv_track ?? '',
            source: 'pipeline',
          },
        }
      }),
    ]

    return { records }
  },

  async getProfileContext() {
    const { USER_PROFILE } = await import('../../config/userProfile')
    const base = `Candidate: ${USER_PROFILE.name}. Location: ${USER_PROFILE.location}. Preferences: ${USER_PROFILE.locationPreferences}.
Background: ${USER_PROFILE.background}
Tracks: UX Engineer (React/Figma/AI systems), Product Manager (Lean Six Sigma/analytics), Developer Relations (community/agentic demos).`

    // Ground in the user's real CVs when available. Falls back to `base` alone
    // on any error / no CVs, so behavior degrades gracefully.
    const cvContext = await loadCvContext()
    return cvContext ? `${base}\n\n${cvContext}` : base
  },
}

// Bound total CV context so multiple long CVs cannot blow the prompt budget.
const MAX_CV_CONTEXT_CHARS = 4000

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

// Render one CV's structured content into compact text — real facts only.
function renderCv(track: string, label: string | null, content: CVContent): string {
  if (!content) return ''
  const lines: string[] = [`## ${label || track} track`]
  if (content.summary) lines.push(truncate(content.summary, 400))
  if (content.skills?.length) lines.push(`Skills: ${content.skills.slice(0, 30).join(', ')}`)
  if (content.experience?.length) {
    lines.push('Experience:')
    content.experience.slice(0, 6).forEach(e => {
      lines.push(`- ${e.role} @ ${e.company}${e.dates ? ` (${e.dates})` : ''}`)
      ;(e.bullets ?? []).slice(0, 2).forEach(b => lines.push(`  • ${truncate(b, 160)}`))
    })
  }
  if (content.projects?.length) {
    lines.push('Projects:')
    content.projects.slice(0, 5).forEach(p => {
      if (p.name) lines.push(`- ${p.name}${p.description ? `: ${truncate(p.description, 140)}` : ''}`)
    })
  }
  return lines.join('\n')
}

// Fetch the current user's real CVs and render them. Returns '' on any
// failure, no signed-in user, or no CV rows — never fabricates.
async function loadCvContext(): Promise<string> {
  try {
    const { supabase } = await import('../../supabaseClient')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ''

    const { data, error } = await supabase
      .from('cv_versions')
      .select('track, label, content')
      .eq('user_id', user.id)

    if (error || !data || data.length === 0) return ''

    const blocks = data
      .map(row => renderCv(row.track as string, (row.label as string) ?? null, row.content as CVContent))
      .filter(Boolean)
    if (blocks.length === 0) return ''

    const body = `The candidate's actual CV content (use these real facts; do not invent):\n\n${blocks.join('\n\n')}`
    return truncate(body, MAX_CV_CONTEXT_CHARS)
  } catch {
    return ''
  }
}
