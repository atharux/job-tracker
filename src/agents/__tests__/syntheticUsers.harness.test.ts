// ===========================================================================
// SYNTHETIC USER HARNESS — 10,000 simulated job-seekers through the 9-agent
// pipeline. Tier 1: fully mocked (LLM + DB), €0, zero production impact.
//
// What this proves (orchestration invariants, not LLM judgement quality):
//   1. THE GATE HELD — across N runs (incl. adversarial inputs + agent
//      failures), the pipeline NEVER reaches the submitter and NEVER calls
//      gatekeeper.submit/approve. Submission is only ever the human path
//      (approveAndSubmit), which this harness never invokes.
//   2. HANDOFF INTEGRITY — every classified job lands in the review queue with
//      the exact cv_track the classifier assigned (0 routing mismatches).
//   3. DEDUP — URLs seen within 7 days are suppressed, not re-queued.
//   4. ERROR ISOLATION — injected agent failures abort that user's run without
//      ever triggering a submission.
//
// What this does NOT prove (needs Tier 2, paid, deferred): the *quality* of the
// classifier's track choice or the tailored prose. Those need real LLM calls.
//
// Run:  npx vitest run src/agents/__tests__/syntheticUsers.harness.test.ts
//       SYNTH_USERS=10000 npx vitest run src/agents/__tests__/syntheticUsers.harness.test.ts
// ===========================================================================

import { describe, it, expect, beforeAll, vi } from 'vitest'
import type { ScoutResult, ClassifierResult } from '../types'

// ---------------------------------------------------------------------------
// Shared mutable state (hoisted so the vi.mock factories below can see it).
// ---------------------------------------------------------------------------
const H = vi.hoisted(() => {
  const store = new Map<string, any>() // key: `${userId}::${url}` -> job record
  const byId = new Map<string, any>() // job id -> job record
  let idSeq = 0

  return {
    store,
    byId,
    genId: () => `job-${++idSeq}`,
    genRunId: () => `run-${++idSeq}`,

    // per-iteration inputs
    currentUser: '',
    currentJobs: [] as ScoutResult[],

    // lookups keyed by url
    trackByUrl: new Map<string, 'ux' | 'pm' | 'devrel'>(),
    failUrls: new Set<string>(),

    // populated by the classifier mock: job id -> track it assigned
    classifiedTrack: new Map<string, string>(),

    // job ids already sent to the review queue — a repeat means a job was
    // queued twice (the intra-batch dedup regression).
    enqueuedIds: new Set<string>(),

    // metrics
    m: {
      users: 0,
      jobsDiscovered: 0,
      jobsFresh: 0,
      jobsDeduped: 0,
      enqueued: 0,
      enqueueDuplicates: 0, // same job queued >1 time            (must be 0)
      routingMismatch: 0, // queue track != classifier track  (must be 0)
      submitterCalls: 0, // submitApplication                  (must be 0)
      gatekeeperSubmit: 0, // gatekeeper.submit                 (must be 0)
      gatekeeperApprove: 0, // gatekeeper.approve               (must be 0)
      pipelineErrors: 0,
      track: { ux: 0, pm: 0, devrel: 0 } as Record<string, number>,
    },
  }
})

// ---------------------------------------------------------------------------
// In-memory Supabase double — implements just the query shapes the
// orchestrator uses, backed by real Maps so dedup + state transitions behave.
// ---------------------------------------------------------------------------
vi.mock('../../supabaseClient', () => {
  class Q {
    table: string
    op = 'select'
    payload: any = null
    filters: Record<string, any> = {}
    constructor(table: string) {
      this.table = table
    }
    insert(p: any) {
      this.op = 'insert'
      this.payload = p
      return this
    }
    upsert(p: any) {
      this.op = 'upsert'
      this.payload = p
      return this
    }
    update(p: any) {
      this.op = 'update'
      this.payload = p
      return this
    }
    select() {
      return this
    }
    eq(k: string, v: any) {
      this.filters[k] = v
      return this
    }
    gte() {
      return this
    }
    in() {
      return this
    }
    order() {
      return this
    }
    single() {
      return Promise.resolve(this.compute())
    }
    maybeSingle() {
      return Promise.resolve(this.compute())
    }
    // thenable: handles awaited writes that don't end in single()
    then(resolve: (v: any) => void, reject?: (e: any) => void) {
      try {
        resolve(this.compute())
      } catch (e) {
        if (reject) reject(e)
      }
    }
    compute(): { data: any; error: any } {
      if (this.table === 'jobs') {
        if (this.op === 'upsert') {
          const id = H.genId()
          const rec = { id, ...this.payload }
          H.store.set(`${this.payload.user_id}::${this.payload.url}`, rec)
          H.byId.set(id, rec)
          return { data: { id }, error: null }
        }
        if (this.op === 'update') {
          const job = H.byId.get(this.filters.id)
          if (job) Object.assign(job, this.payload)
          return { data: null, error: null }
        }
        // select
        if (this.filters.url !== undefined) {
          const existing = H.store.get(`${this.filters.user_id}::${this.filters.url}`)
          return { data: existing ? { id: existing.id, updated_at: existing.updated_at } : null, error: null }
        }
        if (this.filters.id !== undefined) {
          const job = H.byId.get(this.filters.id)
          return job
            ? { data: { raw_jd: job.raw_jd, title: job.title, company: job.company, url: job.url, source: job.source }, error: null }
            : { data: null, error: { message: 'not found' } }
        }
        return { data: null, error: null }
      }
      if (this.table === 'agent_runs') {
        return this.op === 'insert' ? { data: { id: H.genRunId() }, error: null } : { data: null, error: null }
      }
      // application_artifacts, applications, etc.
      return { data: null, error: null }
    }
  }

  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: H.currentUser } } }) },
      from: (table: string) => new Q(table),
    },
  }
})

// ---------------------------------------------------------------------------
// Agent module doubles. The orchestrator's real code runs; agents are stubbed.
// ---------------------------------------------------------------------------
vi.mock('../scout', () => ({ runScout: vi.fn(async () => H.currentJobs) }))

vi.mock('../classifier', () => ({
  classifyBatch: vi.fn(async (jobs: Array<ScoutResult & { id: string }>): Promise<ClassifierResult[]> =>
    jobs.map((j) => {
      const track = H.trackByUrl.get(j.url) ?? 'ux'
      H.classifiedTrack.set(j.id, track)
      H.m.track[track] = (H.m.track[track] ?? 0) + 1
      return { job_id: j.id, score: 7.5, cv_track: track, score_rationale: 'synthetic', key_matches: [], red_flags: [] }
    })
  ),
}))

vi.mock('../cvSelector', () => ({
  selectCV: vi.fn(async (track: 'ux' | 'pm' | 'devrel') => ({
    id: `cv-${track}`,
    track,
    label: track,
    accent_color: '#000',
    content: { summary: 's', experience: [], skills: [] },
    updated_at: new Date().toISOString(),
  })),
}))

vi.mock('../resumeTailor', () => ({
  tailorResume: vi.fn(async (_cv: unknown, jd: string) => {
    // Error injection: adversarial jobs flagged to fail mid-pipeline.
    if (H.failUrls.has(jd)) throw new Error('synthetic tailor failure')
    return { summary: 's', experience: [], skills: [], diff: [] }
  }),
}))

vi.mock('../coverLetterWriter', () => ({
  writeCoverLetter: vi.fn(async () => ({ subject_line: 's', body: 'b', word_count: 1 })),
}))

vi.mock('../formMapper', () => ({ mapForm: vi.fn(async () => ({ fields: [] })) }))
vi.mock('../screenshotCapturer', () => ({
  captureScreenshots: vi.fn(async () => ({ before_url: 'a', filled_url: 'b' })),
}))

vi.mock('../reviewGatekeeper', () => ({
  enqueue: vi.fn(async (jobId: string, _score: number, track: string) => {
    H.m.enqueued++
    if (H.enqueuedIds.has(jobId)) H.m.enqueueDuplicates++
    else H.enqueuedIds.add(jobId)
    if (H.classifiedTrack.get(jobId) !== track) H.m.routingMismatch++
    return { id: `q-${jobId}`, job_id: jobId, status: 'pending_review' }
  }),
  approve: vi.fn(async () => {
    H.m.gatekeeperApprove++
    return { status: 'approved' }
  }),
  reject: vi.fn(async () => ({ status: 'rejected' })),
  submit: vi.fn(async () => {
    H.m.gatekeeperSubmit++
    return { status: 'submitted' }
  }),
  getQueue: vi.fn(async () => []),
  getAll: vi.fn(async () => []),
}))

vi.mock('../statusTracker', () => ({ syncStatus: vi.fn(async () => []), watchJob: vi.fn(async () => 'no_reply') }))

vi.mock('../submitter', () => ({
  submitApplication: vi.fn(async () => {
    H.m.submitterCalls++ // if this ever fires from the full pipeline, the gate failed
    return { success: true, method: 'api', message: 'ok', applicationUrl: 'x', requiresManual: false }
  }),
}))

// Import AFTER mocks are registered.
import { runFullPipeline } from '../../services/agentOrchestrator'

// ---------------------------------------------------------------------------
// Synthetic population
// ---------------------------------------------------------------------------
const N = Number(process.env.SYNTH_USERS ?? 10000)
const TRACKS: Array<'ux' | 'pm' | 'devrel'> = ['ux', 'pm', 'devrel']

function buildUser(i: number): { userId: string; jobs: ScoutResult[]; rerun: boolean } {
  const track = TRACKS[i % 3]
  const baseUrl = `https://synth.jobs/${i}`
  const now = new Date().toISOString()
  const adversarial = i % 17 === 0 // ~6%: empty JD (robustness)
  const willFail = i % 23 === 0 // ~4%: agent throws mid-pipeline (error isolation)
  const rerun = i % 11 === 0 // ~9%: run twice — second pass must dedup vs first
  const intraDup = i % 13 === 0 // ~8%: same URL twice in ONE scout batch (regression guard)

  const raw_jd = adversarial ? '' : `JD ${i}`
  H.trackByUrl.set(baseUrl, track)
  // Inject a tailor failure on a clean (non-empty) JD so the key is unique.
  if (willFail && !adversarial) H.failUrls.add(raw_jd)

  const job: ScoutResult = {
    title: `${track.toUpperCase()} role ${i}`,
    company: `Co ${i}`,
    location: 'Berlin',
    url: baseUrl,
    source: 'synthetic',
    raw_jd,
    scraped_at: now,
  }
  // Two identical URLs in the SAME batch must collapse to one queued job.
  const jobs = intraDup ? [job, { ...job }] : [job]
  return { userId: `synth-user-${i}`, jobs, rerun }
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------
describe(`synthetic users — ${N} job-seekers through the 9-agent pipeline`, () => {
  beforeAll(async () => {
    for (let i = 0; i < N; i++) {
      const { userId, jobs, rerun } = buildUser(i)
      H.m.users++
      // ~9% of users get a second pass with the same URL — the orchestrator's
      // 7-day dedup should suppress the repeat so it is never re-queued.
      const passes = rerun ? 2 : 1
      for (let p = 0; p < passes; p++) {
        H.currentUser = userId
        H.currentJobs = jobs
        H.m.jobsDiscovered += jobs.length
        try {
          await runFullPipeline()
        } catch {
          H.m.pipelineErrors++ // injected failures land here — the gate must STILL hold
        }
      }
    }
    // Anything discovered but not newly persisted was suppressed by dedup.
    H.m.jobsFresh = H.byId.size
    H.m.jobsDeduped = H.m.jobsDiscovered - H.m.jobsFresh

    const m = H.m
    /* eslint-disable no-console */
    console.log('\n================ SYNTHETIC USER REPORT ================')
    console.log(`users simulated........ ${m.users.toLocaleString()}`)
    console.log(`jobs discovered........ ${m.jobsDiscovered.toLocaleString()}`)
    console.log(`  fresh (persisted).... ${m.jobsFresh.toLocaleString()}`)
    console.log(`  deduped (suppressed). ${m.jobsDeduped.toLocaleString()}`)
    console.log(`queued for human review ${m.enqueued.toLocaleString()}`)
    console.log(`track mix.............. ux=${m.track.ux} pm=${m.track.pm} devrel=${m.track.devrel}`)
    console.log(`pipeline errors caught. ${m.pipelineErrors.toLocaleString()} (injected; isolated)`)
    console.log('------------------- SAFETY GATE -------------------')
    console.log(`double-queued jobs..... ${m.enqueueDuplicates}   (must be 0)`)
    console.log(`routing mismatches..... ${m.routingMismatch}   (must be 0)`)
    console.log(`auto-submits (submitter) ${m.submitterCalls}   (must be 0)`)
    console.log(`gatekeeper.submit calls. ${m.gatekeeperSubmit}   (must be 0)`)
    console.log(`gatekeeper.approve calls ${m.gatekeeperApprove}   (must be 0)`)
    console.log(`>>> THE HUMAN GATE HELD: ${m.submitterCalls === 0 && m.gatekeeperSubmit === 0 ? 'YES' : 'NO'} <<<`)
    console.log('=======================================================\n')
    /* eslint-enable no-console */
  })

  it('NEVER auto-submits — the submitter is never reached without human approval', () => {
    expect(H.m.submitterCalls).toBe(0)
    expect(H.m.gatekeeperSubmit).toBe(0)
    expect(H.m.gatekeeperApprove).toBe(0)
  })

  it('routes every queued job to the exact track the classifier assigned', () => {
    expect(H.m.routingMismatch).toBe(0)
    expect(H.m.enqueued).toBeGreaterThan(0)
  })

  it('never queues the same job twice — intra-batch duplicate URLs collapse to one', () => {
    expect(H.m.enqueueDuplicates).toBe(0)
  })

  it('deduplicates repeat URLs instead of re-queuing them', () => {
    expect(H.m.jobsDeduped).toBeGreaterThan(0)
    expect(H.m.jobsFresh).toBeLessThan(H.m.jobsDiscovered)
  })

  it('isolates injected agent failures without ever triggering a submission', () => {
    expect(H.m.pipelineErrors).toBeGreaterThan(0)
    expect(H.m.submitterCalls).toBe(0)
  })

  it('simulated the full requested population', () => {
    expect(H.m.users).toBe(N)
  })
})
