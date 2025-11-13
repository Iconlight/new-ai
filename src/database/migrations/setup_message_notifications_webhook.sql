-- Migration: Setup automatic push notifications for networking messages
-- This uses Supabase's webhook functionality to trigger the edge function

-- STEP 1: Enable the required extensions
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- STEP 2: Create or replace the notification trigger function
-- This function will be called automatically when a new message is inserted
CREATE OR REPLACE FUNCTION trigger_networking_message_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  function_url text;
  service_role_key text;
BEGIN
  -- Only trigger for text messages (not system messages)
  IF NEW.message_type != 'text' THEN
    RETURN NEW;
  END IF;

  -- Get the Supabase project URL and service role key from environment
  -- These should be set in your Supabase project settings
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-message-notification';
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- If settings are not configured, try to use pg_net with hardcoded values
  -- You'll need to update these values in the next migration file
  IF function_url IS NULL OR function_url = '/functions/v1/send-message-notification' THEN
    -- Fallback: Log and return (notifications won't work until configured)
    RAISE NOTICE 'Notification settings not configured. Message ID: %', NEW.id;
    RETURN NEW;
  END IF;

  -- Make async HTTP request to edge function using pg_net
  -- This won't block the message insert
  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'conversationId', NEW.conversation_id,
      'senderId', NEW.sender_id,
      'content', NEW.content
    )
  ) INTO request_id;

  RAISE NOTICE 'Notification request sent for message %. Request ID: %', NEW.id, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the message insert
    RAISE WARNING 'Failed to send notification for message %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- STEP 3: Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_networking_message_created ON networking_messages;

-- STEP 4: Create the trigger
CREATE TRIGGER on_networking_message_created
  AFTER INSERT ON networking_messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_networking_message_notification();

-- STEP 5: Grant necessary permissions
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION trigger_networking_message_notification() TO postgres, anon, authenticated, service_role;

-- STEP 6: Create a configuration table for easier management
CREATE TABLE IF NOT EXISTS notification_config (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notification_config ENABLE ROW LEVEL SECURITY;

-- Only service role can access
CREATE POLICY "Service role only" ON notification_config
  FOR ALL
  USING (auth.role() = 'service_role');

-- Insert placeholder configuration
-- YOU MUST UPDATE THESE VALUES - See setup_notification_config.sql
INSERT INTO notification_config (key, value, description)
VALUES 
  ('supabase_url', 'https://YOUR-PROJECT-REF.supabase.co', 'Your Supabase project URL'),
  ('edge_function_url', 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-message-notification', 'Full edge function URL'),
  ('service_role_key', 'YOUR-SERVICE-ROLE-KEY-HERE', 'Service role key for authentication')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE notification_config IS 'Configuration for push notification edge function';
COMMENT ON TRIGGER on_networking_message_created ON networking_messages IS 'Automatically sends push notifications when new messages are created';
