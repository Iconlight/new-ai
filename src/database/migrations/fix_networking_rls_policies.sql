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
DROP POLICY IF EXISTS "Users can view patterns for matching" ON user_conversation_patterns;
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
DROP POLICY IF EXISTS "System can log all networking activity" ON networking_activity;
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

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure email column exists for robust name fallback
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists before creating
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Populate profiles for existing users who don't have profiles yet
INSERT INTO profiles (id, full_name, avatar_url, email)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email) as full_name,
  au.raw_user_meta_data->>'avatar_url' as avatar_url,
  au.email as email
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Backfill email for existing profiles where missing
UPDATE profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND p.email IS NULL;

-- If full_name is still null, use email prefix as display name
UPDATE profiles
SET full_name = split_part(email, '@', 1)
WHERE full_name IS NULL AND email IS NOT NULL;

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Grant basic privileges (RLS still applies)
GRANT SELECT, UPDATE ON TABLE profiles TO authenticated;

-- Allow users to see their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Allow users to see matched users' names from profiles table
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

-- Helper function to reliably fetch a matched user's profile with server-side checks
CREATE OR REPLACE FUNCTION public.get_matched_user_profile(target_user_id UUID)
RETURNS TABLE(full_name TEXT, email TEXT, avatar_url TEXT) AS $$
BEGIN
  -- Only allow if the caller is matched or in a conversation with the target
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.user_matches um
      WHERE (um.user_id_1 = auth.uid() AND um.user_id_2 = target_user_id)
         OR (um.user_id_2 = auth.uid() AND um.user_id_1 = target_user_id)
    ) OR EXISTS (
      SELECT 1 FROM public.networking_conversations nc
      WHERE (nc.user_id_1 = auth.uid() AND nc.user_id_2 = target_user_id)
         OR (nc.user_id_2 = auth.uid() AND nc.user_id_1 = target_user_id)
    )
  ) THEN
    RETURN; -- unauthorized: return zero rows
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(p.full_name, NULLIF(au.raw_user_meta_data->>'full_name',''), split_part(au.email, '@', 1))::text AS full_name,
    au.email::text AS email,
    p.avatar_url::text AS avatar_url
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE au.id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_matched_user_profile(UUID) TO authenticated;

-- Helper function to fetch the peer's profile for a given conversation id
CREATE OR REPLACE FUNCTION public.get_conversation_peer_profile(conversation_id UUID)
RETURNS TABLE(full_name TEXT, email TEXT, avatar_url TEXT) AS $$
DECLARE
  u1 UUID;
  u2 UUID;
  peer UUID;
BEGIN
  SELECT nc.user_id_1, nc.user_id_2 INTO u1, u2
  FROM public.networking_conversations nc
  WHERE nc.id = conversation_id;

  IF u1 IS NULL THEN
    RETURN; -- conversation not found
  END IF;

  -- Ensure caller is a participant
  IF auth.uid() <> u1 AND auth.uid() <> u2 THEN
    RETURN; -- not authorized
  END IF;

  peer := CASE WHEN auth.uid() = u1 THEN u2 ELSE u1 END;

  RETURN QUERY
  SELECT 
    COALESCE(p.full_name, NULLIF(au.raw_user_meta_data->>'full_name',''), split_part(au.email, '@', 1))::text AS full_name,
    au.email::text AS email,
    p.avatar_url::text AS avatar_url
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE au.id = peer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_conversation_peer_profile(UUID) TO authenticated;

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

-- Drop trigger if exists before creating
DROP TRIGGER IF EXISTS update_conversation_pattern_timestamp_trigger ON user_conversation_patterns;
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
