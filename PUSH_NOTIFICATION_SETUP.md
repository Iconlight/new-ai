# Push Notification Setup Guide

This guide will help you set up automatic push notifications for networking messages.

## Overview

When a user sends a networking message, the system will:
1. Insert the message into the database
2. Trigger a database function automatically
3. Call the Supabase Edge Function
4. Send push notifications to the recipient's devices

## Prerequisites

- ✅ Edge function `send-message-notification` is already deployed (you provided the code)
- ✅ `user_push_tokens` table exists
- ✅ `networking_messages` table exists

## Setup Steps

### Step 1: Run the Initial Migration

In Supabase SQL Editor, run this migration:

```sql
-- File: src/database/migrations/setup_message_notifications_webhook.sql
```

This creates:
- The trigger function
- The trigger on `networking_messages` table
- A `notification_config` table for configuration

### Step 2: Get Your Supabase Credentials

1. **Project Reference ID:**
   - Go to: Supabase Dashboard → Project Settings → General
   - Copy the "Reference ID" (e.g., `abcdefghijklmnop`)

2. **Service Role Key:**
   - Go to: Supabase Dashboard → Project Settings → API
   - Find "service_role" and click "Reveal"
   - Copy the entire key (starts with `eyJhbGciOiJIUzI1NiI...`)

### Step 3: Configure the Notification System

Run this SQL with your actual values:

```sql
-- Update with YOUR actual project reference
UPDATE notification_config 
SET value = 'https://YOUR-PROJECT-REF.supabase.co',
    updated_at = NOW()
WHERE key = 'supabase_url';

-- Update with YOUR actual project reference
UPDATE notification_config 
SET value = 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-message-notification',
    updated_at = NOW()
WHERE key = 'edge_function_url';

-- Update with YOUR actual service role key
UPDATE notification_config 
SET value = 'YOUR-ACTUAL-SERVICE-ROLE-KEY',
    updated_at = NOW()
WHERE key = 'service_role_key';
```

### Step 4: Verify Configuration

Run this to check if everything is configured:

```sql
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
```

You should see:
- ✅ edge_function_url: https://your-project.supabase.co/functions/v1/send-message-notification
- ✅ service_role_key: CONFIGURED
- ✅ supabase_url: https://your-project.supabase.co

### Step 5: Enable pg_net Extension

The trigger uses `pg_net` for async HTTP calls. Enable it:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

### Step 6: Test the Notification System

Use the test script to verify everything works:

```sql
-- File: src/database/migrations/test_notification_system.sql
```

## How It Works

### Automatic Flow

```
User sends message
    ↓
Insert into networking_messages
    ↓
Trigger: on_networking_message_created
    ↓
Function: trigger_networking_message_notification()
    ↓
Read config from notification_config table
    ↓
Call edge function via pg_net.http_post()
    ↓
Edge function processes:
    - Gets recipient ID
    - Checks notification preferences
    - Fetches push tokens
    - Sends to Expo Push API
    ↓
User receives push notification
```

### Message Types

The trigger only fires for `message_type = 'text'`. System messages and other types are ignored.

## Troubleshooting

### No notifications are being sent

1. **Check if trigger is active:**
```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  action_statement 
FROM information_schema.triggers 
WHERE trigger_name = 'on_networking_message_created';
```

2. **Check configuration:**
```sql
SELECT * FROM notification_config;
```

3. **Check pg_net extension:**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

4. **Check recent requests:**
```sql
SELECT * FROM extensions.http_request_queue 
ORDER BY created_at DESC 
LIMIT 10;
```

### Notifications work but are delayed

- `pg_net` processes requests asynchronously
- Normal delay: 1-5 seconds
- Check the queue: `SELECT * FROM extensions.http_request_queue;`

### Edge function errors

Check edge function logs:
```bash
supabase functions logs send-message-notification
```

Common issues:
- Invalid push tokens
- User has notifications disabled
- Expo Push API errors

## Testing

### Manual Test

1. Send a test message through the app
2. Check the logs in Supabase Dashboard → Database → Logs
3. Look for: `Notification request sent for message X`
4. Check edge function logs for processing details

### SQL Test

```sql
-- Insert a test message (replace with real IDs)
INSERT INTO networking_messages (
  conversation_id,
  sender_id,
  content,
  message_type
) VALUES (
  'YOUR-CONVERSATION-ID',
  'YOUR-USER-ID',
  'Test notification message',
  'text'
);

-- Check if notification was triggered
SELECT * FROM extensions.http_request_queue 
ORDER BY created_at DESC 
LIMIT 1;
```

## Monitoring

### Check notification success rate

```sql
-- Count messages vs notification requests
SELECT 
  DATE(created_at) as date,
  COUNT(*) as messages_sent
FROM networking_messages
WHERE message_type = 'text'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### View recent notification attempts

```sql
SELECT 
  id,
  created_at,
  status,
  url,
  LEFT(body::text, 100) as payload_preview
FROM extensions.http_request_queue
WHERE url LIKE '%send-message-notification%'
ORDER BY created_at DESC
LIMIT 20;
```

## Security Notes

- ✅ Service role key is stored securely in the database
- ✅ Only service_role can read notification_config
- ✅ Trigger runs with SECURITY DEFINER (elevated privileges)
- ✅ Edge function validates all requests
- ⚠️ Never expose service_role_key in client code

## Maintenance

### Update Edge Function URL

If you change your edge function deployment:

```sql
UPDATE notification_config 
SET value = 'https://your-project.supabase.co/functions/v1/send-message-notification',
    updated_at = NOW()
WHERE key = 'edge_function_url';
```

### Disable Notifications Temporarily

```sql
-- Disable trigger
ALTER TABLE networking_messages DISABLE TRIGGER on_networking_message_created;

-- Re-enable trigger
ALTER TABLE networking_messages ENABLE TRIGGER on_networking_message_created;
```

## Support

If notifications still don't work after following this guide:

1. Check all configuration values are correct
2. Verify edge function is deployed: `supabase functions list`
3. Check database logs for errors
4. Check edge function logs for errors
5. Verify user has valid push tokens in `user_push_tokens` table
