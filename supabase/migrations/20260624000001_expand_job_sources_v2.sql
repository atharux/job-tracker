-- Add new scout sources: remoteok, berlinstartupjobs, europeremotely

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_source_check;

ALTER TABLE jobs ADD CONSTRAINT jobs_source_check
  CHECK (source IN (
    'linkedin', 'greenhouse', 'lever', 'remotive', 'relocate',
    'arbeitnow', 'germantechjobs', 'euremotejobs',
    'smartrecruiters', 'recruitee',
    'ashby', 'himalayas', 'wttj', 'thehub', 'workable', 'personio',
    'weworkremotely', 'jobicy',
    'remoteok', 'berlinstartupjobs', 'europeremotely'
  ));
