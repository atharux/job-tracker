// Context-assistant orchestrator + job-tracker wiring.
//
// runContextAssistant is engine/source-agnostic and is the reusable core other
// projects call. localJobSearch is the job-tracker-specific convenience that
// wires the Supabase adapter + lightweight engine, preserving the original
// public surface so existing callers are unchanged.

import type { AssistantEngine, AssistantResult, DataSource } from './types'
import { jobTrackerDataSource } from './jobTrackerAdapter'
import { lightweightEngine } from './lightweightEngine'

export type {
  AssistantLink,
  AssistantRecord,
  AssistantResult,
  DataSource,
  AssistantEngine,
} from './types'
export { jobTrackerDataSource } from './jobTrackerAdapter'
export { lightweightEngine } from './lightweightEngine'

export async function runContextAssistant(
  query: string,
  source: DataSource,
  engine: AssistantEngine,
): Promise<AssistantResult> {
  try {
    const { records, emptyReason } = await source.getRecords()
    if (records.length === 0) {
      return { answer: emptyReason ?? 'No data found.', links: [] }
    }
    const profileContext = await source.getProfileContext()
    return await engine.answer({ query, records, profileContext })
  } catch (err) {
    console.warn('[contextAssistant] error:', err)
    return { answer: '', links: [] }
  }
}

// Job-tracker default wiring. Signature preserved from the original
// cogneeClient.localJobSearch so callers need no change.
export async function localJobSearch(query: string): Promise<AssistantResult> {
  return runContextAssistant(query, jobTrackerDataSource, lightweightEngine)
}
