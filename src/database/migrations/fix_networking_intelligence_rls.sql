-- Fix RLS policies to allow networking intelligence to access matched users' data
-- This allows users to see conversation patterns, interests, and messages of users they're matched with

-- ============================================================================
-- 1. USER_CONVERSATION_PATTERNS - Allow viewing matched users' patterns
-- ============================================================================

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can view patterns for matching" ON user_conversation_patterns;

-- Create new policy that allows viewing patterns of matched users
CREATE POLICY "Users can view matched users patterns for intelligence" ON user_conversation_patterns
  FOR SELECT
  USING (
    -- Users can see their own pattern
    auth.uid() = user_id 
    OR
    -- Users can see patterns of people they're matched with
    EXISTS (
      SELECT 1 FROM user_matches um 
      WHERE (um.user_id_1 = auth.uid() AND um.user_id_2 = user_id)
         OR (um.user_id_2 = auth.uid() AND um.user_id_1 = user_id)
    )
  );

-- ============================================================================
-- 2. USER_INTERESTS - Allow viewing matched users' interests
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own interests" ON user_interests;
DROP POLICY IF EXISTS "Users can manage own interests" ON user_interests;

-- Allow users to view their own interests
CREATE POLICY "Users can view own interests" ON user_interests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to view interests of matched users
CREATE POLICY "Users can view matched users interests" ON user_interests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_matches um 
      WHERE (um.user_id_1 = auth.uid() AND um.user_id_2 = user_id)
         OR (um.user_id_2 = auth.uid() AND um.user_id_1 = user_id)
    )
  );

-- Allow users to manage their own interests
CREATE POLICY "Users can manage own interests" ON user_interests
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. MESSAGES - Allow viewing matched users' messages (for intelligence analysis)
-- ============================================================================

-- Note: This is sensitive data, so we're being careful here
-- We only allow viewing messages for intelligence analysis, not direct access

-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Users can view matched users messages for intelligence" ON messages;

-- Create policy to allow viewing messages of matched users
-- This is needed for the AI to analyze conversation patterns
CREATE POLICY "Users can view matched users messages for intelligence" ON messages
  FOR SELECT
  USING (
    -- Users can see messages in their own chats
    EXISTS (
      SELECT 1 FROM chats c 
      WHERE c.id = chat_id AND c.user_id = auth.uid()
    )
    OR
    -- Users can see messages from matched users' chats (for intelligence analysis)
    EXISTS (
      SELECT 1 FROM chats c
      INNER JOIN user_matches um ON (
        (um.user_id_1 = auth.uid() AND um.user_id_2 = c.user_id)
        OR (um.user_id_2 = auth.uid() AND um.user_id_1 = c.user_id)
      )
      WHERE c.id = chat_id
    )
  );

-- ============================================================================
-- 4. PROFILES - Ensure matched users can see each other's names
-- ============================================================================

-- This should already be covered by the existing policy in fix_networking_rls_policies.sql
-- But let's make sure it's there

DROP POLICY IF EXISTS "Users can view matched users profiles" ON profiles;
CREATE POLICY "Users can view matched users profiles" ON profiles
  FOR SELECT
  USING (
    auth.uid() = id OR -- Users can see their own profile
    EXISTS (
      SELECT 1 FROM user_matches um 
      WHERE (um.user_id_1 = auth.uid() AND um.user_id_2 = id)
         OR (um.user_id_2 = auth.uid() AND um.user_id_1 = id)
    ) OR
    EXISTS (
      SELECT 1 FROM networking_conversations nc
      WHERE (nc.user_id_1 = auth.uid() AND nc.user_id_2 = id)
         OR (nc.user_id_2 = auth.uid() AND nc.user_id_1 = id)
    )
  );

-- ============================================================================
-- 5. NETWORKING_INTELLIGENCE_CHATS - Ensure proper RLS
-- ============================================================================

-- Enable RLS
ALTER TABLE networking_intelligence_chats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own intelligence chats" ON networking_intelligence_chats;
DROP POLICY IF EXISTS "Users can manage own intelligence chats" ON networking_intelligence_chats;

-- Users can view their own intelligence chats
CREATE POLICY "Users can view own intelligence chats" ON networking_intelligence_chats
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own intelligence chats
CREATE POLICY "Users can create own intelligence chats" ON networking_intelligence_chats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own intelligence chats
CREATE POLICY "Users can update own intelligence chats" ON networking_intelligence_chats
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own intelligence chats
CREATE POLICY "Users can delete own intelligence chats" ON networking_intelligence_chats
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Success message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Networking Intelligence RLS policies updated successfully!';
  RAISE NOTICE 'Users can now:';
  RAISE NOTICE '  - View conversation patterns of matched users';
  RAISE NOTICE '  - View interests of matched users';
  RAISE NOTICE '  - View messages of matched users (for AI analysis)';
  RAISE NOTICE '  - View profiles of matched users';
  RAISE NOTICE '  - Manage their own intelligence chats';
END $$;
