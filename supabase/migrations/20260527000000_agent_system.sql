-- =============================================================================
-- Agent System Migration
-- Creates: jobs, agent_runs, application_artifacts,
--          application_review_queue, cv_versions
-- Does NOT modify any existing tables.
-- =============================================================================

-- Jobs discovered by the Scout agent (separate from user-entered applications)
CREATE TABLE IF NOT EXISTS jobs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  company     TEXT        NOT NULL,
  location    TEXT,
  url         TEXT        UNIQUE,
  source      TEXT        CHECK (source IN ('linkedin','greenhouse','lever','remotive','relocate')),
  raw_jd      TEXT,
  status      TEXT        NOT NULL DEFAULT 'discovered'
                          CHECK (status IN (
                            'discovered','classified','queued',
                            'approved','submitted','rejected',
                            'no_reply','screening','interview'
                          )),
  scraped_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only_jobs" ON jobs
  USING (auth.uid() IS NOT NULL);

-- Agent run audit log
CREATE TABLE IF NOT EXISTS agent_runs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID        REFERENCES jobs(id) ON DELETE CASCADE,
  agent_name       TEXT        NOT NULL,
  status           TEXT        NOT NULL CHECK (status IN ('running','success','failed')),
  input_snapshot   JSONB,
  output_snapshot  JSONB,
  error_message    TEXT,
  tokens_used      INTEGER,
  duration_ms      INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only_agent_runs" ON agent_runs
  USING (auth.uid() IS NOT NULL);

-- All artifacts produced per application
CREATE TABLE IF NOT EXISTS application_artifacts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID        REFERENCES jobs(id) ON DELETE CASCADE,
  artifact_type    TEXT        NOT NULL
                               CHECK (artifact_type IN (
                                 'resume_tailored','cover_letter','form_mapping',
                                 'screenshot_before','screenshot_filled','cv_base'
                               )),
  content          JSONB,
  storage_url      TEXT,
  diff_from_base   JSONB,
  approved_by_user BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE application_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only_artifacts" ON application_artifacts
  USING (auth.uid() IS NOT NULL);

-- Review queue state machine
CREATE TABLE IF NOT EXISTS application_review_queue (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID        REFERENCES jobs(id) ON DELETE CASCADE UNIQUE,
  status            TEXT        NOT NULL DEFAULT 'pending_review'
                                CHECK (status IN (
                                  'pending_review','approved','rejected',
                                  'submitted','archived'
                                )),
  classifier_score  NUMERIC(3,1),
  cv_track          TEXT        CHECK (cv_track IN ('ux','pm','devrel')),
  review_notes      TEXT,
  reviewed_at       TIMESTAMPTZ,
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE application_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only_review_queue" ON application_review_queue
  USING (auth.uid() IS NOT NULL);

-- CV versions — one row per track, seeded below
CREATE TABLE IF NOT EXISTS cv_versions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  track        TEXT        NOT NULL UNIQUE CHECK (track IN ('ux','pm','devrel')),
  label        TEXT        NOT NULL,
  accent_color TEXT        NOT NULL,
  content      JSONB       NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cv_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only_cv_versions" ON cv_versions
  USING (auth.uid() IS NOT NULL);

-- Seed CV version scaffolds (content filled in by owner)
INSERT INTO cv_versions (track, label, accent_color, content)
VALUES
  ('ux',     'UX Engineer',        '#06b6d4', '{
    "summary": "",
    "experience": [],
    "skills": []
  }'::jsonb),
  ('pm',     'Product Manager',    '#8b5cf6', '{
    "summary": "",
    "experience": [],
    "skills": []
  }'::jsonb),
  ('devrel', 'Developer Relations','#f97316', '{
    "summary": "",
    "experience": [],
    "skills": []
  }'::jsonb)
ON CONFLICT (track) DO NOTHING;
