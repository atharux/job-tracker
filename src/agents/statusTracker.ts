import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '../supabaseClient'
import type { EmailResponseType, Job } from './types'

const GMAIL_MCP_URL = 'https://gmailmcp.googleapis.com/mcp/v1'

async function fetchSubmittedJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'submitted')

  if (error) throw new Error(`Failed to fetch submitted jobs: ${error.message}`)
  return (data ?? []) as Job[]
}

async function classifyEmailResponse(
  emailContent: string,
  jobTitle: string,
  company: string
): Promise<EmailResponseType> {
  const anthropicKey = localStorage.getItem('anthropic_api_key')
  if (!anthropicKey) throw new Error('Anthropic API key not configured — add it in Settings to use the Status Tracker.')
  const client = new Anthropic({
    apiKey: anthropicKey,
    dangerouslyAllowBrowser: true,
  })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    system: 'You classify job application email responses. Return exactly one word.',
    messages: [
      {
        role: 'user',
        content: `Classify this email response for a job application to "${jobTitle}" at "${company}".

EMAIL:
${emailContent}

Return ONLY one of: no_reply | rejection | screening | interview`,
      },
    ],
  })

  const text = (
    response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .toLowerCase()
  ) as EmailResponseType

  const valid: EmailResponseType[] = ['no_reply', 'rejection', 'screening', 'interview']
  return valid.includes(text) ? text : 'no_reply'
}

async function searchGmailForJob(
  job: Job
): Promise<{ found: boolean; emailContent: string }> {
  const anthropicKey = localStorage.getItem('anthropic_api_key')
  if (!anthropicKey) throw new Error('Anthropic API key not configured — add it in Settings to use the Status Tracker.')
  const client = new Anthropic({
    apiKey: anthropicKey,
    dangerouslyAllowBrowser: true,
  })

  try {
    // Use Gmail MCP remote server via Anthropic's beta MCP support
    const response = await (client.beta as unknown as {
      messages: {
        create: (params: unknown) => Promise<{ content: Array<{ type: string; text?: string }> }>
      }
    }).messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      mcp_servers: [
        {
          type: 'url',
          url: GMAIL_MCP_URL,
          name: 'gmail-mcp',
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Search my Gmail inbox for any emails related to a job application at ${job.company} for the role "${job.title}". Look for emails from ${job.company.toLowerCase().replace(/\s+/g, '')} domains. Return the full text of any relevant email you find, or say "NO_EMAIL_FOUND" if none exists.`,
        },
      ],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')

    if (text.includes('NO_EMAIL_FOUND') || text.trim() === '') {
      return { found: false, emailContent: '' }
    }

    return { found: true, emailContent: text }
  } catch {
    return { found: false, emailContent: '' }
  }
}

async function updateJobStatus(jobId: string, newStatus: EmailResponseType): Promise<void> {
  await supabase
    .from('jobs')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

export async function syncStatus(): Promise<
  Array<{ job_id: string; status: EmailResponseType }>
> {
  const jobs = await fetchSubmittedJobs()
  const updates: Array<{ job_id: string; status: EmailResponseType }> = []

  for (const job of jobs) {
    const { found, emailContent } = await searchGmailForJob(job)

    const status: EmailResponseType = found
      ? await classifyEmailResponse(emailContent, job.title, job.company)
      : 'no_reply'

    if (status !== 'no_reply') {
      await updateJobStatus(job.id, status)
      updates.push({ job_id: job.id, status })
    }
  }

  return updates
}

export async function watchJob(jobId: string): Promise<EmailResponseType> {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (error || !job) throw new Error(`Job not found: ${jobId}`)

  const { found, emailContent } = await searchGmailForJob(job as Job)

  if (!found) return 'no_reply'

  const status = await classifyEmailResponse(emailContent, job.title, job.company)
  await updateJobStatus(jobId, status)
  return status
}
