-- Configuration script for Edge Function
-- Run this AFTER running add_message_notification_trigger.sql

-- Step 1: Replace YOUR-PROJECT-REF with your actual Supabase project reference
-- Find it in: Supabase Dashboard → Project Settings → General → Reference ID

-- Step 2: Replace YOUR-SERVICE-ROLE-KEY with your actual service role key
-- Find it in: Supabase Dashboard → Project Settings → API → service_role (click "Reveal" to see it)

-- Step 3: Run this entire script in the SQL Editor

INSERT INTO edge_function_config (function_name, function_url, service_role_key)
VALUES (
  'send-message-notification',
  'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-message-notification',
  'YOUR-SERVICE-ROLE-KEY'
)
ON CONFLICT (function_name) DO UPDATE
SET function_url = EXCLUDED.function_url,
    service_role_key = EXCLUDED.service_role_key,
    updated_at = NOW();

-- Verify the configuration was saved
SELECT function_name, function_url, created_at, updated_at 
FROM edge_function_config 
WHERE function_name = 'send-message-notification';

-- Note: The service_role_key is not shown in the SELECT for security reasons
