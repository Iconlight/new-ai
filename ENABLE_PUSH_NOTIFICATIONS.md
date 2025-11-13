# Enable Push Notifications for Networking Messages

## Quick Summary

Your edge function is ready, but it's not being triggered automatically. This guide sets up a database trigger that calls your edge function whenever a new networking message is sent.

## 🚀 Quick Setup (5 minutes)

### Step 1: Get Your Credentials

1. **Project Reference ID:**
   - Go to: [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → Settings → General
   - Copy the "Reference ID" (looks like: `abcdefghijklmnop`)

2. **Service Role Key:**
   - Go to: Settings → API
   - Find "service_role" and click **"Reveal"**
   - Copy the entire key (starts with `eyJhbGciOiJIUzI1NiI...`)

### Step 2: Run the Setup Script

1. Open Supabase Dashboard → SQL Editor
2. Open the file: `src/database/migrations/QUICK_SETUP_NOTIFICATIONS.sql`
3. **Update lines 18-19** with your actual values:
   ```sql
   v_project_ref TEXT := 'abcdefghijklmnop';  -- Your project ref
   v_service_role_key TEXT := 'eyJhbGciOiJIUzI1NiI...';  -- Your service role key
   ```
4. Click **"Run"**
5. You should see: `✅ Push notifications are now configured!`

### Step 3: Test It

1. Open your app on two devices (or use two accounts)
2. Send a networking message from Device A to Device B
3. Device B should receive a push notification immediately! 🎉

## 📋 What This Does

The setup creates:

1. **Database Trigger** - Automatically fires when a new message is inserted
2. **Trigger Function** - Calls your edge function with message details
3. **Configuration Table** - Stores your edge function URL and credentials securely

### Flow Diagram

```
User sends message
    ↓
Insert into networking_messages table
    ↓
Trigger: on_networking_message_created (automatic)
    ↓
Function: trigger_networking_message_notification()
    ↓
Reads config from notification_config table
    ↓
Calls edge function via pg_net.http_post()
    ↓
Edge function: send-message-notification
    ↓
Checks user preferences & push tokens
    ↓
Sends to Expo Push API
    ↓
📱 Push notification delivered!
```

## 🧪 Testing & Verification

### Quick Test

Run this in SQL Editor:

```sql
-- Check if everything is configured
SELECT 
  key,
  CASE 
    WHEN key = 'service_role_key' THEN '✅ CONFIGURED'
    WHEN value LIKE '%YOUR-%' THEN '❌ NOT SET'
    ELSE '✅ ' || value
  END as status
FROM notification_config;
```

### Full Test Suite

Run the comprehensive test script:

```bash
# File: src/database/migrations/test_notification_system.sql
```

This checks:
- ✅ Trigger is active
- ✅ Configuration is complete
- ✅ pg_net extension is enabled
- ✅ Recent notification requests
- ✅ User push tokens exist

## 🔍 Monitoring

### Check Recent Notifications

```sql
-- See last 10 notification attempts
SELECT 
  created_at,
  status,
  LEFT(body::text, 100) as message_preview
FROM extensions.http_request_queue
WHERE url LIKE '%send-message-notification%'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Success Rate

```sql
-- Notification success rate (last 24 hours)
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'SUCCESS') as successful,
  COUNT(*) FILTER (WHERE status = 'ERROR') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'SUCCESS') / COUNT(*), 1) as success_rate_percent
FROM extensions.http_request_queue
WHERE url LIKE '%send-message-notification%'
  AND created_at > NOW() - INTERVAL '24 hours';
```

## 🐛 Troubleshooting

### Problem: No notifications received

**Check 1: Is the trigger active?**
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_networking_message_created';
```
- If empty: Re-run QUICK_SETUP_NOTIFICATIONS.sql

**Check 2: Is configuration set?**
```sql
SELECT * FROM notification_config;
```
- If values contain "YOUR-": Update the configuration values

**Check 3: Are notifications being sent?**
```sql
SELECT * FROM extensions.http_request_queue 
WHERE url LIKE '%send-message-notification%'
ORDER BY created_at DESC LIMIT 5;
```
- If empty: Trigger is not firing
- If status = 'ERROR': Check edge function logs

**Check 4: Does user have push tokens?**
```sql
SELECT * FROM user_push_tokens 
WHERE user_id = 'RECIPIENT-USER-ID' 
  AND is_active = true;
```
- If empty: User needs to open app and grant notification permission

### Problem: Notifications delayed

- **Normal delay:** 1-5 seconds (pg_net processes async)
- **Long delay (>30s):** Check pg_net queue backlog
- **Solution:** pg_net processes requests in order, wait for queue to clear

### Problem: Edge function errors

Check edge function logs:
```bash
supabase functions logs send-message-notification --tail
```

Common errors:
- `Conversation not found` - Invalid conversation ID
- `No active tokens` - User has no registered devices
- `Notifications disabled` - User disabled notifications in preferences
- `Invalid token` - Push token is malformed or expired

## 📱 Client-Side Requirements

Make sure your app:

1. **Registers push tokens** when user logs in
   - File: `src/contexts/NotificationContext.tsx`
   - Saves to `user_push_tokens` table

2. **Requests notification permissions**
   - Should happen on first app open
   - iOS: Shows system permission dialog
   - Android: Usually granted by default

3. **Handles notification taps**
   - Deep links to conversation: `proactiveai://networking/chat/{conversationId}`

## 🔐 Security

- ✅ Service role key stored securely in database
- ✅ Only service_role can read notification_config
- ✅ Trigger runs with elevated privileges (SECURITY DEFINER)
- ✅ Edge function validates all requests
- ✅ User preferences respected (notification_enabled)

## 📚 Files Created

1. **QUICK_SETUP_NOTIFICATIONS.sql** - One-click setup script
2. **test_notification_system.sql** - Comprehensive testing
3. **PUSH_NOTIFICATION_SETUP.md** - Detailed documentation
4. **setup_message_notifications_webhook.sql** - Manual setup (alternative)
5. **improved_notification_trigger.sql** - Updated trigger function

## 🎯 Next Steps

After setup:

1. ✅ Test with real devices
2. ✅ Monitor success rate for first week
3. ✅ Check edge function logs for errors
4. ✅ Verify notification content and formatting
5. ✅ Test deep linking (tap notification → opens chat)

## 💡 Tips

- **Test in development first** before deploying to production
- **Monitor the queue** during high traffic periods
- **Set up alerts** for failed notifications (>10% failure rate)
- **Keep push tokens fresh** by updating `last_used_at` regularly
- **Clean up old tokens** periodically (inactive for >30 days)

## 🆘 Need Help?

If you're still having issues:

1. Run `test_notification_system.sql` and share the output
2. Check edge function logs for errors
3. Verify your edge function is deployed: `supabase functions list`
4. Make sure pg_net extension is enabled
5. Check that user has notification_enabled = true in user_preferences

---

**Status:** Ready to deploy! 🚀

Once you run the setup script, notifications will work automatically for all new messages.
