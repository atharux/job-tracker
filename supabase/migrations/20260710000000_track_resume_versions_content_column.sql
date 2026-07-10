-- ========================================
-- TRACK SCHEMA DRIFT: resume_versions.content
-- The Resume Manager / Resume AI Assistant features read and write a flat
-- `content` text column on resume_versions that was added directly against
-- the live database and was never captured in a migration. This formalizes
-- it. Idempotent — safe to run against a database where the column already
-- exists.
-- ========================================

ALTER TABLE public.resume_versions
  ADD COLUMN IF NOT EXISTS content TEXT;
