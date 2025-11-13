-- Configuration for Push Notifications
-- Run this AFTER setup_message_notifications_webhook.sql

-- INSTRUCTIONS:
-- 1. Get your Supabase Project Reference ID:
--    Dashboard → Project Settings → General → Reference ID
--    Example: abcdefghijklmnop
--
-- 2. Get your Service Role Key:
--    Dashboard → Project Settings → API → service_role key (click "Reveal")
--    Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
--
-- 3. Replace the placeholders below with your actual values
-- 4. Run this script in the SQL Editor

-- Update configuration with your actual values
UPDATE notification_config 
SET value = 'https://YOUR-PROJECT-REF.supabase.co',
    updated_at = NOW()
WHERE key = 'supabase_url';

UPDATE notification_config 
SET value = 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-message-notification',
    updated_at = NOW()
WHERE key = 'edge_function_url';

UPDATE notification_config 
SET value = 'YOUR-SERVICE-ROLE-KEY-HERE',
    updated_at = NOW()
WHERE key = 'service_role_key';

-- Verify configuration (service_role_key will be masked)
SELECT 
  key, 
  CASE 
    WHEN key = 'service_role_key' THEN '***HIDDEN***'
    ELSE value 
  END as value,
  description,
  updated_at
FROM notification_config
ORDER BY key;
