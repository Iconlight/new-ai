-- RPC function to fetch a user's recent chats for networking intelligence
-- This bypasses RLS since it's a security definer function
-- Only works if the target user has opted into intelligence analysis

CREATE OR REPLACE FUNCTION get_user_chats_for_intelligence(target_user_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  updated_at TIMESTAMPTZ
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user allows intelligence analysis (default to true if no preference set)
  IF EXISTS (
    SELECT 1 FROM user_networking_preferences 
    WHERE user_id = target_user_id 
    AND allow_intelligence_analysis = false
  ) THEN
    -- Return empty if opted out
    RETURN;
  END IF;

  -- Return the user's 3 most recent chats
  RETURN QUERY
  SELECT c.id, c.title, c.updated_at
  FROM chats c
  WHERE c.user_id = target_user_id
  ORDER BY c.updated_at DESC
  LIMIT 3;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_user_chats_for_intelligence(UUID) TO authenticated;

-- RPC function to fetch messages from specific chats for networking intelligence
CREATE OR REPLACE FUNCTION get_chat_messages_for_intelligence(chat_ids UUID[])
RETURNS TABLE (
  content TEXT,
  created_at TIMESTAMPTZ,
  role TEXT,
  chat_id UUID
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Return messages from the provided chat IDs
  RETURN QUERY
  SELECT m.content, m.created_at, m.role, m.chat_id
  FROM messages m
  WHERE m.chat_id = ANY(chat_ids)
  ORDER BY m.created_at DESC
  LIMIT 100;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_chat_messages_for_intelligence(UUID[]) TO authenticated;
