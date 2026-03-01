# Resume Builder Database Setup Guide

This guide walks you through setting up the database schema for the Resume Builder & Manager feature.

## Prerequisites

- Access to your Supabase project dashboard
- Project URL: `https://ncympgnvdjqpeioypkja.supabase.co`
- Admin access to the SQL Editor

## Setup Steps

### Step 1: Apply the Migration

1. **Open Supabase Dashboard**
   - Navigate to https://supabase.com/dashboard
   - Select your project (ncympgnvdjqpeioypkja)

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Execute Migration**
   - Open the file: `supabase/migrations/20240101000000_resume_builder_schema.sql`
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" (or press Cmd/Ctrl + Enter)

4. **Verify Success**
   - You should see "Success. No rows returned" message
   - Check for any error messages in red

### Step 2: Verify the Schema

1. **Run Verification Script**
   - Open a new query in SQL Editor
   - Copy contents of `supabase/migrations/verify_schema.sql`
   - Paste and run
   - All checks should show "✓ PASS"

2. **Check Tables**
   - Go to "Table Editor" in the left sidebar
   - You should see three new tables:
     - `resume_versions`
     - `resume_modules`
     - `version_modules`

3. **Check RLS Policies**
   - Click on each table
   - Go to "Policies" tab
   - Verify policies are enabled and listed

### Step 3: Test the Schema

Run these test queries to ensure everything works:

```sql
-- Test 1: Create a test resume version
INSERT INTO resume_versions (user_id, name, template_id)
VALUES (auth.uid(), 'Test Resume', 'default')
RETURNING *;

-- Test 2: Create a test module
INSERT INTO resume_modules (user_id, type, content)
VALUES (
  auth.uid(), 
  'experience',
  '{"company": "Test Corp", "position": "Engineer", "startDate": "2020-01", "endDate": "Present", "achievements": ["Test achievement"]}'::jsonb
)
RETURNING *;

-- Test 3: Link module to version (replace UUIDs with actual IDs from above)
INSERT INTO version_modules (version_id, module_id, display_order)
VALUES ('YOUR_VERSION_ID', 'YOUR_MODULE_ID', 0)
RETURNING *;

-- Test 4: Fetch version with modules
SELECT 
  rv.*,
  json_agg(
    json_build_object(
      'id', rm.id,
      'type', rm.type,
      'content', rm.content,
      'display_order', vm.display_order
    ) ORDER BY vm.display_order
  ) as modules
FROM resume_versions rv
LEFT JOIN version_modules vm ON rv.id = vm.version_id
LEFT JOIN resume_modules rm ON vm.module_id = rm.id
WHERE rv.user_id = auth.uid()
GROUP BY rv.id;

-- Clean up test data
DELETE FROM resume_versions WHERE name = 'Test Resume';
```

### Step 4: Update Frontend Types (Optional)

If using TypeScript, generate types from the schema:

```bash
# If Supabase CLI is installed
supabase gen types typescript --linked > src/types/database.types.ts
```

Or use the pre-created types in `src/types/resume-builder.types.ts`.

## Troubleshooting

### Error: "relation already exists"

**Cause:** Tables already exist from a previous migration.

**Solution:** 
- Check if tables exist: `SELECT * FROM resume_versions LIMIT 1;`
- If they exist and are correct, skip migration
- If they need updating, drop tables first (see Rollback section)

### Error: "permission denied"

**Cause:** RLS policies are blocking the operation.

**Solution:**
- Ensure you're authenticated: `SELECT auth.uid();` should return a UUID
- Check RLS policies are correctly configured
- Verify user_id matches auth.uid()

### Error: "column already exists"

**Cause:** The `resume_version_id` column already exists in applications table.

**Solution:**
- This is safe to ignore if using `IF NOT EXISTS` clause
- Verify column exists: `SELECT resume_version_id FROM applications LIMIT 1;`

### Error: "function already exists"

**Cause:** The `update_updated_at_column` function already exists.

**Solution:**
- Use `CREATE OR REPLACE FUNCTION` (already in migration)
- Or drop and recreate: `DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;`

## Rollback

If you need to undo the migration:

```sql
-- WARNING: This will delete all resume data!

-- Drop tables (cascades to foreign keys)
DROP TABLE IF EXISTS public.version_modules CASCADE;
DROP TABLE IF EXISTS public.resume_modules CASCADE;
DROP TABLE IF EXISTS public.resume_versions CASCADE;

-- Remove column from applications
ALTER TABLE public.applications 
DROP COLUMN IF EXISTS resume_version_id;

-- Drop function and triggers
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
```

## Next Steps

After successful setup:

1. ✅ Database schema is ready
2. ✅ RLS policies are active
3. ✅ Indexes are created
4. ✅ Triggers are set up

Now you can:
- Start building the frontend components
- Use the database helper functions in `src/utils/resumeDatabase.js`
- Test CRUD operations with the new tables
- Integrate with the existing application tracker

## Support

For issues or questions:
- Check `supabase/DATABASE_SCHEMA.md` for detailed schema documentation
- Review `src/utils/resumeDatabase.js` for usage examples
- Consult the design document at `.kiro/specs/resume-builder-manager/design.md`

## Schema Summary

**Tables Created:**
- `resume_versions` - Named resume collections
- `resume_modules` - Individual resume components
- `version_modules` - Links versions to modules with ordering

**Security:**
- Row Level Security enabled on all tables
- Users can only access their own data
- Cascade deletes configured appropriately

**Performance:**
- 9 indexes created for optimal query performance
- Automatic timestamp updates via triggers
- JSONB content for flexible module structures

**Integration:**
- `applications.resume_version_id` column added
- Foreign key with ON DELETE SET NULL
- Index created for efficient lookups
