-- QUICK FIX: Update profiles with names if they're NULL
-- This is a temporary fix while we verify RLS policies

-- ============================================================================
-- Check current profile status
-- ============================================================================

SELECT 
  id,
  full_name,
  email,
  CASE 
    WHEN full_name IS NULL OR full_name = '' THEN '❌ NEEDS UPDATE'
    ELSE '✅ OK'
  END as status
FROM profiles
WHERE id IN (
  '1694d1da-b1e7-4918-aa03-a238468ebff1',
  '8c01919c-2967-4273-80fe-648b05bbc5fe',
  '51964500-4a51-49b9-b406-cc1076fc4854'
);

-- ============================================================================
-- Update profiles with names from email if full_name is NULL
-- ============================================================================

UPDATE profiles
SET full_name = COALESCE(
  NULLIF(full_name, ''),
  split_part(email, '@', 1),
  'User'
)
WHERE (full_name IS NULL OR full_name = '')
  AND id IN (
    '1694d1da-b1e7-4918-aa03-a238468ebff1',
    '8c01919c-2967-4273-80fe-648b05bbc5fe',
    '51964500-4a51-49b9-b406-cc1076fc4854'
  );

-- ============================================================================
-- Verify the update
-- ============================================================================

SELECT 
  id,
  full_name,
  email,
  '✅ Updated' as status
FROM profiles
WHERE id IN (
  '1694d1da-b1e7-4918-aa03-a238468ebff1',
  '8c01919c-2967-4273-80fe-648b05bbc5fe',
  '51964500-4a51-49b9-b406-cc1076fc4854'
);

-- ============================================================================
-- Now check if RLS policies exist
-- ============================================================================

SELECT 
  tablename,
  policyname,
  CASE 
    WHEN policyname LIKE '%matched%' THEN '✅ Good - Allows matched users'
    WHEN policyname LIKE '%own%' AND tablename = 'profiles' THEN '⚠️ Limited - Own only'
    ELSE '❓ Check this'
  END as assessment
FROM pg_policies
WHERE tablename = 'profiles'
  AND policyname LIKE '%view%'
ORDER BY policyname;

-- ============================================================================
-- IMPORTANT: If you don't see "Users can view matched users profiles" policy,
-- you MUST run fix_networking_intelligence_rls.sql
-- ============================================================================
