-- Add classifier output columns to jobs table.
-- Previously these only existed on application_review_queue;
-- the scouted-jobs panel needs them on jobs itself.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS classifier_score NUMERIC(3,1);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cv_track TEXT CHECK (cv_track IN ('ux','pm','devrel'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS industry TEXT;

-- Also add user_id if it doesn't exist (needed for multi-user support)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
