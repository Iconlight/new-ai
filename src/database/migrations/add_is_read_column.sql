-- Add is_read column to networking_messages table for unread message tracking

-- Add the is_read column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'networking_messages' 
        AND column_name = 'is_read'
    ) THEN
        ALTER TABLE networking_messages 
        ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;
        
        -- Create index for performance on unread message queries
        CREATE INDEX IF NOT EXISTS idx_networking_messages_unread 
        ON networking_messages (conversation_id, sender_id, is_read);
        
        -- Update existing messages to be marked as read (assume they've been seen)
        UPDATE networking_messages 
        SET is_read = true 
        WHERE created_at < NOW() - INTERVAL '1 hour';
        
        RAISE NOTICE 'Added is_read column to networking_messages table';
    ELSE
        RAISE NOTICE 'is_read column already exists in networking_messages table';
    END IF;
END $$;

-- Add RLS policy to allow users to update read status of messages in their conversations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'networking_messages' 
        AND policyname = 'Users can update read status in their conversations'
    ) THEN
        CREATE POLICY "Users can update read status in their conversations" 
        ON networking_messages
        FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM networking_conversations nc 
                WHERE nc.id = conversation_id 
                AND (nc.user_id_1 = auth.uid() OR nc.user_id_2 = auth.uid())
            )
        );
        
        RAISE NOTICE 'Added RLS policy for updating read status';
    ELSE
        RAISE NOTICE 'Read status update policy already exists';
    END IF;
END $$;
