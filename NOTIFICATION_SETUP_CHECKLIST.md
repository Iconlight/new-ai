# Push Notification Setup Checklist ✅

## Prerequisites (Already Done ✅)

- [x] Edge function `send-message-notification` exists and is deployed
- [x] `user_push_tokens` table exists
- [x] `networking_messages` table exists
- [x] App registers push tokens on login

## Setup Steps (Do These Now 👇)

### 1. Get Credentials

- [ ] Get Project Reference ID from Supabase Dashboard
  - Location: Dashboard → Settings → General → Reference ID
  - Example: `abcdefghijklmnop`
  
- [ ] Get Service Role Key from Supabase Dashboard
  - Location: Dashboard → Settings → API → service_role (click "Reveal")
  - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 2. Run Setup Script

- [ ] Open `src/database/migrations/QUICK_SETUP_NOTIFICATIONS.sql`
- [ ] Update line 18 with your Project Reference ID
- [ ] Update line 19 with your Service Role Key
- [ ] Copy the entire script
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Paste and click "Run"
- [ ] Verify you see: `✅ Push notifications are now configured!`

### 3. Verify Setup

- [ ] Run verification query:
  ```sql
  SELECT key, 
    CASE 
      WHEN value LIKE '%YOUR-%' THEN '❌ NOT SET'
      ELSE '✅ CONFIGURED'
    END as status
  FROM notification_config;
  ```
- [ ] All three rows should show `✅ CONFIGURED`

### 4. Test Notifications

- [ ] Open app on Device A (or Account A)
- [ ] Open app on Device B (or Account B)
- [ ] Send networking message from A to B
- [ ] Verify B receives push notification within 5 seconds
- [ ] Tap notification and verify it opens the correct chat

### 5. Monitor (First 24 Hours)

- [ ] Check notification success rate:
  ```sql
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') as successful,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'SUCCESS') / COUNT(*), 1) as success_rate
  FROM extensions.http_request_queue
  WHERE url LIKE '%send-message-notification%'
    AND created_at > NOW() - INTERVAL '24 hours';
  ```
- [ ] Success rate should be >90%

## Troubleshooting Checklist

If notifications don't work, check these:

### Database Issues

- [ ] Trigger exists:
  ```sql
  SELECT trigger_name FROM information_schema.triggers 
  WHERE trigger_name = 'on_networking_message_created';
  ```

- [ ] pg_net extension enabled:
  ```sql
  SELECT * FROM pg_extension WHERE extname = 'pg_net';
  ```

- [ ] Configuration is complete:
  ```sql
  SELECT COUNT(*) FROM notification_config WHERE value NOT LIKE '%YOUR-%';
  -- Should return 3
  ```

### Edge Function Issues

- [ ] Edge function is deployed:
  ```bash
  supabase functions list
  # Should show: send-message-notification
  ```

- [ ] Check edge function logs:
  ```bash
  supabase functions logs send-message-notification --tail
  ```

### User Issues

- [ ] User has active push tokens:
  ```sql
  SELECT * FROM user_push_tokens 
  WHERE user_id = 'USER-ID' AND is_active = true;
  ```

- [ ] User has notifications enabled:
  ```sql
  SELECT notification_enabled FROM user_preferences 
  WHERE user_id = 'USER-ID';
  ```

### App Issues

- [ ] App has notification permissions granted
- [ ] App is registering push tokens correctly
- [ ] Push tokens are valid Expo tokens (start with `ExponentPushToken[` or `ExpoPushToken[`)

## Quick Reference

### Check Last 5 Notifications
```sql
SELECT created_at, status, LEFT(body::text, 50) as preview
FROM extensions.http_request_queue
WHERE url LIKE '%send-message-notification%'
ORDER BY created_at DESC LIMIT 5;
```

### Check Notification Queue
```sql
SELECT COUNT(*), status 
FROM extensions.http_request_queue
WHERE url LIKE '%send-message-notification%'
GROUP BY status;
```

### Disable Notifications Temporarily
```sql
ALTER TABLE networking_messages DISABLE TRIGGER on_networking_message_created;
```

### Re-enable Notifications
```sql
ALTER TABLE networking_messages ENABLE TRIGGER on_networking_message_created;
```

## Success Criteria ✅

You'll know it's working when:

1. ✅ Setup script runs without errors
2. ✅ Configuration shows all values as `✅ CONFIGURED`
3. ✅ Test message triggers notification within 5 seconds
4. ✅ Notification appears on recipient's device
5. ✅ Tapping notification opens the correct chat
6. ✅ Success rate >90% after 24 hours

## Files to Review

- 📄 `ENABLE_PUSH_NOTIFICATIONS.md` - Main setup guide
- 📄 `QUICK_SETUP_NOTIFICATIONS.sql` - Setup script
- 📄 `test_notification_system.sql` - Testing script
- 📄 `PUSH_NOTIFICATION_SETUP.md` - Detailed documentation

## Support

If you complete all steps and notifications still don't work:

1. Run `test_notification_system.sql` and review all checks
2. Share the output with your team
3. Check edge function logs for specific errors
4. Verify push tokens are being registered correctly

---

**Estimated Time:** 5-10 minutes  
**Difficulty:** Easy (just copy-paste and update 2 values)  
**Impact:** High (instant notifications for all users!)
