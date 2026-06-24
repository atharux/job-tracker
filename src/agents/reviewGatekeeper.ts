import { supabase } from '../supabaseClient'
import type { ReviewQueueRecord } from './types'

const TERMINAL_STATUSES = ['rejected', 'submitted', 'archived']

export async function enqueue(
  jobId: string,
  classifierScore?: number,
  cvTrack?: 'ux' | 'pm' | 'devrel'
): Promise<ReviewQueueRecord | null> {
  // Don't resurrect jobs the user has already acted on
  const { data: existing } = await supabase
    .from('application_review_queue')
    .select('status')
    .eq('job_id', jobId)
    .maybeSingle()

  if (existing && TERMINAL_STATUSES.includes(existing.status)) return null

  const { data, error } = await supabase
    .from('application_review_queue')
    .upsert(
      {
        job_id: jobId,
        status: 'pending_review',
        classifier_score: classifierScore ?? null,
        cv_track: cvTrack ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'job_id' }
    )
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to enqueue job ${jobId}: ${error?.message}`)
  }

  return data as ReviewQueueRecord
}

export async function approve(jobId: string, notes?: string): Promise<ReviewQueueRecord> {
  const { data, error } = await supabase
    .from('application_review_queue')
    .update({
      status: 'approved',
      review_notes: notes ?? null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', jobId)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to approve job ${jobId}: ${error?.message}`)
  }

  return data as ReviewQueueRecord
}

export async function reject(jobId: string, notes?: string): Promise<ReviewQueueRecord> {
  const { data, error } = await supabase
    .from('application_review_queue')
    .update({
      status: 'rejected',
      review_notes: notes ?? null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', jobId)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to reject job ${jobId}: ${error?.message}`)
  }

  return data as ReviewQueueRecord
}

export async function submit(jobId: string): Promise<ReviewQueueRecord> {
  // Guard: only callable when status === 'approved'
  const { data: current, error: fetchError } = await supabase
    .from('application_review_queue')
    .select('status')
    .eq('job_id', jobId)
    .single()

  if (fetchError || !current) {
    throw new Error(`Queue record not found for job ${jobId}`)
  }

  if (current.status !== 'approved') {
    throw new Error(
      `Cannot submit job ${jobId}: status is '${current.status}', must be 'approved'`
    )
  }

  const { data, error } = await supabase
    .from('application_review_queue')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', jobId)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to submit job ${jobId}: ${error?.message}`)
  }

  // Also update the jobs table status
  await supabase
    .from('jobs')
    .update({ status: 'submitted', updated_at: new Date().toISOString() })
    .eq('id', jobId)

  return data as ReviewQueueRecord
}

export async function archive(jobId: string): Promise<ReviewQueueRecord> {
  const { data, error } = await supabase
    .from('application_review_queue')
    .update({
      status: 'archived',
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', jobId)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to archive job ${jobId}: ${error?.message}`)
  }

  return data as ReviewQueueRecord
}

export async function getQueue(): Promise<ReviewQueueRecord[]> {
  const { data, error } = await supabase
    .from('application_review_queue')
    .select(`
      *,
      job:jobs(*)
    `)
    .eq('status', 'pending_review')
    .order('classifier_score', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch queue: ${error.message}`)
  }

  return (data ?? []) as ReviewQueueRecord[]
}

export async function getAll(): Promise<ReviewQueueRecord[]> {
  const { data, error } = await supabase
    .from('application_review_queue')
    .select(`
      *,
      job:jobs(*)
    `)
    .order('classifier_score', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch all queue records: ${error.message}`)
  }

  return (data ?? []) as ReviewQueueRecord[]
}
