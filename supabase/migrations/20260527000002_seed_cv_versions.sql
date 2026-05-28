-- Multi-tenant agent tables migration.
-- Adds user_id to jobs, cv_versions, and agent_runs.
-- Updates all RLS policies so each user sees only their own rows.
-- application_artifacts and application_review_queue inherit isolation via
-- their NOT NULL job_id foreign key.
--
-- Run AFTER 20260527000001_update_job_sources.sql.
-- =============================================================================

-- ── 1. Add user_id columns (nullable first so existing rows don't break) ─────

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE cv_versions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 2. Drop old unique constraints ───────────────────────────────────────────

-- jobs had url UNIQUE; we need (user_id, url) instead so two users can track the same posting
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_url_key;

-- cv_versions had track UNIQUE; we need (user_id, track) so each user has their own tracks
ALTER TABLE cv_versions DROP CONSTRAINT IF EXISTS cv_versions_track_key;
-- Also drop the old CHECK that enforces exactly 3 tracks globally; keep it per-row below
-- (the CHECK (track IN ('ux','pm','devrel')) stays — it's a row-level constraint)

-- ── 3. Add user-scoped unique constraints (drop first so re-runs are safe) ────

ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_user_url_key;
ALTER TABLE jobs
  ADD CONSTRAINT jobs_user_url_key UNIQUE (user_id, url);

ALTER TABLE cv_versions
  DROP CONSTRAINT IF EXISTS cv_versions_user_track_key;
ALTER TABLE cv_versions
  ADD CONSTRAINT cv_versions_user_track_key UNIQUE (user_id, track);

-- ── 4. Delete old scaffold rows (inserted without user_id) ───────────────────

DELETE FROM cv_versions WHERE user_id IS NULL;

-- ── 5. Drop old and any partially-created RLS policies ───────────────────────

DROP POLICY IF EXISTS "owner_only_jobs"         ON jobs;
DROP POLICY IF EXISTS "owner_only_cv_versions"  ON cv_versions;
DROP POLICY IF EXISTS "owner_only_agent_runs"   ON agent_runs;
DROP POLICY IF EXISTS "owner_only_artifacts"    ON application_artifacts;
DROP POLICY IF EXISTS "owner_only_review_queue" ON application_review_queue;

DROP POLICY IF EXISTS "user_jobs"         ON jobs;
DROP POLICY IF EXISTS "user_cv_versions"  ON cv_versions;
DROP POLICY IF EXISTS "user_agent_runs"   ON agent_runs;
DROP POLICY IF EXISTS "user_artifacts"    ON application_artifacts;
DROP POLICY IF EXISTS "user_review_queue" ON application_review_queue;

-- ── 6. New user-scoped RLS policies ──────────────────────────────────────────

-- jobs — direct user_id
CREATE POLICY "user_jobs" ON jobs
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- cv_versions — direct user_id
CREATE POLICY "user_cv_versions" ON cv_versions
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- agent_runs — direct user_id (nullable for legacy rows; those are invisible to all users)
CREATE POLICY "user_agent_runs" ON agent_runs
  USING  (user_id IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- application_artifacts — inherit via parent job (no user_id column needed)
CREATE POLICY "user_artifacts" ON application_artifacts
  USING (
    auth.uid() = (SELECT user_id FROM jobs WHERE id = job_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM jobs WHERE id = job_id)
  );

-- application_review_queue — inherit via parent job
CREATE POLICY "user_review_queue" ON application_review_queue
  USING (
    auth.uid() = (SELECT user_id FROM jobs WHERE id = job_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM jobs WHERE id = job_id)
  );
