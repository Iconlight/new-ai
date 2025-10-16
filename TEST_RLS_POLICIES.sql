-- Test RLS Policies for Networking Intelligence
-- Run these queries in Supabase SQL Editor to verify RLS is working

-- ============================================================================
-- STEP 1: Check if you have matches
-- ============================================================================
-- Replace 'YOUR_USER_ID' with your actual user ID: 51964500-4a51-49b9-b406-cc1076fc4854

SELECT 
  id as match_id,
  user_id_1,
  user_id_2,
  status,
  compatibility_score
FROM user_matches
WHERE user_id_1 = '51964500-4a51-49b9-b406-cc1076fc4854'
   OR user_id_2 = '51964500-4a51-49b9-b406-cc1076fc4854';

-- Expected: Should see 2 matches (with users 1694d1da... and 8c01919c...)

-- ============================================================================
-- STEP 2: Check if matched users have profiles
-- ============================================================================

SELECT 
  id,
  full_name,
  email,
  avatar_url
FROM profiles
WHERE id IN (
  '1694d1da-b1e7-4918-aa03-a238468ebff1',
  '8c01919c-2967-4273-80fe-648b05bbc5fe'
);

-- Expected: Should see profiles with full_name populated
-- If full_name is NULL, that's why it shows "User"

-- ============================================================================
-- STEP 3: Test if YOU can see matched users' profiles (RLS test)
-- ============================================================================
-- This simulates what the app does

-- First, set the auth context to your user
-- (In Supabase SQL Editor, you're running as postgres, so we need to check the policy)

-- Check current RLS policies on profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles';

-- Expected: Should see policy "Users can view matched users profiles"

-- ============================================================================
-- STEP 4: Check if matched users have conversation patterns
-- ============================================================================

SELECT 
  user_id,
  communication_style,
  interests,
  curiosity_level,
  topic_depth
FROM user_conversation_patterns
WHERE user_id IN (
  '1694d1da-b1e7-4918-aa03-a238468ebff1',
  '8c01919c-2967-4273-80fe-648b05bbc5fe'
);

-- Expected: Should see patterns for both users

-- ============================================================================
-- STEP 5: Check if matched users have interests
-- ============================================================================

SELECT 
  user_id,
  interest
FROM user_interests
WHERE user_id IN (
  '1694d1da-b1e7-4918-aa03-a238468ebff1',
  '8c01919c-2967-4273-80fe-648b05bbc5fe'
);

-- Expected: Should see interests for both users

-- ============================================================================
-- STEP 6: Check RLS policies on all relevant tables
-- ============================================================================

SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN policyname LIKE '%matched%' THEN '✅ Allows matched users'
    WHEN policyname LIKE '%own%' THEN '⚠️ Own data only'
    ELSE '❓ Unknown'
  END as policy_type
FROM pg_policies
WHERE tablename IN (
  'profiles',
  'user_conversation_patterns',
  'user_interests',
  'messages',
  'networking_intelligence_chats'
)
ORDER BY tablename, policyname;

-- Expected: Should see policies that allow matched users to view each other's data

-- ============================================================================
-- DIAGNOSTIC: If profiles are NULL, update them
-- ============================================================================

-- Check if profiles exist but full_name is NULL
SELECT 
  id,
  full_name,
  email,
  CASE 
    WHEN full_name IS NULL OR full_name = '' THEN '❌ Name is missing'
    ELSE '✅ Name exists'
  END as status
FROM profiles
WHERE id IN (
  '1694d1da-b1e7-4918-aa03-a238468ebff1',
  '8c01919c-2967-4273-80fe-648b05bbc5fe'
);

-- If names are missing, update them:
-- UPDATE profiles SET full_name = 'Test User 1' WHERE id = '1694d1da-b1e7-4918-aa03-a238468ebff1';
-- UPDATE profiles SET full_name = 'Test User 2' WHERE id = '8c01919c-2967-4273-80fe-648b05bbc5fe';

-- ============================================================================
-- RESULTS INTERPRETATION
-- ============================================================================

/*
IF YOU SEE:
1. ✅ Matches exist → Good
2. ✅ Profiles exist with names → Good
3. ✅ Policies allow matched users → Good
4. ✅ Patterns and interests exist → Good

THEN: The app should work after hard refresh

IF YOU SEE:
1. ❌ No "matched users" policies → Run the migration!
2. ❌ Profiles have NULL names → Update profiles with names
3. ❌ No patterns/interests → Users need to complete onboarding

NEXT STEPS:
1. Run fix_networking_intelligence_rls.sql if policies are missing
2. Update profiles if names are NULL
3. Hard refresh the app (Ctrl+Shift+R)
4. Test again
*/
