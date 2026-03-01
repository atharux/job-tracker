-- ========================================
-- RESUME FEATURES - DATABASE SCHEMA
-- ========================================

-- Table: resumes
CREATE TABLE IF NOT EXISTS public.resumes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_filename TEXT,
  base_content TEXT,
  modules JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link resumes to applications
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS resume_id BIGINT REFERENCES public.resumes(id) ON DELETE SET NULL;

ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS tailored_modules JSONB DEFAULT '{}';

-- RLS for resumes
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_all_own_resumes"
ON public.resumes
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_resume_id ON public.applications(resume_id);
