# Realtime Setup Instructions - CRITICAL

## Current Status

✅ **Subscription is working** - Your logs show:
```
[Networking] 🔌 Subscription status: SUBSCRIBED
[Networking] ✅ Successfully subscribed to realtime updates
```

❌ **But no INSERT events are received** - When a message is sent, you should see:
```
[Networking] ✅ New message INSERT event received: { ... }
```

This means the issue is **NOT in the app code** - it's in the **Supabase Realtime configuration**.

## Fix Required: Enable Realtime for networking_messages Table

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase dashboard: https://app.supabase.com
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New query"

### Step 2: Run This SQL Command

```sql
-- Enable realtime for networking_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE networking_messages;
```

### Step 3: Verify It Worked

Run this query to confirm:
```sql
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'networking_messages';
```

**Expected result**: You should see one row with `networking_messages` in the tablename column.

### Step 4: Test Realtime

1. Keep your app open on the Networking → Connected tab
2. Open another browser/device with a different account
3. Send a message from the other account
4. **Check your console** - You should now see:
   ```
   [Networking] ✅ New message INSERT event received: {
     messageId: "...",
     conversationId: "...",
     senderId: "...",
     currentUserId: "...",
     isFromOtherUser: true
   }
   [Networking] ✅ Incrementing unread count for conversation: ...
   ```

## Alternative: Enable via Supabase Dashboard UI

If you prefer using the UI:

1. Go to **Database** → **Replication** in Supabase dashboard
2. Find `supabase_realtime` publication
3. Click on it
4. Look for `networking_messages` table
5. If it's not there, click "Add table" and select `networking_messages`
6. Save changes

## Troubleshooting

### Issue: "permission denied for table networking_messages"

This means RLS (Row Level Security) is blocking realtime. Run this:

```sql
-- Check current policies
SELECT * FROM pg_policies WHERE tablename = 'networking_messages';

-- If no SELECT policy exists, add one:
CREATE POLICY "Users can view messages in their conversations" 
ON networking_messages
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM networking_conversations
    WHERE networking_conversations.id = networking_messages.conversation_id
    AND (
      networking_conversations.user_id_1 = auth.uid() 
      OR networking_conversations.user_id_2 = auth.uid()
    )
  )
);
```

### Issue: Still not working after enabling realtime

1. **Restart your app** - Sometimes the WebSocket connection needs to be re-established
2. **Check Supabase project status** - Make sure your project is not paused
3. **Verify WebSocket connection** - In browser DevTools → Network → WS tab, you should see an active WebSocket connection to Supabase

### Issue: "Table already added to publication"

This is good! It means realtime is already enabled. The issue might be RLS policies. Check the RLS troubleshooting above.

## Expected Behavior After Fix

### When you send a message from Account B to Account A:

**Account A's console should show:**
```
[Networking] ✅ New message INSERT event received: {
  messageId: "abc-123",
  conversationId: "xyz-789",
  senderId: "<Account B's user ID>",
  currentUserId: "<Account A's user ID>",
  isFromOtherUser: true
}
[Networking] Moving conversation to top, index was: 2
[Networking] ✅ Incrementing unread count for conversation: xyz-789
[Networking] Unread count updated: xyz-789 from 0 to 1
```

**Account A's UI should show:**
- Red dot appears on the conversation
- Unread count badge shows "1"
- Conversation moves to the top of the list
- All happens **immediately** without leaving the page

## Quick Test Command

To manually test if realtime is working, run this in Supabase SQL Editor:

```sql
-- Insert a test message (replace with real IDs from your database)
INSERT INTO networking_messages (
  conversation_id, 
  sender_id, 
  content, 
  message_type
) VALUES (
  'a1d3f601-5275-4352-9cfa-77ec284fe0cf',  -- Use a real conversation ID from your logs
  '4693a323-0797-46cf-acaa-b5eb42d8946e',  -- Use a real sender ID (not the current user)
  'Test realtime message',
  'text'
);
```

If realtime is working, you should see the INSERT event in your console immediately after running this.

## Files Created

I've created a SQL migration file at:
`src/database/migrations/enable_realtime_networking.sql`

You can run this file in Supabase SQL Editor to enable realtime and check the configuration.

## Summary

The app code is correct and the subscription is working. You just need to:

1. **Run this ONE command in Supabase SQL Editor:**
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE networking_messages;
   ```

2. **Refresh your app**

3. **Test** - Send a message from another account and watch for the INSERT event in console

That's it! This is a one-time setup that enables realtime for the table.
