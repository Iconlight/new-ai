# Networking Realtime Debug Guide

## Critical Fixes Applied

### Fix 1: Scrolling Issue - Added Missing Container Styles
**Problem**: GiftedChat wasn't scrollable because `containerStyle` and `messagesContainerStyle` were missing.

**Fix Applied**:
```typescript
<GiftedChat
  containerStyle={{ flex: 1, backgroundColor: 'transparent' }}
  messagesContainerStyle={{ flex: 1, backgroundColor: 'transparent' }}
  // ... other props
/>
```

### Fix 2: Realtime Updates - Fixed Stale Closure & Channel Conflicts
**Problem**: 
1. Stale closure in unread count callback
2. Channel name changing per tab causing subscription conflicts
3. Not enough diagnostic logging

**Fix Applied**:
- Removed `activeTab` from dependency array (was causing re-subscriptions)
- Fixed channel name to be constant: `'rt-networking-list-main'`
- Fixed unread count increment to use functional setState (no stale closure)
- Added comprehensive emoji-based logging for easy debugging

## How to Test

### Test 1: Verify Realtime Subscription is Active

1. **Open the app on Account A**
2. **Navigate to Networking page**
3. **Check console logs** - You should see:
   ```
   [Networking] Setting up realtime subscriptions, user: <user-id>
   [Networking] 🔌 Subscription status: SUBSCRIBED
   [Networking] ✅ Successfully subscribed to realtime updates
   ```

4. **If you DON'T see "SUBSCRIBED"**, check for:
   - `❌ Subscription closed` - Supabase connection issue
   - `❌ Channel error` - Database permissions issue

### Test 2: Verify Realtime Message Reception

1. **Keep Account A on the Networking → Connected tab**
2. **On Account B, send a message to Account A**
3. **Check Account A's console logs** - You should see:
   ```
   [Networking] ✅ New message INSERT event received: {
     messageId: "xxx",
     conversationId: "yyy",
     senderId: "<B's user id>",
     currentUserId: "<A's user id>",
     isFromOtherUser: true
   }
   [Networking] ✅ Incrementing unread count for conversation: yyy
   [Networking] Unread count updated: yyy from 0 to 1
   ```

4. **Check the UI** - Red dot should appear immediately

### Test 3: Verify Message Scrolling

1. **Open a networking chat with 10+ messages**
2. **Check console logs** - You should see:
   ```
   [NetworkingChat] loadMessages: fetched X messages from database
   [NetworkingChat] loadMessages: setting X messages to state
   ```
   Where X should be the total number of messages (not limited)

3. **Try scrolling up** - You should be able to scroll through all messages
4. **Send a new message**
5. **Check console** - You should see:
   ```
   [NetworkingChat] mergeMessages: prev count: X, incoming count: 1, result count: X+1
   ```
   The result count should be prev + 1, never less than prev

6. **Scroll up again** - All old messages should still be there

### Test 4: Verify No Stale Closures

1. **Account A on Networking → Connected tab**
2. **Account B sends message 1** → Check A sees unread count = 1
3. **Account B sends message 2** → Check A sees unread count = 2
4. **Account B sends message 3** → Check A sees unread count = 3

Each increment should work correctly without resetting.

## Common Issues & Solutions

### Issue: "Subscription status: CLOSED" immediately after SUBSCRIBED
**Cause**: Supabase realtime not enabled for `networking_messages` table
**Solution**: Run this SQL in Supabase:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE networking_messages;
```

### Issue: No INSERT events received
**Cause**: Row Level Security blocking realtime events
**Solution**: Check RLS policies on `networking_messages` allow SELECT for both users

### Issue: Unread count not incrementing
**Check logs for**:
- `isFromOtherUser: false` - Message is from current user (expected behavior)
- `⚠️ Message missing conversation_id` - Database issue
- No INSERT event at all - Realtime not working

### Issue: Scrolling still not working
**Check**:
1. Console shows correct message count being loaded
2. `mergeMessages` shows increasing count
3. Try on a physical device (emulator scrolling can be buggy)

## Diagnostic Commands

### Check if realtime is enabled for table:
```sql
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'networking_messages';
```

### Check RLS policies:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'networking_messages';
```

### Manually test message insert:
```sql
INSERT INTO networking_messages (conversation_id, sender_id, content, message_type)
VALUES ('<conversation-id>', '<sender-id>', 'Test message', 'text');
```

Then check if the INSERT event appears in Account A's console.

## Expected Console Output (Happy Path)

### On App Start (Networking Page):
```
[Networking] Setting up realtime subscriptions, user: abc-123
[Networking] 🔌 Subscription status: SUBSCRIBED
[Networking] ✅ Successfully subscribed to realtime updates
```

### When Message Arrives:
```
[Networking] ✅ New message INSERT event received: { ... }
[Networking] Moving conversation to top, index was: 2
[Networking] ✅ Incrementing unread count for conversation: xyz
[Networking] Unread count updated: xyz from 0 to 1
```

### When Opening Chat:
```
[NetworkingChat] loadMessages: fetched 15 messages from database
[NetworkingChat] loadMessages: setting 15 messages to state
[NetworkingChat] Subscribing to realtime for conversation: xyz
[NetworkingChat] Channel status: SUBSCRIBED
```

### When Sending Message:
```
[NetworkingChat] mergeMessages: prev count: 15, incoming count: 1, result count: 16
```

### When Receiving Message in Open Chat:
```
[NetworkingChat] INSERT message event: msg-456
[NetworkingChat] mergeMessages: prev count: 16, incoming count: 1, result count: 17
```

## Next Steps if Still Not Working

1. **Share console logs** - Copy the full console output when testing
2. **Check Supabase dashboard** - Go to Database → Replication and verify `networking_messages` is enabled
3. **Test with curl** - Verify messages are actually being inserted in the database
4. **Check network tab** - Verify WebSocket connection is established to Supabase

## Key Changes Summary

### `app/networking.tsx`
- ✅ Removed `activeTab` dependency (was causing unnecessary re-subscriptions)
- ✅ Fixed stale closure in unread count increment
- ✅ Added comprehensive logging with emojis
- ✅ Simplified channel name to avoid conflicts

### `app/networking/chat/[id].tsx`
- ✅ Added `containerStyle={{ flex: 1 }}` to GiftedChat
- ✅ Added `messagesContainerStyle={{ flex: 1 }}` to GiftedChat
- ✅ Added logging to track message counts through the pipeline
