# Resume Builder Database Migrations

This directory contains database migration files for the Resume Builder & Manager feature.

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Open your Supabase project dashboard at https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Open the migration file: `20240101000000_resume_builder_schema.sql`
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run** to execute the migration

### Option 2: Supabase CLI (If installed)

```bash
# Link to your project (if not already linked)
supabase link --project-ref ncympgnvdjqpeioypkja

# Push the migration to the hosted database
supabase db push

# Generate TypeScript types
supabase gen types typescript --linked > src/types/database.types.ts
```

## Migration Files

### `20240101000000_resume_builder_schema.sql`

Creates the core database schema for the Resume Builder feature:

**Tables Created:**
- `resume_versions` - Stores named resume versions
- `resume_modules` - Stores individual resume components
- `version_modules` - Junction table linking versions to modules

**Modifications:**
- Adds `resume_version_id` column to `applications` table

**Security:**
- Enables Row Level Security (RLS) on all new tables
- Creates RLS policies for user-specific data access

**Performance:**
- Creates indexes on frequently queried columns
- Adds automatic timestamp update triggers

## Verification

After applying the migration, verify the tables were created:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('resume_versions', 'resume_modules', 'version_modules');

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('resume_versions', 'resume_modules', 'version_modules');

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('resume_versions', 'resume_modules', 'version_modules');
```

## Rollback

If you need to rollback this migration:

```sql
-- Drop tables (cascades to foreign keys)
DROP TABLE IF EXISTS public.version_modules CASCADE;
DROP TABLE IF EXISTS public.resume_modules CASCADE;
DROP TABLE IF EXISTS public.resume_versions CASCADE;

-- Remove column from applications
ALTER TABLE public.applications DROP COLUMN IF EXISTS resume_version_id;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
```

## Next Steps

After applying the migration:

1. Generate TypeScript types for the new tables
2. Implement the frontend components
3. Test CRUD operations with RLS policies
4. Verify indexes are being used in query plans
