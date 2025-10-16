-- Diagnostic script to check RLS policies and data existence
-- Run this to see what's blocking access

-- ============================================================================
-- 1. Check what RLS policies exist on profiles table
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================================================
-- 2. Check what RLS policies exist on messages table
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'messages'
ORDER BY policyname;

-- ============================================================================
-- 3. Check if the target user profile actually exists
-- ============================================================================

-- Replace '8c01919c-2967-4273-80fe-648b05bbc5fe' with the target user ID from debug
SELECT 
    id,
    full_name,
    email,
    avatar_url,
    created_at
FROM profiles 
WHERE id = '8c01919c-2967-4273-80fe-648b05bbc5fe';

-- ============================================================================
-- 4. Check if messages exist for the target user
-- ============================================================================

SELECT 
    m.id,
    m.content,
    m.role,
    m.created_at,
    c.user_id as chat_owner,
    c.title as chat_title
FROM messages m
JOIN chats c ON c.id = m.chat_id
WHERE c.user_id = '8c01919c-2967-4273-80fe-648b05bbc5fe'
ORDER BY m.created_at DESC
LIMIT 5;

-- ============================================================================
-- 5. Check the match details
-- ============================================================================

SELECT 
    id,
    user_id_1,
    user_id_2,
    status,
    created_at
FROM user_matches
WHERE id = '6e999b06-438c-4755-89bf-5c47459ac059';

-- ============================================================================
-- INSTRUCTIONS
-- ============================================================================
-- 
-- Copy the results of each query and share them.
-- This will help identify:
-- 1. What RLS policies are active (might be duplicates or conflicts)
-- 2. If the profile actually exists in the database
-- 3. If messages actually exist for this user
-- 4. The match status and user IDs
--
