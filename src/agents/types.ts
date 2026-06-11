// Shared types for the agent system

export interface ScoutResult {
  title: string
  company: string
  location: string
  url: string
  source: 'linkedin' | 'greenhouse' | 'lever' | 'remotive' | 'relocate' | 'arbeitnow'
    | 'germantechjobs' | 'euremotejobs' | 'smartrecruiters' | 'recruitee' | 'ashby'
    | 'himalayas' | 'wttj' | 'thehub' | 'workable' | 'personio'
  raw_jd: string
  scraped_at: string
}

export interface ClassifierResult {
  job_id: string
  score: number
  cv_track: 'ux' | 'pm' | 'devrel'
  score_rationale: string
  key_matches: string[]
  red_flags: string[]
}

export interface ContactInfo {
  name: string
  email: string
  location: string
  linkedin?: string
  portfolio?: string
  phone?: string
}

export interface EducationEntry {
  degree: string
  institution: string
  location: string
  year: string
}

export interface ProjectEntry {
  name: string
  url?: string
  description: string
}

export interface LanguageEntry {
  language: string
  level: string
}

export interface CertificationEntry {
  name: string
  issuer: string
  year: string
}

export interface CVContent {
  contact?: ContactInfo
  summary: string
  experience: Array<{
    company: string
    role: string
    dates?: string
    bullets: string[]
  }>
  skills: string[]
  education?: EducationEntry[]
  projects?: ProjectEntry[]
  languages?: LanguageEntry[]
  certifications?: CertificationEntry[]
}

export interface TailoredResume {
  contact?: ContactInfo
  summary: string
  experience: Array<{
    company: string
    role: string
    dates?: string
    bullets: string[]
  }>
  skills: string[]
  education?: EducationEntry[]
  projects?: ProjectEntry[]
  languages?: LanguageEntry[]
  certifications?: CertificationEntry[]
  diff: Array<{
    field: string
    original: string
    tailored: string
  }>
}

export interface CoverLetter {
  subject_line: string
  key_requirements?: string[]
  body: string
  word_count: number
}

export interface FormField {
  label: string
  field_name: string
  field_type: string
  value: string
  confidence: number
  requires_manual: boolean
}

export interface FormMapping {
  url: string
  fields: FormField[]
}

export interface ScreenshotResult {
  job_id: string
  before_url: string
  filled_url: string
  captured_at: string
}

export interface CVVersion {
  id: string
  track: 'ux' | 'pm' | 'devrel'
  label: string
  accent_color: string
  content: CVContent
  updated_at: string
}

export interface Job {
  id: string
  title: string
  company: string
  location: string | null
  url: string | null
  source: string | null
  raw_jd: string | null
  status: string
  scraped_at: string | null
  created_at: string
  updated_at: string
}

export interface ReviewQueueRecord {
  id: string
  job_id: string
  status: 'pending_review' | 'approved' | 'rejected' | 'submitted' | 'archived'
  classifier_score: number | null
  cv_track: 'ux' | 'pm' | 'devrel' | null
  review_notes: string | null
  reviewed_at: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
  job?: Job
}

export interface AgentRun {
  id: string
  job_id: string | null
  agent_name: string
  status: 'running' | 'success' | 'failed'
  input_snapshot: unknown
  output_snapshot: unknown
  error_message: string | null
  tokens_used: number | null
  duration_ms: number | null
  created_at: string
}

export type EmailResponseType = 'no_reply' | 'rejection' | 'screening' | 'interview'
