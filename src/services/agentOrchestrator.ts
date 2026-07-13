import { supabase } from '../supabaseClient'
import { runScout, fetchAtsTitlesForCompany, CURATED_ATS_COMPANIES, normalizeCompanyName } from '../agents/scout'
import type { AtsSource } from '../agents/scout'
import { classifyBatch, SCORE_THRESHOLD } from '../agents/classifier'
import { callAI } from '../agents/openRouterClient'
import { hasCogneeConfig, cogneeRemember, buildJobMemory } from '../agents/cogneeClient'
import { selectCV } from '../agents/cvSelector'
import { tailorResume } from '../agents/resumeTailor'
import { writeCoverLetter } from '../agents/coverLetterWriter'
import { mapForm } from '../agents/formMapper'
import { captureScreenshots } from '../agents/screenshotCapturer'
import * as gatekeeper from '../agents/reviewGatekeeper'
import { syncStatus, watchJob, isStatusTrackerReady } from '../agents/statusTracker'
import { submitApplication } from '../agents/submitter'
import type { SubmissionResult } from '../agents/submitter'
import type { ScoutResult, ClassifierResult, TailoredResume, CoverLetter, ScreenshotResult } from '../agents/types'
import { createLangfuse, setActiveTrace, setActiveSpan } from '../ai/langfuseClient'
import type { LangfuseTraceClient } from '../ai/langfuseClient'

// ---------------------------------------------------------------------------
// Step observability callback
// ---------------------------------------------------------------------------

export type AgentStatus = 'running' | 'success' | 'failed' | 'skipped'
export type StepCallback = (agent: string, status: AgentStatus) => void

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

// Returns the existing job ID to skip, null if the job should be processed.
// Skips any job that already has a queue record — it has been seen and is
// either pending user action, acted on, or terminal. Only truly new URLs
// (no queue entry yet) enter the pipeline.
async function getSeenJobId(url: string, userId: string): Promise<string | null> {
  const { data: job } = await supabase
    .from('jobs')
    .select('id')
    .eq('user_id', userId)
    .eq('url', url)
    .maybeSingle()

  if (!job) return null

  const { data: queueRecord } = await supabase
    .from('application_review_queue')
    .select('status')
    .eq('job_id', job.id)
    .maybeSingle()

  // Skip if the job already has any queue entry
  return queueRecord ? job.id : null
}

async function upsertJob(result: ScoutResult, userId: string): Promise<string | null> {
  const existingId = await getSeenJobId(result.url, userId)
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
        // Unverified listings (no confirmed live source-of-truth match) stop here —
        // they never reach the classifier or review queue. See Scout verification gate.
        status: result.verified ? 'discovered' : 'unverified',
        verified: result.verified,
        verification_source: result.verificationSource,
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
// Liveness re-check (Scout rule: roles that 404 or fill are auto-archived,
// never re-surfaced — getSeenJobId already blocks re-surfacing once a job
// row exists, so archiving here is sufficient).
// ---------------------------------------------------------------------------

function parseAtsSourceFromVerification(verificationSource: string | null): AtsSource | null {
  if (!verificationSource) return null
  const direct = verificationSource.match(/^(\w+)-direct$/)
  const crossVerified = verificationSource.match(/^cross-verified:(\w+)$/)
  const source = direct?.[1] ?? crossVerified?.[1]
  return (['ashby', 'greenhouse', 'smartrecruiters', 'lever', 'recruitee'] as const).includes(source as AtsSource)
    ? (source as AtsSource)
    : null
}

interface PendingAtsQueueRow {
  id: string
  job_id: string
  jobs: { id: string; title: string; company: string; url: string; verification_source: string | null } | null
}

async function recheckPendingAtsJobs(userId: string): Promise<void> {
  const { data } = await supabase
    .from('application_review_queue')
    .select('id, job_id, jobs!inner(id, title, company, url, verification_source, user_id)')
    .eq('status', 'pending_review')
    .eq('jobs.user_id', userId)

  const rows = (data ?? []) as unknown as PendingAtsQueueRow[]
  const atsRows = rows.filter(r => r.jobs && parseAtsSourceFromVerification(r.jobs.verification_source))
  if (atsRows.length === 0) return

  // Group by curated company so each ATS endpoint is only re-fetched once.
  const groups = new Map<string, { source: AtsSource; slug: string; apiBase?: string; rows: PendingAtsQueueRow[] }>()
  for (const row of atsRows) {
    const source = parseAtsSourceFromVerification(row.jobs!.verification_source)!
    const curated = CURATED_ATS_COMPANIES.find(
      c => c.source === source && normalizeCompanyName(c.name) === normalizeCompanyName(row.jobs!.company)
    )
    if (!curated) continue
    const key = `${curated.source}:${curated.slug}`
    if (!groups.has(key)) groups.set(key, { source: curated.source, slug: curated.slug, apiBase: curated.apiBase, rows: [] })
    groups.get(key)!.rows.push(row)
  }

  await Promise.allSettled(
    Array.from(groups.values()).map(async ({ source, slug, apiBase, rows: groupRows }) => {
      const liveTitles = new Set((await fetchAtsTitlesForCompany(source, slug, apiBase)).map(t => t.toLowerCase().trim()))
      for (const row of groupRows) {
        const stillLive = liveTitles.has(row.jobs!.title.toLowerCase().trim())
        if (stillLive) continue
        await supabase.from('application_review_queue').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', row.id)
        await supabase.from('jobs').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', row.job_id)
      }
    })
  )
}

// ---------------------------------------------------------------------------
// Pipeline steps
// ---------------------------------------------------------------------------

async function runScoutStep(userId: string, onStep?: StepCallback): Promise<Array<ScoutResult & { id: string }>> {
  const runId = await startRun('scout', null, {}, userId)
  const t0 = Date.now()
  onStep?.('scout', 'running')

  try {
    const { results, suggestedCompanies } = await runScout()

    // Collapse duplicate URLs within this single scout batch first. upsertJob
    // runs concurrently below, so two identical URLs would both pass the 7-day
    // dedup check (neither is persisted yet) and get queued twice. Cross-run
    // dedup (getRecentJobId) still handles URLs seen in earlier runs.
    const seenUrls = new Set<string>()
    const uniqueResults = results.filter((r) => {
      if (seenUrls.has(r.url)) return false
      seenUrls.add(r.url)
      return true
    })

    // upsertJob returns null for jobs seen within the last 7 days — filter those out.
    // Unverified results are still persisted (status: 'unverified') for audit purposes,
    // but never make it into the array returned here, so they never reach the classifier.
    const withIds = (
      await Promise.all(
        uniqueResults.map(async (r) => {
          const id = await upsertJob(r, userId)
          if (!id || !r.verified) return null
          return { ...r, id }
        })
      )
    ).filter((r): r is ScoutResult & { id: string } => r !== null)

    const unverifiedCount = uniqueResults.filter(r => !r.verified).length

    await completeRun(
      runId,
      { total: results.length, fresh: withIds.length, unverified: unverifiedCount, suggestedCompanies },
      undefined,
      Date.now() - t0
    )
    onStep?.('scout', 'success')
    return withIds
  } catch (err) {
    await failRun(runId, err)
    onStep?.('scout', 'failed')
    throw err
  }
}

// Classifier rule: never re-score an identical posting. Match on company +
// title + posted date (calendar day) against everything already scored for
// this user, and reuse the prior verdict instead of calling the LLM again.
async function findPriorClassifications(
  jobs: Array<ScoutResult & { id: string }>,
  userId: string
): Promise<Map<string, ClassifierResult>> {
  const jobIds = new Set(jobs.map(j => j.id))
  const { data: priorRows } = await supabase
    .from('jobs')
    .select('id, title, company, scraped_at, classifier_score, cv_track, industry, verdict, hard_cap_reason')
    .eq('user_id', userId)
    .not('classifier_score', 'is', null)

  type PriorRow = {
    id: string; title: string; company: string; scraped_at: string | null
    classifier_score: number | null; cv_track: string | null; industry: string | null
    verdict: string | null; hard_cap_reason: string | null
  }

  const dedupKey = (title: string, company: string, scrapedAt: string | null) =>
    `${company.trim().toLowerCase()}|${title.trim().toLowerCase()}|${scrapedAt?.slice(0, 10) ?? ''}`

  const priorByKey = new Map<string, PriorRow>()
  for (const row of (priorRows ?? []) as PriorRow[]) {
    if (jobIds.has(row.id)) continue // don't match a job against itself within the same batch
    const key = dedupKey(row.title, row.company, row.scraped_at)
    if (!priorByKey.has(key)) priorByKey.set(key, row)
  }

  const reused = new Map<string, ClassifierResult>()
  for (const job of jobs) {
    const prior = priorByKey.get(dedupKey(job.title, job.company, job.scraped_at))
    if (!prior) continue
    const score = prior.classifier_score ?? 0
    const verdict = (prior.verdict ?? 'worth_a_look') as ClassifierResult['verdict']
    reused.set(job.id, {
      job_id: job.id,
      score,
      cv_track: (prior.cv_track ?? 'ux') as ClassifierResult['cv_track'],
      industry: prior.industry ?? 'Other',
      score_rationale: 'Reused from prior identical posting (dedup) — see original job for full rationale.',
      key_matches: [],
      red_flags: [],
      passedThreshold: verdict !== 'skipped' && score >= SCORE_THRESHOLD,
      verdict,
      hard_cap_reason: prior.hard_cap_reason,
      bonus_count: 0,
    })
  }
  return reused
}

async function runClassifyStep(
  jobs: Array<ScoutResult & { id: string }>,
  userId: string,
  onStep?: StepCallback
): Promise<ClassifierResult[]> {
  const runId = await startRun('classifier', null, { count: jobs.length }, userId)
  const t0 = Date.now()
  onStep?.('classifier', 'running')

  try {
    const reused = await findPriorClassifications(jobs, userId)
    const toClassify = jobs.filter(j => !reused.has(j.id))
    const freshResults = toClassify.length > 0 ? await classifyBatch(toClassify) : []
    const results = [...reused.values(), ...freshResults]

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
    onStep?.('classifier', 'success')
    return results
  } catch (err) {
    await failRun(runId, err)
    onStep?.('classifier', 'failed')
    throw err
  }
}

async function runDocumentStep(
  jobId: string,
  classification: ClassifierResult,
  userId: string,
  onStep?: StepCallback,
  trace?: LangfuseTraceClient | null
): Promise<void> {
  const job = await getJobRawJd(jobId)

  // CV Base — no LLM call, no span needed
  const cvRunId = await startRun('cvSelector', jobId, { track: classification.cv_track }, userId)
  const t0cv = Date.now()
  onStep?.('cvSelector', 'running')
  let cvVersion
  try {
    cvVersion = await selectCV(classification.cv_track, userId)
    await saveArtifact(jobId, 'cv_base', cvVersion.content)
    await completeRun(cvRunId, cvVersion, undefined, Date.now() - t0cv)
    onStep?.('cvSelector', 'success')
  } catch (err) {
    await failRun(cvRunId, err)
    onStep?.('cvSelector', 'failed')
    throw err
  }

  // Resume Tailor — LLM call: set active span so callAI logs generation under it
  const tailorRunId = await startRun('resumeTailor', jobId, { track: classification.cv_track }, userId)
  const t0tailor = Date.now()
  onStep?.('resumeTailor', 'running')
  const tailorSpan = trace?.span({ name: 'resumeTailor', input: { track: classification.cv_track, jobId }, startTime: new Date() }) ?? null
  setActiveSpan(tailorSpan)
  let tailored
  try {
    tailored = await tailorResume(cvVersion.content, job.raw_jd ?? '', classification.cv_track)
    await saveArtifact(jobId, 'resume_tailored', tailored, tailored.diff)
    await completeRun(tailorRunId, tailored, undefined, Date.now() - t0tailor)
    onStep?.('resumeTailor', 'success')
  } catch (err) {
    await failRun(tailorRunId, err)
    onStep?.('resumeTailor', 'failed')
    throw err
  } finally {
    setActiveSpan(null)
    tailorSpan?.end()
  }

  // Cover Letter — LLM call
  const clRunId = await startRun('coverLetterWriter', jobId, { title: job.title }, userId)
  const t0cl = Date.now()
  onStep?.('coverLetterWriter', 'running')
  const clSpan = trace?.span({ name: 'coverLetterWriter', input: { title: job.title, company: job.company }, startTime: new Date() }) ?? null
  setActiveSpan(clSpan)
  try {
    const letter = await writeCoverLetter(job.title, job.company, job.raw_jd ?? '', classification.cv_track)
    await saveArtifact(jobId, 'cover_letter', letter)
    await completeRun(clRunId, letter, undefined, Date.now() - t0cl)
    onStep?.('coverLetterWriter', 'success')
  } catch (err) {
    await failRun(clRunId, err)
    onStep?.('coverLetterWriter', 'failed')
    throw err
  } finally {
    setActiveSpan(null)
    clSpan?.end()
  }
}

async function runFormStep(
  jobId: string,
  userId: string,
  onStep?: StepCallback,
  trace?: LangfuseTraceClient | null
): Promise<void> {
  const job = await getJobRawJd(jobId)
  if (!job.url) return

  const fmRunId = await startRun('formMapper', jobId, { url: job.url }, userId)
  const t0 = Date.now()
  onStep?.('formMapper', 'running')
  const fmSpan = trace?.span({ name: 'formMapper', input: { url: job.url }, startTime: new Date() }) ?? null
  setActiveSpan(fmSpan)
  let formMapping
  try {
    formMapping = await mapForm(job.url, job.raw_jd ?? undefined)
    await saveArtifact(jobId, 'form_mapping', formMapping)
    await completeRun(fmRunId, formMapping, undefined, Date.now() - t0)
    onStep?.('formMapper', 'success')
  } catch (err) {
    await failRun(fmRunId, err)
    onStep?.('formMapper', 'failed')
    return
  } finally {
    setActiveSpan(null)
    fmSpan?.end()
  }

  const ssRunId = await startRun('screenshotCapturer', jobId, { url: job.url }, userId)
  const t0ss = Date.now()
  onStep?.('screenshotCapturer', 'running')
  try {
    const screenshots = await captureScreenshots(jobId, job.url, formMapping) as ScreenshotResult & { skipped?: boolean; skip_reason?: string }
    if (screenshots.skipped) {
      await completeRun(ssRunId, { skipped: true, reason: 'Browser worker not deployed' }, undefined, Date.now() - t0ss)
      onStep?.('screenshotCapturer', 'skipped' as AgentStatus)
    } else {
      await saveArtifact(jobId, 'screenshot_before', null, null, screenshots.before_url)
      await saveArtifact(jobId, 'screenshot_filled', null, null, screenshots.filled_url)
      await completeRun(ssRunId, screenshots, undefined, Date.now() - t0ss)
      onStep?.('screenshotCapturer', 'success')
    }
  } catch (err) {
    await failRun(ssRunId, err)
    onStep?.('screenshotCapturer', 'failed')
  }
}

// ---------------------------------------------------------------------------
// Exported orchestration functions
// ---------------------------------------------------------------------------

export async function runScoutOnly(onStep?: StepCallback): Promise<ScoutResult[]> {
  const lf = createLangfuse()
  const trace = lf?.trace({
    name: 'scout_pipeline',
    input: { trigger: 'manual', timestamp: new Date().toISOString() },
  }) ?? null
  setActiveTrace(trace)

  const userId = await getCurrentUserId()

  // Re-check ATS-sourced roles already pending review — auto-archive anything
  // that 404s or was filled since it was queued, before scouting new roles.
  await recheckPendingAtsJobs(userId)

  // Scout — no LLM calls
  const jobs = await runScoutStep(userId, onStep)

  // Classifier — LLM call per job
  const classifySpan = trace?.span({ name: 'classifier', input: { jobCount: jobs.length }, startTime: new Date() }) ?? null
  setActiveSpan(classifySpan)
  const classifications = await runClassifyStep(jobs, userId, onStep)
  setActiveSpan(null)
  classifySpan?.end({ output: { classified: classifications.length } })

  // Write scores to ALL classified jobs — critical path, must succeed
  for (const c of classifications) {
    await supabase
      .from('jobs')
      .update({
        classifier_score: c.score,
        cv_track: c.cv_track,
        verdict: c.verdict,
        hard_cap_reason: c.hard_cap_reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', c.job_id)
  }
  // Write industry separately — non-critical, silently ignored if column missing
  for (const c of classifications) {
    if (c.industry) {
      await supabase.from('jobs').update({ industry: c.industry }).eq('id', c.job_id)
    }
  }

  // Feed classified jobs into Cognee knowledge graph (fire-and-forget, non-blocking)
  if (hasCogneeConfig()) {
    onStep?.('cognee', 'running')
    Promise.all(
      classifications.map(c => {
        const job = jobs.find(j => j.id === c.job_id)
        if (!job) return Promise.resolve()
        return cogneeRemember(buildJobMemory(job, c))
      })
    )
      .then(() => onStep?.('cognee', 'success'))
      .catch(() => onStep?.('cognee', 'failed'))
  }

  // Gatekeeper — no LLM
  const passing = classifications.filter(c => c.passedThreshold)
  onStep?.('reviewGatekeeper', 'running')
  for (const classification of passing) {
    await gatekeeper.enqueue(classification.job_id, classification.score, classification.cv_track)
    await supabase
      .from('jobs')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', classification.job_id)
  }
  onStep?.('reviewGatekeeper', 'success')

  trace?.update({ output: { jobsFound: jobs.length, classified: classifications.length, queued: passing.length } })
  setActiveTrace(null)
  await lf?.flushAsync().catch(() => { /* non-critical */ })

  return jobs
}

export async function runFullPipeline(onStep?: StepCallback): Promise<void> {
  const lf = createLangfuse()
  const trace = lf?.trace({
    name: 'full_pipeline',
    input: { trigger: 'manual', timestamp: new Date().toISOString() },
  }) ?? null
  setActiveTrace(trace)

  const userId = await getCurrentUserId()

  // Re-check ATS-sourced roles already pending review — auto-archive anything
  // that 404s or was filled since it was queued, before scouting new roles.
  await recheckPendingAtsJobs(userId)

  // Scout — no LLM
  const jobs = await runScoutStep(userId, onStep)

  // Classifier — LLM per job
  const classifySpan = trace?.span({ name: 'classifier', input: { jobCount: jobs.length }, startTime: new Date() }) ?? null
  setActiveSpan(classifySpan)
  const classifications = await runClassifyStep(jobs, userId, onStep)
  setActiveSpan(null)
  classifySpan?.end({ output: { classified: classifications.length } })

  // Write scores to ALL classified jobs — critical path
  for (const c of classifications) {
    await supabase
      .from('jobs')
      .update({
        classifier_score: c.score,
        cv_track: c.cv_track,
        verdict: c.verdict,
        hard_cap_reason: c.hard_cap_reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', c.job_id)
  }
  // Write industry separately — non-critical
  for (const c of classifications) {
    if (c.industry) {
      await supabase.from('jobs').update({ industry: c.industry }).eq('id', c.job_id)
    }
  }

  const passing = classifications.filter(c => c.passedThreshold)
  for (let i = 0; i < passing.length; i++) {
    const classification = passing[i]
    const jobId = classification.job_id

    // Brief pause between jobs to avoid rate limits (not needed for first job)
    if (i > 0) await new Promise(r => setTimeout(r, 1500))

    await runDocumentStep(jobId, classification, userId, onStep, trace)
    await runFormStep(jobId, userId, onStep, trace)

    onStep?.('reviewGatekeeper', 'running')
    await gatekeeper.enqueue(jobId, classification.score, classification.cv_track)
    await supabase
      .from('jobs')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', jobId)
    onStep?.('reviewGatekeeper', 'success')
  }

  trace?.update({ output: { jobsFound: jobs.length, classified: classifications.length, queued: passing.length } })
  setActiveTrace(null)
  await lf?.flushAsync().catch(() => { /* non-critical */ })
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
    industry: 'Other',
    score_rationale: '',
    key_matches: [],
    red_flags: [],
    passedThreshold: true,
    verdict: 'worth_a_look',
    hard_cap_reason: null,
    bonus_count: 0,
  }

  await runDocumentStep(jobId, classification, userId)
}

// Extract title/company/location from a pasted JD — fast LLM call, falls back gracefully
async function extractJobMeta(url: string, rawJd?: string): Promise<{ title: string; company: string; location: string }> {
  const urlHostname = (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return url } })()
  const atsMatch = url.match(/(?:greenhouse\.io|lever\.co|ashbyhq\.com|recruitee\.com|workable\.com|smartrecruiters\.com)\/([^/?#]+)/i)
  const companyFromUrl = atsMatch ? atsMatch[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : ''

  if (!rawJd || rawJd.length < 80) {
    return { title: 'Manual Job Entry', company: companyFromUrl || urlHostname, location: 'Unknown' }
  }

  try {
    const raw = await callAI({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      groqModel: 'llama-3.1-8b-instant',
      messages: [{
        role: 'user',
        content: `Extract from this job posting. Return JSON only, no markdown:\n{"title":"...","company":"...","location":"..."}\n\n${rawJd.slice(0, 900)}`,
      }],
      max_tokens: 80,
      temperature: 0,
    })
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as { title?: string; company?: string; location?: string }
    return {
      title: parsed.title || 'Manual Job Entry',
      company: parsed.company || companyFromUrl || urlHostname,
      location: parsed.location || 'Unknown',
    }
  } catch {
    return { title: 'Manual Job Entry', company: companyFromUrl || urlHostname, location: 'Unknown' }
  }
}

// Run the full pipeline on a single job submitted manually by the user.
// Duplicate URLs are rejected — the DB constraint and getSeenJobId both guard this.
export async function runManualJob(
  url: string,
  rawJd: string,
  onStep?: StepCallback
): Promise<void> {
  const userId = await getCurrentUserId()

  // Duplicate guard
  const existingId = await getSeenJobId(url, userId)
  if (existingId) throw new Error('This job URL is already in your pipeline.')

  // Extract meta then insert
  onStep?.('classifier', 'running')
  const meta = await extractJobMeta(url, rawJd)

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      title: meta.title,
      company: meta.company,
      location: meta.location,
      url,
      source: 'manual',
      raw_jd: rawJd || '',
      scraped_at: new Date().toISOString(),
      status: 'discovered',
      verified: true,
      verification_source: 'manual',
      updated_at: new Date().toISOString(),
      user_id: userId,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Failed to create job: ${error?.message}`)
  const jobId = data.id as string

  const DEFAULT_CLASSIFICATION: ClassifierResult = {
    job_id: jobId,
    score: 7.0,
    cv_track: 'ux' as const,
    industry: 'Other',
    score_rationale: 'Manual entry — classifier unavailable',
    key_matches: [],
    red_flags: [],
    passedThreshold: true,
    verdict: 'worth_a_look',
    hard_cap_reason: null,
    bonus_count: 0,
  }

  // Classify — 10s timeout, degrade gracefully on rate limit or slow response
  let classification: ClassifierResult
  try {
    const timeout = new Promise<ClassifierResult[]>((_, reject) =>
      setTimeout(() => reject(new Error('classifier timeout')), 10_000)
    )
    const classifications = await Promise.race([
      classifyBatch([{
        id: jobId,
        title: meta.title,
        company: meta.company,
        location: meta.location,
        url,
        source: 'manual',
        raw_jd: rawJd || '',
        scraped_at: new Date().toISOString(),
        verified: true,
        verificationSource: 'manual',
      }]),
      timeout,
    ])
    classification = classifications[0] ?? DEFAULT_CLASSIFICATION
  } catch {
    classification = DEFAULT_CLASSIFICATION
  }
  classification.passedThreshold = true

  await supabase.from('jobs').update({
    classifier_score: classification.score,
    cv_track: classification.cv_track,
    status: 'classified',
    updated_at: new Date().toISOString(),
  }).eq('id', jobId)

  onStep?.('classifier', 'success')

  // Documents + form — failures are non-fatal; job still reaches review queue
  try {
    await runDocumentStep(jobId, classification, userId, onStep)
  } catch (err) {
    console.warn('[runManualJob] document step failed (rate limit?):', err)
    onStep?.('resumeTailor', 'failed')
    onStep?.('coverLetterWriter', 'failed')
  }
  try {
    await runFormStep(jobId, userId, onStep)
  } catch (err) {
    console.warn('[runManualJob] form step failed:', err)
    onStep?.('formMapper', 'failed')
  }

  // Enqueue for human review
  onStep?.('reviewGatekeeper', 'running')
  await gatekeeper.enqueue(jobId, classification.score, classification.cv_track)
  await supabase.from('jobs').update({ status: 'queued', updated_at: new Date().toISOString() }).eq('id', jobId)
  onStep?.('reviewGatekeeper', 'success')
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

  // Watch for inbox reply if Gmail is connected
  if (isStatusTrackerReady()) {
    const watchRunId = await startRun('statusTracker', jobId, { action: 'watch' }, userId)
    try {
      const status = await watchJob(jobId)
      await completeRun(watchRunId, { status })
    } catch (err) {
      await failRun(watchRunId, err)
    }
  }

  return submission
}

export async function forceEnqueueJob(jobId: string): Promise<void> {
  const { data: job } = await supabase
    .from('jobs')
    .select('classifier_score, cv_track')
    .eq('id', jobId)
    .single()

  const score = (job?.classifier_score as number | null) ?? 5.0
  const track = (job?.cv_track as 'ux' | 'pm' | 'devrel' | null) ?? 'ux'

  await gatekeeper.enqueue(jobId, score, track)
  await supabase
    .from('jobs')
    .update({ status: 'queued', updated_at: new Date().toISOString() })
    .eq('id', jobId)
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
