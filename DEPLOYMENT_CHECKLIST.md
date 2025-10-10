# Push Notifications Deployment Checklist

Follow these steps in order to deploy the server-side push notification system.

## Prerequisites

- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Logged into Supabase CLI (`supabase login`)
- [ ] Project linked (`supabase link --project-ref <your-ref>`)
- [ ] Access to Supabase Dashboard

## Step 1: Enable pg_net Extension

- [ ] Go to Supabase Dashboard → **Database** → **Extensions**
- [ ] Search for `pg_net`
- [ ] Click **Enable** on `pg_net`
- [ ] Wait for confirmation

## Step 2: Deploy Edge Function

```bash
# From project root
cd "c:\Users\TOSHIBA\Documents\proactive ai\active"

# Deploy the function
supabase functions deploy send-message-notification
```

- [ ] Function deployed successfully
- [ ] Note the function URL (shown in output)

## Step 3: Configure Database Settings

Get your project details:
- [ ] Project Ref: Found in Project Settings → General
- [ ] Service Role Key: Found in Project Settings → API → `service_role` (secret)

Run in Supabase SQL Editor:

```sql
-- Replace <your-project-ref> with actual value
ALTER DATABASE postgres SET app.settings.edge_function_url = 
  'https://<your-project-ref>.supabase.co/functions/v1/send-message-notification';

-- Replace <your-service-role-key> with actual value
ALTER DATABASE postgres SET app.settings.service_role_key = 
  '<your-service-role-key>';
```

- [ ] Edge function URL configured
- [ ] Service role key configured

Verify settings:
```sql
SHOW app.settings.edge_function_url;
SHOW app.settings.service_role_key;
```

- [ ] Settings verified

## Step 4: Run Database Migration

Option A - Using Supabase Dashboard:
- [ ] Go to **SQL Editor**
- [ ] Open `src/database/migrations/add_message_notification_trigger.sql`
- [ ] Copy and paste the entire file
- [ ] Click **Run**
- [ ] Verify "Success. No rows returned"

Option B - Using Supabase CLI:
```bash
supabase db push
```

- [ ] Migration applied successfully

Verify trigger exists:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_notify_new_networking_message';
```

- [ ] Trigger confirmed in database

## Step 5: Test the System

### Test Edge Function Directly

```bash
# Replace with your actual values
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/send-message-notification \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "existing-conversation-id",
    "senderId": "existing-user-id",
    "content": "Test notification"
  }'
```

- [ ] Edge function responds with success
- [ ] Check Edge Function logs in Dashboard

### Test Full Flow

1. [ ] Open app on Device A (logged in as User A)
2. [ ] Open app on Device B (logged in as User B)
3. [ ] User A sends message to User B
4. [ ] User B receives push notification
5. [ ] Tapping notification opens the chat

### Verify in Logs

- [ ] Check **Edge Functions** → Logs → `send-message-notification`
- [ ] Confirm successful push sends
- [ ] No errors in logs

## Step 6: Clean Up Old Code

The following changes have already been made:
- [x] Removed client-side push call from `src/services/networking.ts`
- [x] Added comments explaining new system
- [x] Local notifications still work in chat screen

## Troubleshooting

If notifications don't work:

### Check pg_net
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```
- [ ] pg_net is enabled

### Check Database Settings
```sql
SHOW app.settings.edge_function_url;
SHOW app.settings.service_role_key;
```
- [ ] Both settings are configured correctly

### Check Push Tokens
```sql
SELECT * FROM user_push_tokens WHERE is_active = true;
```
- [ ] Users have valid push tokens registered

### Check Edge Function Logs
- [ ] Go to Dashboard → Edge Functions → send-message-notification → Logs
- [ ] Look for errors or failed requests

### Check Trigger
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_notify_new_networking_message';
```
- [ ] Trigger exists and is enabled

## Rollback (if needed)

To disable the trigger without removing it:
```sql
ALTER TABLE networking_messages DISABLE TRIGGER trigger_notify_new_networking_message;
```

To re-enable:
```sql
ALTER TABLE networking_messages ENABLE TRIGGER trigger_notify_new_networking_message;
```

To completely remove:
```sql
DROP TRIGGER IF EXISTS trigger_notify_new_networking_message ON networking_messages;
DROP FUNCTION IF EXISTS notify_new_networking_message();
```

## Success Criteria

- [x] Edge Function deployed
- [x] Database trigger created
- [x] Settings configured
- [ ] Test message sends notification
- [ ] Notification opens correct chat
- [ ] No errors in logs

## Next Steps After Deployment

- [ ] Monitor Edge Function logs for first few days
- [ ] Check notification delivery rates
- [ ] Gather user feedback on notification timing
- [ ] Consider adding notification throttling if needed

## Support

See `PUSH_NOTIFICATIONS_SETUP.md` for detailed documentation.
