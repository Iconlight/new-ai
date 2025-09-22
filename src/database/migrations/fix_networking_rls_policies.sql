-- Fix RLS Policies for Networking Tables
-- Run this after add_networking_tables.sql to ensure proper INSERT permissions

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can insert own conversation patterns" ON user_conversation_patterns;
DROP POLICY IF EXISTS "Users can insert own networking preferences" ON user_networking_preferences;
DROP POLICY IF EXISTS "Users can update own networking preferences (WITH CHECK)" ON user_networking_preferences;
DROP POLICY IF EXISTS "Users can insert their matches" ON user_matches;
DROP POLICY IF EXISTS "Users can create their networking conversations" ON networking_conversations;

-- User conversation patterns - Add INSERT policy
CREATE POLICY "Users can insert own conversation patterns" ON user_conversation_patterns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User networking preferences - Add INSERT and proper UPDATE policies
CREATE POLICY "Users can insert own networking preferences" ON user_networking_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own networking preferences (WITH CHECK)" ON user_networking_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User matches - Allow users to insert matches where they are user_id_1
CREATE POLICY "Users can insert their matches" ON user_matches
  FOR INSERT
  WITH CHECK (auth.uid() = user_id_1);

-- Networking conversations - Allow creation by matched users
CREATE POLICY "Users can create their networking conversations" ON networking_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Additional helpful policies for better UX

-- Allow users to see other users' conversation patterns for matching (limited info)
CREATE POLICY "Users can view patterns for matching" ON user_conversation_patterns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_networking_preferences unp 
      WHERE unp.user_id = auth.uid() 
      AND unp.is_networking_enabled = true
    )
  );

-- Allow system/service to insert networking activity
CREATE POLICY "System can log all networking activity" ON networking_activity
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for better performance on common queries
CREATE INDEX IF NOT EXISTS idx_user_networking_preferences_enabled 
  ON user_networking_preferences(user_id) 
  WHERE is_networking_enabled = true;

CREATE INDEX IF NOT EXISTS idx_user_matches_pending 
  ON user_matches(user_id_1, created_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_user_matches_compatibility 
  ON user_matches(compatibility_score DESC, created_at DESC);

-- Function to automatically clean up expired matches
CREATE OR REPLACE FUNCTION cleanup_expired_matches()
RETURNS void AS $$
BEGIN
  UPDATE user_matches 
  SET status = 'expired' 
  WHERE status = 'pending' 
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_expired_matches() TO authenticated;

-- Create a function to get user's networking status
CREATE OR REPLACE FUNCTION get_user_networking_status(target_user_id UUID)
RETURNS TABLE(
  is_enabled BOOLEAN,
  visibility_level TEXT,
  max_matches_per_day INTEGER,
  minimum_compatibility_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(unp.is_networking_enabled, false) as is_enabled,
    COALESCE(unp.visibility_level, 'private') as visibility_level,
    COALESCE(unp.max_matches_per_day, 5) as max_matches_per_day,
    COALESCE(unp.minimum_compatibility_score, 60) as minimum_compatibility_score
  FROM user_networking_preferences unp
  WHERE unp.user_id = target_user_id;
  
  -- If no preferences exist, return defaults
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'private'::TEXT, 5, 60;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_networking_status(UUID) TO authenticated;

-- Add a trigger to automatically update conversation patterns timestamp
CREATE OR REPLACE FUNCTION update_conversation_pattern_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_analyzed = NOW();
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_pattern_timestamp_trigger
  BEFORE UPDATE ON user_conversation_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_pattern_timestamp();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Networking RLS policies and helper functions created successfully!';
  RAISE NOTICE 'You can now use the networking feature without INSERT permission errors.';
END $$;
