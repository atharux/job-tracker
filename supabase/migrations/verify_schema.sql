-- ========================================
-- VERIFICATION SCRIPT
-- Run this after applying the migration to verify everything is set up correctly
-- ========================================

-- Check if all tables exist
SELECT 
  'Tables Check' as test_category,
  CASE 
    WHEN COUNT(*) = 3 THEN '✓ PASS: All 3 tables created'
    ELSE '✗ FAIL: Expected 3 tables, found ' || COUNT(*)
  END as result
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('resume_versions', 'resume_modules', 'version_modules');

-- Check if resume_version_id column was added to applications
SELECT 
  'Applications Column' as test_category,
  CASE 
    WHEN COUNT(*) = 1 THEN '✓ PASS: resume_version_id column added to applications'
    ELSE '✗ FAIL: resume_version_id column not found'
  END as result
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'applications'
AND column_name = 'resume_version_id';

-- Check if RLS is enabled on all tables
SELECT 
  'RLS Check' as test_category,
  CASE 
    WHEN COUNT(*) = 3 THEN '✓ PASS: RLS enabled on all 3 tables'
    ELSE '✗ FAIL: RLS not enabled on all tables'
  END as result
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('resume_versions', 'resume_modules', 'version_modules')
AND rowsecurity = true;

-- Check if all RLS policies are created
SELECT 
  'RLS Policies' as test_category,
  CASE 
    WHEN COUNT(*) >= 11 THEN '✓ PASS: All RLS policies created (' || COUNT(*) || ' policies)'
    ELSE '✗ FAIL: Expected at least 11 policies, found ' || COUNT(*)
  END as result
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('resume_versions', 'resume_modules', 'version_modules');

-- Check if all indexes are created
SELECT 
  'Indexes Check' as test_category,
  CASE 
    WHEN COUNT(*) >= 9 THEN '✓ PASS: All indexes created (' || COUNT(*) || ' indexes)'
    ELSE '✗ FAIL: Expected at least 9 indexes, found ' || COUNT(*)
  END as result
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('resume_versions', 'resume_modules', 'version_modules', 'applications')
AND indexname LIKE 'idx_%';

-- Check if triggers are created
SELECT 
  'Triggers Check' as test_category,
  CASE 
    WHEN COUNT(*) = 2 THEN '✓ PASS: All triggers created'
    ELSE '✗ FAIL: Expected 2 triggers, found ' || COUNT(*)
  END as result
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table IN ('resume_versions', 'resume_modules')
AND trigger_name LIKE 'update_%_updated_at';

-- Check if function exists
SELECT 
  'Function Check' as test_category,
  CASE 
    WHEN COUNT(*) = 1 THEN '✓ PASS: update_updated_at_column function created'
    ELSE '✗ FAIL: Function not found'
  END as result
FROM pg_proc
WHERE proname = 'update_updated_at_column';

-- List all created policies for review
SELECT 
  '--- Policy Details ---' as info,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('resume_versions', 'resume_modules', 'version_modules')
ORDER BY tablename, policyname;

-- List all created indexes for review
SELECT 
  '--- Index Details ---' as info,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('resume_versions', 'resume_modules', 'version_modules', 'applications')
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
