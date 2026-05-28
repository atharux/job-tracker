import { supabase } from '../supabaseClient'
import { runScout } from '../agents/scout'
import { classifyBatch } from '../agents/classifier'
import { selectCV } from '../agents/cvSelector'
import { tailorResume } from '../agents/resumeTailor'
import { writeCoverLetter } from '../agents/coverLetterWriter'
import { mapForm } from '../agents/formMapper'
import { captureScreenshots } from '../agents/screenshotCapturer'
import * as gatekeeper from '../agents/reviewGatekeeper'
import { syncStatus, watchJob } from '../agents/statusTracker'
import type { ScoutResult, ClassifierResult } from '../agents/types'

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated. Please sign in before running agents.')
  return user.id
}

// ---------------------------------------------------------------------------
// Agent run audit helpers
// ---------------------------------------------------------------------------

async function startRun(agentName: string, jobId: string | null, input: unknown, userId: string): Promise<string> {
  const { data } = await supabase
    .from('agent_runs')
    .insert({
      job_id: jobId,
      agent_name: agentName,
      status: 'running',
      input_snapshot: input,
      user_id: userId,
    })
    .select('id')
    .single()

  return data?.id ?? ''
}

async function completeRun(
  runId: string,
  output: unknown,
  tokensUsed?: number,
  durationMs?: number
): Promise<void> {
  await supabase
    .from('agent_runs')
    .update({
      status: 'success',
      output_snapshot: output,
      tokens_used: tokensUsed ?? null,
      duration_ms: durationMs ?? null,
    })
    .eq('id', runId)
}

async function failRun(runId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  await supabase
    .from('agent_runs')
    .update({ status: 'failed', error_message: message })
    .eq('id', runId)
}

async function saveArtifact(
  jobId: string,
  artifactType: string,
  content: unknown,
  diffFromBase?: unknown,
  storageUrl?: string
): Promise<void> {
  await supabase.from('application_artifacts').insert({
    job_id: jobId,
    artifact_type: artifactType,
    content,
    diff_from_base: diffFromBase ?? null,
    storage_url: storageUrl ?? null,
  })
}

// ---------------------------------------------------------------------------
// Job persistence helpers
// ---------------------------------------------------------------------------

async function upsertJob(result: ScoutResult, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('jobs')
    .upsert(
      {
        title: result.title,
        company: result.company,
        location: result.location,
        url: result.url,
        source: result.source,
        raw_jd: result.raw_jd,
        scraped_at: result.scraped_at,
        status: 'discovered',
        updated_at: new Date().toISOString(),
        user_id: userId,
      },
      { onConflict: 'user_id,url' }
    )
    .select('id')
    .single()

  if (error || !data) throw new Error(`Failed to upsert job: ${error?.message}`)
  return data.id as string
}

async function getJobRawJd(jobId: string): Promise<{ raw_jd: string; title: string; company: string; url: string }> {
  const { data, error } = await supabase
    .from('jobs')
    .select('raw_jd, title, company, url')
    .eq('id', jobId)
    .single()

  if (error || !data) throw new Error(`Job not found: ${jobId}`)
  return data as { raw_jd: string; title: string; company: string; url: string }
}

// ---------------------------------------------------------------------------
// Pipeline steps
// ---------------------------------------------------------------------------

async function runScoutStep(userId: string): Promise<Array<ScoutResult & { id: string }>> {
  const runId = await startRun('scout', null, {}, userId)
  const t0 = Date.now()

  try {
    const results = await runScout()

    const withIds = await Promise.all(
      results.map(async (r) => ({
        ...r,
        id: await upsertJob(r, userId),
      }))
    )

    await completeRun(runId, withIds, undefined, Date.now() - t0)
    return withIds
  } catch (err) {
    await failRun(runId, err)
    throw err
  }
}

async function runClassifyStep(
  jobs: Array<ScoutResult & { id: string }>,
  userId: string
): Promise<ClassifierResult[]> {
  const runId = await startRun('classifier', null, { count: jobs.length }, userId)
  const t0 = Date.now()

  try {
    const results = await classifyBatch(jobs)

    for (const job of jobs) {
      const classification = results.find((r) => r.job_id === job.id)
      if (classification) {
        await supabase
          .from('jobs')
          .update({ status: 'classified', updated_at: new Date().toISOString() })
          .eq('id', job.id)
      }
    }

    await completeRun(runId, results, undefined, Date.now() - t0)
    return results
  } catch (err) {
    await failRun(runId, err)
    throw err
  }
}

async function runDocumentStep(
  jobId: string,
  classification: ClassifierResult,
  userId: string
): Promise<void> {
  const job = await getJobRawJd(jobId)

  // CV Base
  const cvRunId = await startRun('cvSelector', jobId, { track: classification.cv_track }, userId)
  const t0cv = Date.now()
  let cvVersion
  try {
    cvVersion = await selectCV(classification.cv_track, userId)
    await saveArtifact(jobId, 'cv_base', cvVersion.content)
    await completeRun(cvRunId, cvVersion, undefined, Date.now() - t0cv)
  } catch (err) {
    await failRun(cvRunId, err)
    throw err
  }

  // Resume Tailor
  const tailorRunId = await startRun('resumeTailor', jobId, { track: classification.cv_track }, userId)
  const t0tailor = Date.now()
  let tailored
  try {
    tailored = await tailorResume(cvVersion.content, job.raw_jd)
    await saveArtifact(jobId, 'resume_tailored', tailored, tailored.diff)
    await completeRun(tailorRunId, tailored, undefined, Date.now() - t0tailor)
  } catch (err) {
    await failRun(tailorRunId, err)
    throw err
  }

  // Cover Letter
  const clRunId = await startRun('coverLetterWriter', jobId, { title: job.title }, userId)
  const t0cl = Date.now()
  try {
    const letter = await writeCoverLetter(job.title, job.company, job.raw_jd)
    await saveArtifact(jobId, 'cover_letter', letter)
    await completeRun(clRunId, letter, undefined, Date.now() - t0cl)
  } catch (err) {
    await failRun(clRunId, err)
    throw err
  }
}

async function runFormStep(jobId: string, userId: string): Promise<void> {
  const job = await getJobRawJd(jobId)
  if (!job.url) return

  const fmRunId = await startRun('formMapper', jobId, { url: job.url }, userId)
  const t0 = Date.now()
  let formMapping
  try {
    formMapping = await mapForm(job.url)
    await saveArtifact(jobId, 'form_mapping', formMapping)
    await completeRun(fmRunId, formMapping, undefined, Date.now() - t0)
  } catch (err) {
    await failRun(fmRunId, err)
    return
  }

  const ssRunId = await startRun('screenshotCapturer', jobId, { url: job.url }, userId)
  const t0ss = Date.now()
  try {
    const screenshots = await captureScreenshots(jobId, job.url, formMapping)
    await saveArtifact(jobId, 'screenshot_before', null, null, screenshots.before_url)
    await saveArtifact(jobId, 'screenshot_filled', null, null, screenshots.filled_url)
    await completeRun(ssRunId, screenshots, undefined, Date.now() - t0ss)
  } catch (err) {
    await failRun(ssRunId, err)
  }
}

// ---------------------------------------------------------------------------
// Exported orchestration functions
// ---------------------------------------------------------------------------

export async function runScoutOnly(): Promise<ScoutResult[]> {
  const userId = await getCurrentUserId()
  const jobs = await runScoutStep(userId)
  const classifications = await runClassifyStep(jobs, userId)

  for (const classification of classifications) {
    await gatekeeper.enqueue(
      classification.job_id,
      classification.score,
      classification.cv_track
    )
    await supabase
      .from('jobs')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', classification.job_id)
  }

  return jobs
}

export async function runFullPipeline(): Promise<void> {
  const userId = await getCurrentUserId()
  const jobs = await runScoutStep(userId)
  const classifications = await runClassifyStep(jobs, userId)

  for (const classification of classifications) {
    const jobId = classification.job_id

    await runDocumentStep(jobId, classification, userId)
    await runFormStep(jobId, userId)

    await gatekeeper.enqueue(jobId, classification.score, classification.cv_track)
    await supabase
      .from('jobs')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', jobId)
  }
}

export async function runDocumentsForJob(jobId: string): Promise<void> {
  const userId = await getCurrentUserId()

  const { data: queueRecord } = await supabase
    .from('application_review_queue')
    .select('cv_track, classifier_score')
    .eq('job_id', jobId)
    .single()

  if (!queueRecord?.cv_track) {
    throw new Error(`No queue record or cv_track found for job ${jobId}`)
  }

  const classification: ClassifierResult = {
    job_id: jobId,
    score: queueRecord.classifier_score ?? 0,
    cv_track: queueRecord.cv_track as 'ux' | 'pm' | 'devrel',
    score_rationale: '',
    key_matches: [],
    red_flags: [],
  }

  await runDocumentStep(jobId, classification, userId)
}

export async function approveAndSubmit(jobId: string, notes?: string): Promise<void> {
  const userId = await getCurrentUserId()
  await gatekeeper.approve(jobId, notes)
  await gatekeeper.submit(jobId)

  // Create entry in the applications tracker so the Kanban board reflects the submission
  const job = await getJobRawJd(jobId)
  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('user_id', userId)
    .eq('job_posting_url', job.url)
    .maybeSingle()

  if (!existing) {
    await supabase.from('applications').insert({
      user_id: userId,
      company: job.company,
      position: job.title,
      date_applied: today,
      job_posting_url: job.url ?? null,
      status: 'applied',
      notes: notes ?? null,
      attachments: [],
    })
  }

  const watchRunId = await startRun('statusTracker', jobId, { action: 'watch' }, userId)
  try {
    const status = await watchJob(jobId)
    await completeRun(watchRunId, { status })
  } catch (err) {
    await failRun(watchRunId, err)
  }
}

export async function runStatusSync(): Promise<void> {
  const userId = await getCurrentUserId()
  const runId = await startRun('statusTracker', null, { action: 'sync' }, userId)
  const t0 = Date.now()
  try {
    const updates = await syncStatus()
    await completeRun(runId, updates, undefined, Date.now() - t0)
  } catch (err) {
    await failRun(runId, err)
    throw err
  }
}
