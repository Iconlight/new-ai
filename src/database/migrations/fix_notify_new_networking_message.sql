-- Relax filter so null message_type still sends notifications, and allow common types
CREATE OR REPLACE FUNCTION notify_new_networking_message()
RETURNS TRIGGER AS $$
DECLARE
  function_url TEXT;
  service_role_key TEXT;
  payload JSONB;
  config_record RECORD;
BEGIN
  -- Skip only when message_type is explicitly non-user content (e.g., system)
  IF NEW.message_type IS NOT NULL AND NEW.message_type NOT IN ('text', 'image', 'link') THEN
    RETURN NEW;
  END IF;

  -- Get the Edge Function configuration from the config table
  SELECT function_url, service_role_key INTO config_record
  FROM edge_function_config
  WHERE function_name = 'send-message-notification'
  LIMIT 1;

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
    'content', COALESCE(NEW.content, '')
  );

  -- Call the Edge Function asynchronously using pg_net
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
    RAISE NOTICE 'Error calling notification edge function: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
