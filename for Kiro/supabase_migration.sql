-- Run this in your Supabase SQL editor
-- ─────────────────────────────────────────────────────────────────
-- 1. user_profiles table (stores the user's persistent "context brain")
-- ─────────────────────────────────────────────────────────────────
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  name text,
  title text,
  location text,
  email text,
  phone text,
  linkedin text,
  summary text,
  skills text,
  experience text,
  education text,
  languages text,
  certifications text,
  projects text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: users can only read/write their own profile
alter table user_profiles enable row level security;

create policy "Users manage own profile"
  on user_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- 2. Add columns to resume_versions if they don't already exist
--    (content stores the full resume text; the table itself already
--     exists — this just adds the new columns safely)
-- ─────────────────────────────────────────────────────────────────
alter table resume_versions
  add column if not exists content text,
  add column if not exists job_description text,
  add column if not exists analysis jsonb,
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Make sure RLS allows user-scoped access (if not already set)
alter table resume_versions enable row level security;

-- Drop old policy if it exists, recreate with user_id scope
drop policy if exists "Users manage own resume versions" on resume_versions;
create policy "Users manage own resume versions"
  on resume_versions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
