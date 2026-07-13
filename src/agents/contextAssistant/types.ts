// Context-assistant seam.
//
// The assistant answers natural-language questions over a project's records,
// grounded in a profile/context. Two seams keep it portable to other projects:
//   - DataSource: the ONLY project-specific part — where records + profile
//     context come from (job-tracker → Supabase applications/jobs).
//   - AssistantEngine: how an answer is produced (default: lightweight
//     LLM-over-records; Cognee graph is an optional engine added later).

// A clickable link back to a source record, shown to the user.
export interface AssistantLink {
  id: string
  title: string
  company: string
  url: string | null
  meta: string
  // Kept as a widening string union so other projects can add their own kinds;
  // job-tracker uses 'application' | 'pipeline'.
  source: string
}

// One record the engine reasons over. The DataSource pre-formats the two text
// projections so the engine stays project-agnostic:
//   - promptLine: fed to the LLM (the engine prefixes it with an index + id)
//   - fallbackLine: shown in the no-LLM fallback list
export interface AssistantRecord {
  id: string
  groupLabel: string
  promptLine: string
  fallbackLine: string
  link: AssistantLink
}

export interface AssistantResult {
  answer: string
  links: AssistantLink[]
}

export interface DataSource {
  // Fetch the records to reason over. `emptyReason` is a human-readable
  // diagnostic shown when there are no records.
  getRecords(): Promise<{ records: AssistantRecord[]; emptyReason?: string }>
  // A short candidate/profile context string injected into the engine prompt.
  // This is the seam where real CV grounding is injected later.
  getProfileContext(): Promise<string>
}

export interface AssistantEngine {
  answer(input: {
    query: string
    records: AssistantRecord[]
    profileContext: string
  }): Promise<AssistantResult>
}
