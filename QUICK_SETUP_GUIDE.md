# Quick Setup Guide - Push Notifications

Follow these steps in order. This should take about 10 minutes.

## Step 1: Enable pg_net Extension

1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Extensions**
3. Search for `pg_net`
4. Click **Enable**
5. Wait for confirmation ✅

## Step 2: Deploy Edge Function

Open your terminal and run:

```bash
cd "c:\Users\TOSHIBA\Documents\proactive ai\active"
supabase functions deploy send-message-notification
```

**If you get an error about Supabase CLI:**
```bash
# Install CLI
npm install -g supabase

# Login
supabase login

# Link your project (replace with your project ref)
supabase link --project-ref YOUR-PROJECT-REF
```

After successful deployment, you'll see:
```
Function URL: https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-message-notification
```

✅ Copy this URL - you'll need it in Step 4

## Step 3: Run Database Migration

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **New Query**
3. Open the file: `src/database/migrations/add_message_notification_trigger.sql`
4. Copy the entire contents
5. Paste into SQL Editor
6. Click **Run**
7. You should see: "Success. No rows returned" ✅

## Step 4: Configure Edge Function

1. In Supabase Dashboard, go to **Project Settings** → **API**
2. Copy your **service_role** key (click "Reveal" to see it)
3. Go to **Project Settings** → **General**
4. Copy your **Reference ID** (project ref)

Now in **SQL Editor**, run this (replace the placeholders):

```sql
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
```

**Example** (with fake values):
```sql
INSERT INTO edge_function_config (function_name, function_url, service_role_key)
VALUES (
  'send-message-notification',
  'https://abcdefghijklmno.supabase.co/functions/v1/send-message-notification',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ubyIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2MzI0MjI0MDAsImV4cCI6MTk0Nzk5ODQwMH0.fake_signature_here'
)
ON CONFLICT (function_name) DO UPDATE
SET function_url = EXCLUDED.function_url,
    service_role_key = EXCLUDED.service_role_key,
    updated_at = NOW();
```

Verify it worked:
```sql
SELECT function_name, function_url, created_at 
FROM edge_function_config 
WHERE function_name = 'send-message-notification';
```

You should see one row returned ✅

## Step 5: Test It!

1. Open your app on two devices (or one device + emulator)
2. Log in as different users on each device
3. Start a networking conversation
4. Send a message from Device A
5. Device B should receive a push notification! 🎉

## Troubleshooting

### "pg_net extension not found"
- Go back to Step 1 and enable pg_net

### "Function not found" error
- Make sure you deployed the Edge Function (Step 2)
- Check the function exists: Dashboard → Edge Functions

### "Configuration not found" in logs
- Make sure you ran Step 4 correctly
- Verify the config exists with the SELECT query above

### No notification received
1. Check Edge Function logs: Dashboard → Edge Functions → send-message-notification → Logs
2. Make sure recipient has push tokens: 
   ```sql
   SELECT * FROM user_push_tokens WHERE user_id = 'RECIPIENT-USER-ID' AND is_active = true;
   ```
3. Check notification preferences:
   ```sql
   SELECT * FROM user_preferences WHERE user_id = 'RECIPIENT-USER-ID';
   ```

## What Happens Now?

Every time a user sends a networking message:
1. Message is inserted into `networking_messages` table
2. Postgres trigger automatically fires
3. Trigger calls your Edge Function via HTTP
4. Edge Function sends push notification via Expo Push API
5. Recipient receives notification on their device
6. Tapping notification opens the chat

All automatic! 🚀

## Security Notes

- ✅ Service role key is stored in database (not exposed to client)
- ✅ Only the trigger function can access it (via RLS policy)
- ✅ Edge Function validates all requests
- ✅ Respects user notification preferences

## Next Steps

- Monitor Edge Function logs for the first few days
- Check notification delivery rates
- Adjust notification content/timing as needed

Done! 🎉
