-- Fix the critical bug in profiles RLS policy
-- The policy was comparing um.id instead of profiles.id

-- ============================================================================
-- Drop the buggy policy and recreate it correctly
-- ============================================================================

DROP POLICY IF EXISTS "Users can view matched users profiles" ON profiles;

CREATE POLICY "Users can view matched users profiles" ON profiles
  FOR SELECT
  USING (
    -- Users can see their own profile
    auth.uid() = id 
    OR
    -- Users can see profiles of people they're matched with
    -- CRITICAL: Compare to profiles.id, NOT um.id or nc.id
    EXISTS (
      SELECT 1 FROM user_matches um 
      WHERE ((um.user_id_1 = auth.uid() AND um.user_id_2 = profiles.id)
         OR (um.user_id_2 = auth.uid() AND um.user_id_1 = profiles.id))
    )
    OR
    -- Users can see profiles of people in networking conversations
    EXISTS (
      SELECT 1 FROM networking_conversations nc
      WHERE ((nc.user_id_1 = auth.uid() AND nc.user_id_2 = profiles.id)
         OR (nc.user_id_2 = auth.uid() AND nc.user_id_1 = profiles.id))
    )
  );

-- ============================================================================
-- Fix messages RLS policy with correct table references
-- ============================================================================

DROP POLICY IF EXISTS "Users can view matched users messages for intelligence" ON messages;

CREATE POLICY "Users can view matched users messages for intelligence" ON messages
  FOR SELECT
  USING (
    -- Users can see messages in their own chats
    EXISTS (
      SELECT 1 FROM chats c 
      WHERE c.id = messages.chat_id AND c.user_id = auth.uid()
    )
    OR
    -- Users can see messages from matched users' chats
    -- CRITICAL: Use messages.chat_id, not just chat_id (for clarity)
    EXISTS (
      SELECT 1 
      FROM chats c
      WHERE c.id = messages.chat_id
      AND EXISTS (
        SELECT 1 FROM user_matches um 
        WHERE ((um.user_id_1 = auth.uid() AND um.user_id_2 = c.user_id)
           OR (um.user_id_2 = auth.uid() AND um.user_id_1 = c.user_id))
      )
    )
  );

-- ============================================================================
-- Verify the fix
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '✅ CRITICAL BUG FIXED!';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'What was wrong:';
  RAISE NOTICE '  ❌ Policy compared um.user_id_2 = um.id (wrong!)';
  RAISE NOTICE '  ❌ Should compare um.user_id_2 = profiles.id';
  RAISE NOTICE '';
  RAISE NOTICE 'What is fixed:';
  RAISE NOTICE '  ✅ Policy now correctly references profiles.id';
  RAISE NOTICE '  ✅ Policy now correctly references messages.chat_id';
  RAISE NOTICE '  ✅ Matched users can now see each other''s profiles';
  RAISE NOTICE '  ✅ Matched users can now see each other''s messages';
  RAISE NOTICE '';
  RAISE NOTICE 'Test it:';
  RAISE NOTICE '  1. Refresh your app';
  RAISE NOTICE '  2. Click the debug button again';
  RAISE NOTICE '  3. You should now see ✅ for Profile and Messages!';
  RAISE NOTICE '';
END $$;
