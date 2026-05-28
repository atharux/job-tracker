-- Add new job board sources to the jobs.source CHECK constraint
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_source_check;

ALTER TABLE jobs ADD CONSTRAINT jobs_source_check
  CHECK (source IN (
    'linkedin', 'greenhouse', 'lever', 'remotive', 'relocate',
    'arbeitnow', 'germantechjobs', 'euremotejobs',
    'smartrecruiters', 'recruitee'
  ));
