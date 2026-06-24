-- Expand jobs_source_check to cover all active scout sources.
-- Added: ashby, himalayas, wttj, thehub, workable, personio, weworkremotely, jobicy

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_source_check;

ALTER TABLE jobs ADD CONSTRAINT jobs_source_check
  CHECK (source IN (
    'linkedin', 'greenhouse', 'lever', 'remotive', 'relocate',
    'arbeitnow', 'germantechjobs', 'euremotejobs',
    'smartrecruiters', 'recruitee',
    'ashby', 'himalayas', 'wttj', 'thehub', 'workable', 'personio',
    'weworkremotely', 'jobicy'
  ));
