-- Improved Push Notification Trigger
-- This version reads configuration from the notification_config table

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create improved trigger function that reads from config table
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

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_networking_message_created ON networking_messages;

CREATE TRIGGER on_networking_message_created
  AFTER INSERT ON networking_messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_networking_message_notification();

-- Grant permissions
GRANT EXECUTE ON FUNCTION trigger_networking_message_notification() TO postgres, authenticated, service_role;

-- Show current configuration status
SELECT 
  key,
  CASE 
    WHEN key = 'service_role_key' THEN 
      CASE 
        WHEN value LIKE '%YOUR-SERVICE-ROLE-KEY%' THEN '❌ NOT CONFIGURED'
        ELSE '✅ CONFIGURED'
      END
    WHEN value LIKE '%YOUR-PROJECT-REF%' THEN '❌ NOT CONFIGURED'
    ELSE '✅ ' || value
  END as status
FROM notification_config
ORDER BY key;
