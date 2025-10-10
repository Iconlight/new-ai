# Push Notifications Setup Guide

This guide explains how to set up server-side push notifications for networking messages using Supabase Edge Functions.

## Architecture

The push notification system uses:
1. **Supabase Edge Function** (`send-message-notification`) - Sends push notifications via Expo Push API
2. **Postgres Trigger** - Automatically calls the Edge Function when a new message is inserted
3. **pg_net Extension** - Enables HTTP calls from Postgres to Edge Functions

## Benefits of Server-Side Push

- ✅ **Reliability**: Notifications are sent even if sender's app is closed or on web
- ✅ **Consistency**: Single source of truth for notification logic
- ✅ **Security**: Service role key never exposed to client
- ✅ **Scalability**: Handles high message volume efficiently

## Setup Steps

### 1. Enable pg_net Extension

In your Supabase dashboard:
1. Go to **Database** → **Extensions**
2. Search for `pg_net`
3. Click **Enable** for the `pg_net` extension

### 2. Deploy the Edge Function

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Login to Supabase
supabase login

# Link your project (replace with your project ref)
supabase link --project-ref <your-project-ref>

# Deploy the Edge Function
supabase functions deploy send-message-notification
```

### 3. Configure Environment Variables

The Edge Function needs access to your Supabase URL and Service Role Key. These are automatically available in Edge Functions as:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

No additional configuration needed for the Edge Function itself.

### 4. Configure Database Settings

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Replace <your-project-ref> with your actual Supabase project reference
ALTER DATABASE postgres SET app.settings.edge_function_url = 
  'https://<your-project-ref>.supabase.co/functions/v1/send-message-notification';

-- Replace <your-service-role-key> with your actual service role key
-- Find this in: Project Settings → API → service_role key
ALTER DATABASE postgres SET app.settings.service_role_key = 
  '<your-service-role-key>';
```

**Important**: Keep your service role key secure. It has full admin access to your database.

### 5. Run the Database Migration

Apply the trigger migration:

```sql
-- Run the contents of: src/database/migrations/add_message_notification_trigger.sql
-- This creates the trigger function and attaches it to networking_messages table
```

Or use the Supabase CLI:

```bash
supabase db push
```

## How It Works

### Message Flow

1. User sends a message → `networking_messages` table INSERT
2. Postgres trigger fires → `notify_new_networking_message()` function executes
3. Function calls Edge Function via `pg_net.http_post()`
4. Edge Function:
   - Fetches recipient's push tokens from `user_push_tokens`
   - Checks notification preferences
   - Sends push via Expo Push API
   - Returns success/failure status

### Notification Data Structure

The Edge Function sends notifications with:
```json
{
  "to": "ExponentPushToken[...]",
  "title": "💬 John Doe",
  "body": "Hey, how are you?",
  "data": {
    "type": "networking_message",
    "conversationId": "uuid",
    "senderId": "uuid",
    "senderName": "John Doe",
    "deepLink": "proactiveai://networking/chat/uuid?name=John%20Doe"
  },
  "sound": "default",
  "priority": "high"
}
```

## Testing

### Test the Edge Function Directly

```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/send-message-notification \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "test-conversation-id",
    "senderId": "test-sender-id",
    "content": "Test message"
  }'
```

### Test the Full Flow

1. Send a message in the app
2. Check Supabase logs:
   - **Edge Functions** → Logs → `send-message-notification`
   - Look for successful push sends
3. Verify recipient receives notification on their device

## Monitoring

### Edge Function Logs

View logs in Supabase Dashboard:
- **Edge Functions** → `send-message-notification` → **Logs**

### Database Trigger Logs

Check Postgres logs for trigger execution:
```sql
-- View recent trigger notices
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%notify_new_networking_message%'
ORDER BY calls DESC;
```

## Troubleshooting

### No notifications received

1. **Check pg_net is enabled**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

2. **Verify database settings**:
   ```sql
   SHOW app.settings.edge_function_url;
   SHOW app.settings.service_role_key;
   ```

3. **Check Edge Function logs** for errors

4. **Verify push tokens exist**:
   ```sql
   SELECT * FROM user_push_tokens WHERE user_id = '<recipient-id>' AND is_active = true;
   ```

5. **Test Edge Function directly** (see Testing section above)

### Trigger not firing

1. **Verify trigger exists**:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_notify_new_networking_message';
   ```

2. **Check trigger function**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'notify_new_networking_message';
   ```

3. **Re-run migration** if trigger is missing

### Edge Function errors

- Check that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available
- Verify Expo Push API is reachable
- Check token format (must start with `ExponentPushToken[` or `ExpoPushToken[`)

## Security Considerations

- ✅ Service role key is stored in database settings (not exposed to client)
- ✅ Edge Function validates conversation exists before sending
- ✅ Respects user notification preferences
- ✅ Trigger function uses `SECURITY DEFINER` to run with elevated privileges
- ✅ Only sends notifications for text messages (not system messages)

## Cost Considerations

- **Edge Functions**: Free tier includes 500K invocations/month
- **pg_net**: No additional cost (built into Supabase)
- **Expo Push**: Free for unlimited notifications

## Migration from Client-Side Push

The old client-side push code in `src/services/networking.ts` has been removed. All notifications now flow through the Edge Function automatically via the database trigger.

## Future Enhancements

Possible improvements:
- [ ] Batch notifications for multiple messages
- [ ] Add notification scheduling/throttling
- [ ] Support rich notifications with images
- [ ] Add notification analytics/tracking
- [ ] Implement notification retry logic
