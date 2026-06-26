// Langfuse observability client.
// All tracing is opt-in: no-op when keys are absent.
// Uses module-level trace/span context — safe in single-threaded browser JS.

import Langfuse from 'langfuse'
import type { LangfuseTraceClient, LangfuseSpanClient } from 'langfuse'

export type { LangfuseTraceClient, LangfuseSpanClient }

const PK_LS = 'langfuse_public_key'
const SK_LS = 'langfuse_secret_key'
const HOST_LS = 'langfuse_host'
export const LANGFUSE_DEFAULT_HOST = 'https://cloud.langfuse.com'

export function hasLangfuseConfig(): boolean {
  if (typeof localStorage === 'undefined') return false
  return !!(localStorage.getItem(PK_LS) && localStorage.getItem(SK_LS))
}

export function createLangfuse(): Langfuse | null {
  if (!hasLangfuseConfig()) return null
  return new Langfuse({
    publicKey: localStorage.getItem(PK_LS)!,
    secretKey: localStorage.getItem(SK_LS)!,
    baseUrl: localStorage.getItem(HOST_LS) ?? LANGFUSE_DEFAULT_HOST,
    flushAt: 15,
    flushInterval: 10000,
  })
}

let _trace: LangfuseTraceClient | null = null
let _span: LangfuseSpanClient | null = null

export function setActiveTrace(trace: LangfuseTraceClient | null): void { _trace = trace }
export function getActiveTrace(): LangfuseTraceClient | null { return _trace }
export function setActiveSpan(span: LangfuseSpanClient | null): void { _span = span }
export function getActiveSpan(): LangfuseSpanClient | null { return _span }

// Returns the innermost active parent for attaching generations
export function getActiveParent(): LangfuseTraceClient | LangfuseSpanClient | null {
  return _span ?? _trace
}
