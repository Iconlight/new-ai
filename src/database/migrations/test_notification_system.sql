-- Test Script for Push Notification System
-- This helps verify that notifications are working correctly

-- ============================================
-- PART 1: Pre-flight Checks
-- ============================================

-- Check 1: Verify trigger exists
SELECT 
  '✓ Trigger Status' as check_name,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ ACTIVE'
    ELSE '❌ NOT FOUND'
  END as status
FROM information_schema.triggers 
WHERE trigger_name = 'on_networking_message_created'
  AND event_object_table = 'networking_messages';

-- Check 2: Verify configuration
SELECT 
  '✓ Configuration' as check_name,
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ ALL SET'
    ELSE '❌ INCOMPLETE (' || COUNT(*) || '/3)'
  END as status
FROM notification_config
WHERE key IN ('supabase_url', 'edge_function_url', 'service_role_key')
  AND value NOT LIKE '%YOUR-%';

-- Check 3: Verify pg_net extension
SELECT 
  '✓ pg_net Extension' as check_name,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ ENABLED'
    ELSE '❌ NOT ENABLED'
  END as status
FROM pg_extension 
WHERE extname = 'pg_net';

-- Check 4: Show configuration details (masked)
SELECT 
  '✓ Config Details' as check_name,
  jsonb_object_agg(
    key,
    CASE 
      WHEN key = 'service_role_key' THEN '***HIDDEN***'
      ELSE value
    END
  ) as config
FROM notification_config;

-- ============================================
-- PART 2: Test Message Insert
-- ============================================

-- Instructions:
-- 1. Replace the values below with real IDs from your database
-- 2. Uncomment and run the INSERT statement
-- 3. Check the results below

/*
-- Get a real conversation ID and user IDs first:
SELECT 
  nc.id as conversation_id,
  nc.user_id_1,
  nc.user_id_2
FROM networking_conversations nc
LIMIT 1;

-- Then insert a test message (UNCOMMENT AND UPDATE VALUES):
INSERT INTO networking_messages (
  conversation_id,
  sender_id,
  content,
  message_type
) VALUES (
  'PASTE-CONVERSATION-ID-HERE',  -- From query above
  'PASTE-SENDER-ID-HERE',         -- Use user_id_1 or user_id_2
  'Test notification - ' || NOW()::text,
  'text'
) RETURNING id, conversation_id, sender_id, created_at;
*/

-- ============================================
-- PART 3: Verify Notification Was Sent
-- ============================================

-- Check recent HTTP requests (pg_net queue)
SELECT 
  '✓ Recent Requests' as check_name,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status = 'SUCCESS') as successful,
  COUNT(*) FILTER (WHERE status = 'ERROR') as failed,
  COUNT(*) FILTER (WHERE status = 'PENDING') as pending
FROM extensions.http_request_queue
WHERE url LIKE '%send-message-notification%'
  AND created_at > NOW() - INTERVAL '1 hour';

-- Show last 5 notification requests with details
SELECT 
  id,
  created_at,
  status,
  LEFT(body::text, 100) as payload_preview,
  response_status,
  LEFT(response_body::text, 200) as response_preview
FROM extensions.http_request_queue
WHERE url LIKE '%send-message-notification%'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- PART 4: Check User Push Tokens
-- ============================================

-- Verify recipient has active push tokens
-- (Replace USER-ID with the recipient's ID)
/*
SELECT 
  user_id,
  push_token,
  device_type,
  is_active,
  created_at,
  last_used_at
FROM user_push_tokens
WHERE user_id = 'PASTE-RECIPIENT-USER-ID-HERE'
  AND is_active = true;
*/

-- Count active tokens per user
SELECT 
  '✓ Active Push Tokens' as check_name,
  COUNT(DISTINCT user_id) as users_with_tokens,
  COUNT(*) as total_active_tokens
FROM user_push_tokens
WHERE is_active = true;

-- ============================================
-- PART 5: Recent Messages Check
-- ============================================

-- Show recent messages that should have triggered notifications
SELECT 
  nm.id,
  nm.created_at,
  nm.conversation_id,
  nm.sender_id,
  LEFT(nm.content, 50) as content_preview,
  nm.message_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM extensions.http_request_queue hrq
      WHERE hrq.body::jsonb->>'conversationId' = nm.conversation_id::text
        AND hrq.created_at >= nm.created_at
        AND hrq.created_at <= nm.created_at + INTERVAL '10 seconds'
    ) THEN '✅ Notification Sent'
    ELSE '❌ No Notification'
  END as notification_status
FROM networking_messages nm
WHERE nm.message_type = 'text'
  AND nm.created_at > NOW() - INTERVAL '1 hour'
ORDER BY nm.created_at DESC
LIMIT 10;

-- ============================================
-- PART 6: Diagnostic Information
-- ============================================

-- Check for any errors in recent messages
SELECT 
  '✓ Recent Errors' as check_name,
  COUNT(*) as error_count
FROM extensions.http_request_queue
WHERE url LIKE '%send-message-notification%'
  AND status = 'ERROR'
  AND created_at > NOW() - INTERVAL '24 hours';

-- Show error details if any
SELECT 
  created_at,
  LEFT(body::text, 100) as request_payload,
  response_status,
  response_body
FROM extensions.http_request_queue
WHERE url LIKE '%send-message-notification%'
  AND status = 'ERROR'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- SUMMARY
-- ============================================

SELECT 
  '=== NOTIFICATION SYSTEM STATUS ===' as summary,
  jsonb_build_object(
    'trigger_active', EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'on_networking_message_created'
    ),
    'config_complete', (
      SELECT COUNT(*) = 3 
      FROM notification_config 
      WHERE value NOT LIKE '%YOUR-%'
    ),
    'pg_net_enabled', EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
    ),
    'recent_requests_1h', (
      SELECT COUNT(*) 
      FROM extensions.http_request_queue 
      WHERE url LIKE '%send-message-notification%'
        AND created_at > NOW() - INTERVAL '1 hour'
    ),
    'active_push_tokens', (
      SELECT COUNT(*) 
      FROM user_push_tokens 
      WHERE is_active = true
    )
  ) as status_details;

-- ============================================
-- TROUBLESHOOTING TIPS
-- ============================================

/*
If notifications are not working:

1. ❌ Trigger not found:
   - Run: setup_message_notifications_webhook.sql
   
2. ❌ Configuration incomplete:
   - Run: setup_notification_config.sql with your actual values
   
3. ❌ pg_net not enabled:
   - Run: CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
   
4. ❌ No recent requests:
   - Insert a test message (see PART 2)
   - Check if trigger is firing
   
5. ❌ Requests failing:
   - Check edge function logs: supabase functions logs send-message-notification
   - Verify service_role_key is correct
   - Verify edge function URL is correct
   
6. ❌ No active push tokens:
   - User needs to open the app and grant notification permissions
   - Check NotificationContext.tsx is registering tokens
   
7. ✅ Everything looks good but no notification:
   - Check user's notification preferences (notification_enabled)
   - Verify push token is valid Expo token
   - Check Expo push notification dashboard for errors
*/
