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
import { submitApplication } from '../agents/submitter'
import type { SubmissionResult } from '../agents/submitter'
import type { ScoutResult, ClassifierResult, TailoredResume, CoverLetter } from '../agents/types'

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

// Returns the existing job ID if it was seen within the last 7 days, null otherwise.
async function getRecentJobId(url: string, userId: string): Promise<string | null> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('jobs')
    .select('id, updated_at')
    .eq('user_id', userId)
    .eq('url', url)
    .gte('updated_at', cutoff)
    .maybeSingle()
  return data?.id ?? null
}

async function upsertJob(result: ScoutResult, userId: string): Promise<string | null> {
  // Skip if this URL was already processed within the last 7 days
  const existingId = await getRecentJobId(result.url, userId)
  if (existingId) return null

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

async function getJobRawJd(jobId: string): Promise<{ raw_jd: string; title: string; company: string; url: string; source: string }> {
  const { data, error } = await supabase
    .from('jobs')
    .select('raw_jd, title, company, url, source')
    .eq('id', jobId)
    .single()

  if (error || !data) throw new Error(`Job not found: ${jobId}`)
  return data as { raw_jd: string; title: string; company: string; url: string; source: string }
}

async function loadLatestArtifacts(jobId: string): Promise<{ resume: TailoredResume | null; letter: CoverLetter | null }> {
  const { data } = await supabase
    .from('application_artifacts')
    .select('artifact_type, content, created_at')
    .eq('job_id', jobId)
    .in('artifact_type', ['resume_tailored', 'cover_letter'])
    .order('created_at', { ascending: false })

  const resume = (data?.find(r => r.artifact_type === 'resume_tailored')?.content ?? null) as TailoredResume | null
  const letter = (data?.find(r => r.artifact_type === 'cover_letter')?.content ?? null) as CoverLetter | null
  return { resume, letter }
}

// ---------------------------------------------------------------------------
// Pipeline steps
// ---------------------------------------------------------------------------

async function runScoutStep(userId: string): Promise<Array<ScoutResult & { id: string }>> {
  const runId = await startRun('scout', null, {}, userId)
  const t0 = Date.now()

  try {
    const results = await runScout()

    // upsertJob returns null for jobs seen within the last 7 days — filter those out
    const withIds = (
      await Promise.all(
        results.map(async (r) => {
          const id = await upsertJob(r, userId)
          if (!id) return null
          return { ...r, id }
        })
      )
    ).filter((r): r is ScoutResult & { id: string } => r !== null)

    await completeRun(runId, { total: results.length, fresh: withIds.length }, undefined, Date.now() - t0)
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
    tailored = await tailorResume(cvVersion.content, job.raw_jd ?? '', classification.cv_track)
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
    const letter = await writeCoverLetter(job.title, job.company, job.raw_jd ?? '', classification.cv_track)
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

export async function approveAndSubmit(jobId: string, notes?: string): Promise<SubmissionResult> {
  const userId = await getCurrentUserId()
  await gatekeeper.approve(jobId, notes)

  const job = await getJobRawJd(jobId)
  const { resume, letter } = await loadLatestArtifacts(jobId)

  // Attempt actual API submission
  let submission: SubmissionResult
  if (resume && letter) {
    const submitRunId = await startRun('submitter', jobId, { source: job.source, method: job.source }, userId)
    try {
      submission = await submitApplication({ id: jobId, ...job }, resume, letter, userId)
      await completeRun(submitRunId, submission)
    } catch (err) {
      await failRun(submitRunId, err)
      submission = {
        success: false,
        method: 'manual',
        message: `Submission error: ${(err as Error).message}`,
        applicationUrl: job.url,
        requiresManual: true,
      }
    }
  } else {
    submission = {
      success: false,
      method: 'manual',
      message: 'No tailored resume or cover letter found — generate documents first',
      applicationUrl: job.url,
      requiresManual: true,
    }
  }

  // Store submission result as artifact
  await saveArtifact(jobId, 'submission_result', submission)

  // Only mark submitted in queue if API submission succeeded
  if (submission.success) {
    await gatekeeper.submit(jobId)
  }

  // Create entry in the applications tracker so the Kanban board reflects the submission
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
      status: submission.success ? 'applied' : 'in-progress',
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

  return submission
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
