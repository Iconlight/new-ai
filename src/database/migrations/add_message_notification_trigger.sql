-- Migration: Add trigger to send push notifications for new networking messages
-- This trigger calls a Supabase Edge Function to send push notifications reliably from the backend

-- IMPORTANT: Before running this migration, you need to:
-- 1. Deploy the Edge Function: supabase functions deploy send-message-notification
-- 2. Create a secrets table to store the configuration (see below)

-- Create a table to store Edge Function configuration (if it doesn't exist)
CREATE TABLE IF NOT EXISTS edge_function_config (
  id SERIAL PRIMARY KEY,
  function_name TEXT UNIQUE NOT NULL,
  function_url TEXT NOT NULL,
  service_role_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on the config table (only service role can access)
ALTER TABLE edge_function_config ENABLE ROW LEVEL SECURITY;

-- Create policy: Only service role can read/write (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'edge_function_config'
      AND policyname = 'Service role only'
  ) THEN
    CREATE POLICY "Service role only" ON edge_function_config
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END
$$;

-- Insert the configuration (you'll need to update this with your actual values)
-- Run this separately after the migration with your actual project ref and service role key:
-- INSERT INTO edge_function_config (function_name, function_url, service_role_key)
-- VALUES (
--   'send-message-notification',
--   'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-message-notification',
--   'YOUR-SERVICE-ROLE-KEY'
-- )
-- ON CONFLICT (function_name) DO UPDATE
-- SET function_url = EXCLUDED.function_url,
--     service_role_key = EXCLUDED.service_role_key,
--     updated_at = NOW();

INSERT INTO edge_function_config (function_name, function_url, service_role_key)
VALUES (
  'send-message-notification',
  'https://xqwnwuydzkrxwxxsraxm.supabase.co/functions/v1/send-message-notification',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxd253dXlkemtyeHd4eHNyYXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNDI3NCwiZXhwIjoyMDczNDkwMjc0fQ.fi_szerYqcdolz70eYvzEtt0Ft2nbQIbXBfFY6OQyd4'
)
ON CONFLICT (function_name) DO UPDATE
SET function_url = EXCLUDED.function_url,
    service_role_key = EXCLUDED.service_role_key,
    updated_at = NOW();

-- Create a function that calls the Edge Function via pg_net (Supabase's HTTP extension)
CREATE OR REPLACE FUNCTION notify_new_networking_message()
RETURNS TRIGGER AS $$
DECLARE
  function_url TEXT;
  service_role_key TEXT;
  payload JSONB;
  config_record RECORD;
BEGIN
  -- Only send notifications for regular text messages (not system/starter messages)
  IF NEW.message_type NOT IN ('text') THEN
    RETURN NEW;
  END IF;

  -- Get the Edge Function configuration from the config table
  SELECT function_url, service_role_key INTO config_record
  FROM edge_function_config
  WHERE function_name = 'send-message-notification'
  LIMIT 1;

  -- If configuration not found, skip notification (fail silently)
  IF NOT FOUND THEN
    RAISE NOTICE 'Edge function configuration not found, skipping notification';
    RETURN NEW;
  END IF;

  function_url := config_record.function_url;
  service_role_key := config_record.service_role_key;

  -- Build the payload
  payload := jsonb_build_object(
    'conversationId', NEW.conversation_id,
    'senderId', NEW.sender_id,
    'content', NEW.content
  );

  -- Call the Edge Function asynchronously using pg_net
  -- This requires the pg_net extension to be enabled
  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := payload
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE NOTICE 'Error calling notification edge function: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on networking_messages table
DROP TRIGGER IF EXISTS trigger_notify_new_networking_message ON networking_messages;

CREATE TRIGGER trigger_notify_new_networking_message
  AFTER INSERT ON networking_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_networking_message();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_new_networking_message() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_new_networking_message() TO service_role;
