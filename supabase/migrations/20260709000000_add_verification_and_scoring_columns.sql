-- Scout ATS-first verification + Classifier asymmetric scoring rubric.
-- Adds verification tracking and rubric verdict columns to jobs, and
-- expands jobs_status_check to cover the new unverified/archived states.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS verification_source TEXT;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS verdict TEXT
  CHECK (verdict IN ('apply_first', 'worth_a_look', 'skipped'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hard_cap_reason TEXT;

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN (
    'discovered', 'classified', 'queued',
    'approved', 'submitted', 'rejected',
    'no_reply', 'screening', 'interview',
    'unverified', 'archived'
  ));
