-- ============================================
-- QUICK SETUP: Push Notifications for Networking Messages
-- ============================================
-- This script sets up automatic push notifications in one go
-- 
-- BEFORE RUNNING:
-- 1. Get your Supabase Project Reference ID from Dashboard → Settings → General
-- 2. Get your Service Role Key from Dashboard → Settings → API
-- 3. Replace the placeholders below (lines 20-22)
-- ============================================

-- ============================================
-- CONFIGURATION - UPDATE THESE VALUES!
-- ============================================

-- Replace with your actual values:
DO $$
DECLARE
  v_project_ref TEXT := 'xqwnwuydzkrxwxxsraxm';  -- e.g., 'abcdefghijklmnop'
  v_service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxd253dXlkemtyeHd4eHNyYXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNDI3NCwiZXhwIjoyMDczNDkwMjc0fQ.fi_szerYqcdolz70eYvzEtt0Ft2nbQIbXBfFY6OQyd4';  -- Starts with 'eyJhbGciOiJIUzI1NiI...'
BEGIN
  -- Validate that values were updated
  IF v_project_ref = 'YOUR-PROJECT-REF' OR v_service_role_key = 'YOUR-SERVICE-ROLE-KEY' THEN
    RAISE EXCEPTION 'Please update the configuration values at the top of this script!';
  END IF;
END $$;

-- ============================================
-- STEP 1: Enable Required Extensions
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================
-- STEP 2: Create Configuration Table
-- ============================================

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
DROP POLICY IF EXISTS "Service role only" ON notification_config;
CREATE POLICY "Service role only" ON notification_config
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- STEP 3: Insert Configuration
-- ============================================

-- Insert configuration (will be updated below with actual values)
INSERT INTO notification_config (key, value, description)
VALUES 
  ('supabase_url', 'https://YOUR-PROJECT-REF.supabase.co', 'Your Supabase project URL'),
  ('edge_function_url', 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-message-notification', 'Full edge function URL'),
  ('service_role_key', 'YOUR-SERVICE-ROLE-KEY', 'Service role key for authentication')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Update with actual values from the variables above
DO $$
DECLARE
  v_project_ref TEXT := 'xqwnwuydzkrxwxxsraxm';  -- MUST MATCH LINE 19
  v_service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxd253dXlkemtyeHd4eHNyYXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNDI3NCwiZXhwIjoyMDczNDkwMjc0fQ.fi_szerYqcdolz70eYvzEtt0Ft2nbQIbXBfFY6OQyd4';  -- MUST MATCH LINE 20
BEGIN
  UPDATE notification_config 
  SET value = 'https://' || v_project_ref || '.supabase.co',
      updated_at = NOW()
  WHERE key = 'supabase_url';

  UPDATE notification_config 
  SET value = 'https://' || v_project_ref || '.supabase.co/functions/v1/send-message-notification',
      updated_at = NOW()
  WHERE key = 'edge_function_url';

  UPDATE notification_config 
  SET value = v_service_role_key,
      updated_at = NOW()
  WHERE key = 'service_role_key';
END $$;

-- ============================================
-- STEP 4: Create Trigger Function
-- ============================================

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

  -- Read configuration from the notification_config table
  SELECT value INTO function_url
  FROM notification_config
  WHERE key = 'edge_function_url'
  LIMIT 1;

  SELECT value INTO service_role_key
  FROM notification_config
  WHERE key = 'service_role_key'
  LIMIT 1;

  -- Check if configuration is set
  IF function_url IS NULL OR function_url LIKE '%YOUR-PROJECT-REF%' THEN
    RAISE NOTICE 'Notification not configured. Please update notification_config table.';
    RETURN NEW;
  END IF;

  IF service_role_key IS NULL OR service_role_key LIKE '%YOUR-SERVICE-ROLE-KEY%' THEN
    RAISE NOTICE 'Service role key not configured. Please update notification_config table.';
    RETURN NEW;
  END IF;

  -- Make async HTTP request to edge function using pg_net
  BEGIN
    SELECT extensions.http_post(
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
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to send notification request: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the message insert
    RAISE WARNING 'Error in notification trigger for message %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- ============================================
-- STEP 5: Create Trigger
-- ============================================

DROP TRIGGER IF EXISTS on_networking_message_created ON networking_messages;

CREATE TRIGGER on_networking_message_created
  AFTER INSERT ON networking_messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_networking_message_notification();

-- ============================================
-- STEP 6: Grant Permissions
-- ============================================

GRANT EXECUTE ON FUNCTION trigger_networking_message_notification() TO postgres, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- ============================================
-- STEP 7: Verify Setup
-- ============================================

-- Show configuration status
SELECT 
  '=== SETUP VERIFICATION ===' as status,
  jsonb_build_object(
    'pg_net_enabled', EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net'),
    'trigger_created', EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'on_networking_message_created'
    ),
    'config_table_exists', EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'notification_config'
    ),
    'config_values_set', (
      SELECT COUNT(*) = 3 
      FROM notification_config 
      WHERE value NOT LIKE '%YOUR-%'
    )
  ) as checks;

-- Show configuration (masked)
SELECT 
  key,
  CASE 
    WHEN key = 'service_role_key' THEN 
      CASE 
        WHEN value LIKE '%YOUR-SERVICE-ROLE-KEY%' THEN '❌ NOT CONFIGURED'
        ELSE '✅ CONFIGURED (hidden)'
      END
    WHEN value LIKE '%YOUR-PROJECT-REF%' THEN '❌ NOT CONFIGURED'
    ELSE '✅ ' || value
  END as status,
  description
FROM notification_config
ORDER BY key;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM notification_config WHERE value NOT LIKE '%YOUR-%') = 3 THEN
    RAISE NOTICE '✅ Push notifications are now configured!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Send a test message through the app';
    RAISE NOTICE '2. Check if notification arrives on recipient device';
    RAISE NOTICE '3. Run test_notification_system.sql to verify';
  ELSE
    RAISE WARNING '⚠️  Configuration incomplete! Please update the values at the top of this script.';
  END IF;
END $$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE notification_config IS 'Configuration for push notification edge function';
COMMENT ON TRIGGER on_networking_message_created ON networking_messages IS 'Automatically sends push notifications when new messages are created';
COMMENT ON FUNCTION trigger_networking_message_notification() IS 'Calls edge function to send push notifications for new networking messages';
