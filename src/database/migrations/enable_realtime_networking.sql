-- Enable Realtime for networking_messages table
-- This allows the app to receive INSERT/UPDATE/DELETE events in realtime

-- Step 1: Check if realtime is already enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'networking_messages';

-- Step 2: Enable realtime for networking_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE networking_messages;

-- Step 3: Verify it was added
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'networking_messages';

-- Step 4: Also check RLS policies allow SELECT (required for realtime)
-- Users must be able to SELECT messages they're involved in
SELECT * FROM pg_policies 
WHERE tablename = 'networking_messages';

-- If the above shows no SELECT policies or restrictive ones, you may need to add:
-- CREATE POLICY "Users can view messages in their conversations" ON networking_messages
--   FOR SELECT USING (
--     EXISTS (
--       SELECT 1 FROM networking_conversations
--       WHERE networking_conversations.id = networking_messages.conversation_id
--       AND (networking_conversations.user_id_1 = auth.uid() OR networking_conversations.user_id_2 = auth.uid())
--     )
--   );
