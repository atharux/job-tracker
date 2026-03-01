-- ========================================
-- RESUME BUILDER & MANAGER - DATABASE SCHEMA
-- Migration: Initial schema for resume builder feature
-- ========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- TABLE: resume_versions
-- Stores named resume versions (collections of modules)
-- ========================================
CREATE TABLE IF NOT EXISTS public.resume_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  template_id VARCHAR(50) DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_resume_name UNIQUE(user_id, name)
);

-- ========================================
-- TABLE: resume_modules
-- Stores individual resume components (experience, education, skills, etc.)
-- ========================================
CREATE TABLE IF NOT EXISTS public.resume_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('experience', 'education', 'skills', 'custom', 'summary', 'certification')),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- TABLE: version_modules
-- Junction table linking resume versions to modules with ordering
-- ========================================
CREATE TABLE IF NOT EXISTS public.version_modules (
  version_id UUID NOT NULL REFERENCES public.resume_versions(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.resume_modules(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (version_id, module_id)
);

-- ========================================
-- ALTER: applications table
-- Add resume_version_id to link applications to resume versions
-- ========================================
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS resume_version_id UUID REFERENCES public.resume_versions(id) ON DELETE SET NULL;

-- ========================================
-- INDEXES: Performance optimization
-- ========================================
CREATE INDEX IF NOT EXISTS idx_resume_versions_user ON public.resume_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_created ON public.resume_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_modules_user ON public.resume_modules(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_modules_type ON public.resume_modules(type);
CREATE INDEX IF NOT EXISTS idx_resume_modules_created ON public.resume_modules(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_version_modules_version ON public.version_modules(version_id);
CREATE INDEX IF NOT EXISTS idx_version_modules_module ON public.version_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_version_modules_order ON public.version_modules(version_id, display_order);
CREATE INDEX IF NOT EXISTS idx_applications_resume_version ON public.applications(resume_version_id);

-- ========================================
-- ROW LEVEL SECURITY: Enable RLS on all tables
-- ========================================
ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.version_modules ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES: resume_versions
-- Users can only access their own resume versions
-- ========================================
CREATE POLICY "Users can view own resume versions"
  ON public.resume_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resume versions"
  ON public.resume_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resume versions"
  ON public.resume_versions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own resume versions"
  ON public.resume_versions FOR DELETE
  USING (auth.uid() = user_id);

-- ========================================
-- RLS POLICIES: resume_modules
-- Users can only access their own modules
-- ========================================
CREATE POLICY "Users can view own modules"
  ON public.resume_modules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own modules"
  ON public.resume_modules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own modules"
  ON public.resume_modules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own modules"
  ON public.resume_modules FOR DELETE
  USING (auth.uid() = user_id);

-- ========================================
-- RLS POLICIES: version_modules
-- Users can manage version-module links for their own versions
-- ========================================
CREATE POLICY "Users can manage version-module links"
  ON public.version_modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.resume_versions
      WHERE id = version_modules.version_id
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.resume_versions
      WHERE id = version_modules.version_id
      AND user_id = auth.uid()
    )
  );

-- ========================================
-- FUNCTIONS: Automatic timestamp updates
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- TRIGGERS: Auto-update timestamps
-- ========================================
CREATE TRIGGER update_resume_versions_updated_at
  BEFORE UPDATE ON public.resume_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resume_modules_updated_at
  BEFORE UPDATE ON public.resume_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- COMMENTS: Documentation for tables and columns
-- ========================================
COMMENT ON TABLE public.resume_versions IS 'Stores named resume versions (collections of modules)';
COMMENT ON COLUMN public.resume_versions.template_id IS 'Template identifier for PDF export styling';
COMMENT ON TABLE public.resume_modules IS 'Stores individual resume components (experience, education, skills, etc.)';
COMMENT ON COLUMN public.resume_modules.type IS 'Module type: experience, education, skills, custom, summary, or certification';
COMMENT ON COLUMN public.resume_modules.content IS 'Flexible JSONB structure based on module type';
COMMENT ON TABLE public.version_modules IS 'Junction table linking resume versions to modules with display ordering';
COMMENT ON COLUMN public.version_modules.display_order IS 'Order in which modules appear in the resume version';
