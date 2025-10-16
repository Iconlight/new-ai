-- Update RLS policies to fix networking intelligence access issues
-- This replaces existing policies to ensure matched users can see each other's data
-- regardless of match status (pending or accepted)

-- ============================================================================
-- 1. PROFILES - Fix profile access for matched users
-- ============================================================================

-- Drop and recreate the profiles policy
DROP POLICY IF EXISTS "Users can view matched users profiles" ON profiles;

CREATE POLICY "Users can view matched users profiles" ON profiles
  FOR SELECT
  USING (
    auth.uid() = id OR -- Users can see their own profile
    EXISTS (
      SELECT 1 FROM user_matches um 
      WHERE ((um.user_id_1 = auth.uid() AND um.user_id_2 = id)
         OR (um.user_id_2 = auth.uid() AND um.user_id_1 = id))
      -- No status filter - works for pending AND accepted matches
    ) OR
    EXISTS (
      SELECT 1 FROM networking_conversations nc
      WHERE (nc.user_id_1 = auth.uid() AND nc.user_id_2 = id)
         OR (nc.user_id_2 = auth.uid() AND nc.user_id_1 = id)
    )
  );

-- ============================================================================
-- 2. MESSAGES - Fix message access with better error handling
-- ============================================================================

-- Drop existing message policies
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can view matched users messages for intelligence" ON messages;

-- Users can view messages in their own chats
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chats c 
      WHERE c.id = messages.chat_id AND c.user_id = auth.uid()
    )
  );

-- Users can view messages from matched users' chats (for intelligence)
CREATE POLICY "Users can view matched users messages for intelligence" ON messages
  FOR SELECT
  USING (
    -- Check if user is matched with the chat owner
    EXISTS (
      SELECT 1 
      FROM chats c
      WHERE c.id = messages.chat_id
      AND EXISTS (
        SELECT 1 FROM user_matches um 
        WHERE ((um.user_id_1 = auth.uid() AND um.user_id_2 = c.user_id)
           OR (um.user_id_2 = auth.uid() AND um.user_id_1 = c.user_id))
        -- No status filter - works for ALL match statuses
      )
    )
  );

-- ============================================================================
-- 3. USER_INTERESTS - Ensure interests policy doesn't have conflicts
-- ============================================================================

DROP POLICY IF EXISTS "Users can view matched users interests" ON user_interests;

CREATE POLICY "Users can view matched users interests" ON user_interests
  FOR SELECT
  USING (
    auth.uid() = user_id OR -- Own interests
    EXISTS (
      SELECT 1 FROM user_matches um 
      WHERE ((um.user_id_1 = auth.uid() AND um.user_id_2 = user_id)
         OR (um.user_id_2 = auth.uid() AND um.user_id_1 = user_id))
    )
  );

-- ============================================================================
-- 4. USER_CONVERSATION_PATTERNS - Ensure patterns policy is correct
-- ============================================================================

DROP POLICY IF EXISTS "Users can view matched users patterns for intelligence" ON user_conversation_patterns;

CREATE POLICY "Users can view matched users patterns for intelligence" ON user_conversation_patterns
  FOR SELECT
  USING (
    auth.uid() = user_id OR -- Own pattern
    EXISTS (
      SELECT 1 FROM user_matches um 
      WHERE ((um.user_id_1 = auth.uid() AND um.user_id_2 = user_id)
         OR (um.user_id_2 = auth.uid() AND um.user_id_1 = user_id))
    )
  );

-- ============================================================================
-- 5. Test queries to verify policies work
-- ============================================================================

-- The following queries should now work when run by a matched user:
-- SELECT * FROM profiles WHERE id = '<matched_user_id>';
-- SELECT * FROM user_interests WHERE user_id = '<matched_user_id>';
-- SELECT * FROM user_conversation_patterns WHERE user_id = '<matched_user_id>';
-- SELECT m.* FROM messages m JOIN chats c ON c.id = m.chat_id WHERE c.user_id = '<matched_user_id>';

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '✅ RLS Policies Updated Successfully!';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed Issues:';
  RAISE NOTICE '  ✓ Profiles now accessible for matched users';
  RAISE NOTICE '  ✓ Messages now accessible for matched users';
  RAISE NOTICE '  ✓ Interests accessible for all match statuses';
  RAISE NOTICE '  ✓ Patterns accessible for all match statuses';
  RAISE NOTICE '';
  RAISE NOTICE 'Match Status: Works for BOTH pending and accepted matches';
  RAISE NOTICE '';
END $$;
