-- Quick script to ensure all networking tables exist
-- Run this in your Supabase SQL editor if you're getting table not found errors

-- Check if user_matches table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_matches') THEN
        -- Create the user_matches table
        CREATE TABLE user_matches (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id_1 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            user_id_2 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            compatibility_score INTEGER CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
            shared_interests TEXT[] DEFAULT '{}',
            complementary_traits TEXT[] DEFAULT '{}',
            conversation_potential INTEGER DEFAULT 0,
            match_reason TEXT,
            status TEXT CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
            UNIQUE(user_id_1, user_id_2),
            CHECK (user_id_1 != user_id_2)
        );

        -- Enable RLS
        ALTER TABLE user_matches ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        CREATE POLICY "Users can view their matches" ON user_matches
            FOR SELECT USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);
        CREATE POLICY "Users can update their matches" ON user_matches
            FOR UPDATE USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);
        CREATE POLICY "System can create matches" ON user_matches
            FOR INSERT WITH CHECK (true);

        -- Create indexes
        CREATE INDEX idx_user_matches_user_id_1 ON user_matches(user_id_1);
        CREATE INDEX idx_user_matches_user_id_2 ON user_matches(user_id_2);
        CREATE INDEX idx_user_matches_status ON user_matches(status);
        CREATE INDEX idx_user_matches_compatibility_score ON user_matches(compatibility_score DESC);

        RAISE NOTICE 'Created user_matches table with RLS and indexes';
    ELSE
        RAISE NOTICE 'user_matches table already exists';
    END IF;
END $$;

-- Check if networking_conversations table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'networking_conversations') THEN
        CREATE TABLE networking_conversations (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            match_id UUID REFERENCES user_matches(id) ON DELETE CASCADE,
            user_id_1 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            user_id_2 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            conversation_starter TEXT,
            status TEXT CHECK (status IN ('initiated', 'active', 'paused', 'ended')) DEFAULT 'initiated',
            last_message_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        ALTER TABLE networking_conversations ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can access their networking conversations" ON networking_conversations
            FOR ALL USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

        CREATE INDEX idx_networking_conversations_match_id ON networking_conversations(match_id);
        
        RAISE NOTICE 'Created networking_conversations table';
    ELSE
        RAISE NOTICE 'networking_conversations table already exists';
    END IF;
END $$;

-- Check if networking_messages table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'networking_messages') THEN
        CREATE TABLE networking_messages (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            conversation_id UUID REFERENCES networking_conversations(id) ON DELETE CASCADE,
            sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            message_type TEXT CHECK (message_type IN ('text', 'system', 'starter', 'user')) DEFAULT 'text',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        ALTER TABLE networking_messages ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can access messages in their conversations" ON networking_messages
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM networking_conversations nc 
                    WHERE nc.id = conversation_id 
                    AND (nc.user_id_1 = auth.uid() OR nc.user_id_2 = auth.uid())
                )
            );
        CREATE POLICY "Users can send messages in their conversations" ON networking_messages
            FOR INSERT WITH CHECK (
                auth.uid() = sender_id AND
                EXISTS (
                    SELECT 1 FROM networking_conversations nc 
                    WHERE nc.id = conversation_id 
                    AND (nc.user_id_1 = auth.uid() OR nc.user_id_2 = auth.uid())
                )
            );
            
        -- Also allow system to insert starter messages
        CREATE POLICY "System can insert starter messages" ON networking_messages
            FOR INSERT WITH CHECK (message_type IN ('starter', 'system'));

        CREATE INDEX idx_networking_messages_conversation_id ON networking_messages(conversation_id);
        CREATE INDEX idx_networking_messages_created_at ON networking_messages(created_at DESC);
        
        RAISE NOTICE 'Created networking_messages table';
    ELSE
        RAISE NOTICE 'networking_messages table already exists';
    END IF;
END $$;

-- Migrate existing networking_activity data to user_matches if needed
DO $$
DECLARE
    activity_record RECORD;
    existing_match_id UUID;
    new_match_id UUID;
BEGIN
    -- Check if we have networking_activity data but no user_matches data
    IF EXISTS (SELECT 1 FROM networking_activity WHERE activity_type IN ('match_found', 'match_accepted')) 
       AND NOT EXISTS (SELECT 1 FROM user_matches LIMIT 1) THEN
        
        RAISE NOTICE 'Migrating networking_activity data to user_matches...';
        
        -- Migrate match_accepted activities to user_matches
        FOR activity_record IN 
            SELECT DISTINCT 
                user_id, 
                related_user_id, 
                metadata,
                created_at
            FROM networking_activity 
            WHERE activity_type = 'match_accepted' 
            AND related_user_id IS NOT NULL
        LOOP
            -- Check if match already exists (avoid duplicates)
            SELECT id INTO existing_match_id 
            FROM user_matches 
            WHERE (user_id_1 = activity_record.user_id AND user_id_2 = activity_record.related_user_id)
               OR (user_id_1 = activity_record.related_user_id AND user_id_2 = activity_record.user_id);
            
            IF existing_match_id IS NULL THEN
                -- Create the match
                INSERT INTO user_matches (
                    user_id_1,
                    user_id_2,
                    compatibility_score,
                    shared_interests,
                    match_reason,
                    status,
                    created_at
                ) VALUES (
                    LEAST(activity_record.user_id, activity_record.related_user_id),
                    GREATEST(activity_record.user_id, activity_record.related_user_id),
                    COALESCE((activity_record.metadata->>'compatibility_score')::INTEGER, 75),
                    COALESCE(
                        ARRAY(SELECT jsonb_array_elements_text(activity_record.metadata->'shared_interests')),
                        '{}'::TEXT[]
                    ),
                    COALESCE(activity_record.metadata->>'match_reason', 'Compatible conversation styles'),
                    'accepted',
                    activity_record.created_at
                ) RETURNING id INTO new_match_id;
                
                RAISE NOTICE 'Migrated match: % <-> % (ID: %)', 
                    activity_record.user_id, activity_record.related_user_id, new_match_id;
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Migration completed successfully';
    ELSE
        RAISE NOTICE 'No migration needed - user_matches table already has data or no networking_activity found';
    END IF;
END $$;

-- Create missing networking_conversations for accepted matches without conversations
DO $$
DECLARE
    match_record RECORD;
    conversation_id UUID;
BEGIN
    FOR match_record IN 
        SELECT um.id as match_id, um.user_id_1, um.user_id_2
        FROM user_matches um
        LEFT JOIN networking_conversations nc ON nc.match_id = um.id
        WHERE um.status = 'accepted' AND nc.id IS NULL
    LOOP
        INSERT INTO networking_conversations (
            match_id,
            user_id_1,
            user_id_2,
            conversation_starter,
            status
        ) VALUES (
            match_record.match_id,
            match_record.user_id_1,
            match_record.user_id_2,
            'Great to connect! Looking forward to our conversation.',
            'active'
        ) RETURNING id INTO conversation_id;
        
        RAISE NOTICE 'Created missing conversation for match %: %', match_record.match_id, conversation_id;
    END LOOP;
END $$;

-- Verify all tables exist and show data counts
SELECT 
    CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_matches') 
         THEN '✅ user_matches (' || (SELECT COUNT(*)::text FROM user_matches) || ' records)'
         ELSE '❌ user_matches' END as user_matches_status,
    CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'networking_conversations') 
         THEN '✅ networking_conversations (' || (SELECT COUNT(*)::text FROM networking_conversations) || ' records)'
         ELSE '❌ networking_conversations' END as conversations_status,
    CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'networking_messages') 
         THEN '✅ networking_messages (' || (SELECT COUNT(*)::text FROM networking_messages) || ' records)'
         ELSE '❌ networking_messages' END as messages_status,
    CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_networking_preferences') 
         THEN '✅ user_networking_preferences (' || (SELECT COUNT(*)::text FROM user_networking_preferences) || ' records)'
         ELSE '❌ user_networking_preferences' END as preferences_status,
    CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_conversation_patterns') 
         THEN '✅ user_conversation_patterns (' || (SELECT COUNT(*)::text FROM user_conversation_patterns) || ' records)'
         ELSE '❌ user_conversation_patterns' END as patterns_status,
    CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'networking_activity') 
         THEN '✅ networking_activity (' || (SELECT COUNT(*)::text FROM networking_activity) || ' records)'
         ELSE '❌ networking_activity' END as activity_status;

-- Create sample conversation patterns for users who have chats but no patterns
DO $$
DECLARE
    user_record RECORD;
    message_count INTEGER;
    sample_interests TEXT[];
    sample_style TEXT;
BEGIN
    -- Get users who have sent messages but don't have conversation patterns
    FOR user_record IN 
        SELECT DISTINCT c.user_id
        FROM chats c
        INNER JOIN messages m ON m.chat_id = c.id
        LEFT JOIN user_conversation_patterns ucp ON ucp.user_id = c.user_id
        WHERE ucp.user_id IS NULL
        AND m.role = 'user'
        LIMIT 20 -- Process up to 20 users at a time
    LOOP
        -- Count messages for this user
        SELECT COUNT(*) INTO message_count
        FROM messages m
        INNER JOIN chats c ON c.id = m.chat_id
        WHERE c.user_id = user_record.user_id AND m.role = 'user';
        
        -- Get user's actual interests if they exist
        SELECT ARRAY_AGG(interest) INTO sample_interests
        FROM user_interests ui
        WHERE ui.user_id = user_record.user_id;
        
        -- Default to varied interests if none found
        IF sample_interests IS NULL OR array_length(sample_interests, 1) IS NULL THEN
            -- Use different default interests for variety
            sample_interests := CASE 
                WHEN user_record.user_id::text LIKE '%1%' THEN ARRAY['art', 'music', 'creativity']
                WHEN user_record.user_id::text LIKE '%2%' THEN ARRAY['sports', 'fitness', 'health']
                WHEN user_record.user_id::text LIKE '%3%' THEN ARRAY['travel', 'culture', 'languages']
                WHEN user_record.user_id::text LIKE '%4%' THEN ARRAY['business', 'entrepreneurship', 'finance']
                WHEN user_record.user_id::text LIKE '%5%' THEN ARRAY['food', 'cooking', 'nutrition']
                WHEN user_record.user_id::text LIKE '%6%' THEN ARRAY['books', 'writing', 'literature']
                WHEN user_record.user_id::text LIKE '%7%' THEN ARRAY['movies', 'entertainment', 'media']
                WHEN user_record.user_id::text LIKE '%8%' THEN ARRAY['nature', 'environment', 'sustainability']
                WHEN user_record.user_id::text LIKE '%9%' THEN ARRAY['gaming', 'esports', 'digital culture']
                ELSE ARRAY['technology', 'science', 'philosophy']
            END;
        END IF;
        
        -- Assign communication style based on user ID for variety
        sample_style := CASE 
            WHEN user_record.user_id::text LIKE '%a%' OR user_record.user_id::text LIKE '%A%' THEN 'analytical'
            WHEN user_record.user_id::text LIKE '%b%' OR user_record.user_id::text LIKE '%B%' THEN 'creative'
            WHEN user_record.user_id::text LIKE '%c%' OR user_record.user_id::text LIKE '%C%' THEN 'empathetic'
            WHEN user_record.user_id::text LIKE '%d%' OR user_record.user_id::text LIKE '%D%' THEN 'direct'
            WHEN user_record.user_id::text LIKE '%e%' OR user_record.user_id::text LIKE '%E%' THEN 'philosophical'
            WHEN user_record.user_id::text LIKE '%f%' OR user_record.user_id::text LIKE '%F%' THEN 'creative'
            ELSE (ARRAY['analytical', 'creative', 'empathetic', 'direct', 'philosophical'])[1 + (ABS(HASHTEXT(user_record.user_id::text)) % 5)]
        END;
        
        -- Insert conversation pattern
        INSERT INTO user_conversation_patterns (
            user_id,
            communication_style,
            curiosity_level,
            topic_depth,
            question_asking,
            response_length,
            interests,
            conversation_topics,
            intellectual_curiosity,
            emotional_intelligence
        ) VALUES (
            user_record.user_id,
            sample_style,
            60 + (RANDOM() * 40)::INTEGER, -- 60-100
            50 + (RANDOM() * 50)::INTEGER, -- 50-100
            40 + (RANDOM() * 40)::INTEGER, -- 40-80
            CASE WHEN RANDOM() < 0.33 THEN 'concise' 
                 WHEN RANDOM() < 0.66 THEN 'moderate' 
                 ELSE 'detailed' END,
            sample_interests,
            sample_interests, -- Use same as conversation topics for now
            65 + (RANDOM() * 35)::INTEGER, -- 65-100
            55 + (RANDOM() * 45)::INTEGER  -- 55-100
        );
        
        RAISE NOTICE 'Created conversation pattern for user % with style % and % interests', 
            user_record.user_id, sample_style, array_length(sample_interests, 1);
    END LOOP;
END $$;

-- Update existing patterns that have hardcoded interests
DO $$
DECLARE
    pattern_record RECORD;
    new_interests TEXT[];
    new_style TEXT;
BEGIN
    -- Find patterns with the hardcoded interests
    FOR pattern_record IN 
        SELECT user_id, interests, communication_style
        FROM user_conversation_patterns
        WHERE interests = ARRAY['technology', 'philosophy', 'science']
        OR communication_style = 'analytical'
    LOOP
        -- Get user's actual interests
        SELECT ARRAY_AGG(interest) INTO new_interests
        FROM user_interests ui
        WHERE ui.user_id = pattern_record.user_id;
        
        -- If no real interests, assign varied ones based on user ID
        IF new_interests IS NULL OR array_length(new_interests, 1) IS NULL THEN
            new_interests := CASE 
                WHEN pattern_record.user_id::text LIKE '%1%' THEN ARRAY['art', 'music', 'creativity']
                WHEN pattern_record.user_id::text LIKE '%2%' THEN ARRAY['sports', 'fitness', 'health']
                WHEN pattern_record.user_id::text LIKE '%3%' THEN ARRAY['travel', 'culture', 'languages']
                WHEN pattern_record.user_id::text LIKE '%4%' THEN ARRAY['business', 'entrepreneurship', 'finance']
                WHEN pattern_record.user_id::text LIKE '%5%' THEN ARRAY['food', 'cooking', 'nutrition']
                WHEN pattern_record.user_id::text LIKE '%6%' THEN ARRAY['books', 'writing', 'literature']
                WHEN pattern_record.user_id::text LIKE '%7%' THEN ARRAY['movies', 'entertainment', 'media']
                WHEN pattern_record.user_id::text LIKE '%8%' THEN ARRAY['nature', 'environment', 'sustainability']
                WHEN pattern_record.user_id::text LIKE '%9%' THEN ARRAY['gaming', 'esports', 'digital culture']
                WHEN pattern_record.user_id::text LIKE '%0%' THEN ARRAY['psychology', 'mindfulness', 'wellness']
                ELSE ARRAY['technology', 'innovation', 'future']
            END;
        END IF;
        
        -- Assign varied communication style based on user ID
        new_style := CASE 
            WHEN pattern_record.user_id::text LIKE '%a%' OR pattern_record.user_id::text LIKE '%A%' THEN 'analytical'
            WHEN pattern_record.user_id::text LIKE '%b%' OR pattern_record.user_id::text LIKE '%B%' THEN 'creative'
            WHEN pattern_record.user_id::text LIKE '%c%' OR pattern_record.user_id::text LIKE '%C%' THEN 'empathetic'
            WHEN pattern_record.user_id::text LIKE '%d%' OR pattern_record.user_id::text LIKE '%D%' THEN 'direct'
            WHEN pattern_record.user_id::text LIKE '%e%' OR pattern_record.user_id::text LIKE '%E%' THEN 'philosophical'
            WHEN pattern_record.user_id::text LIKE '%f%' OR pattern_record.user_id::text LIKE '%F%' THEN 'creative'
            ELSE (ARRAY['analytical', 'creative', 'empathetic', 'direct', 'philosophical'])[1 + (ABS(HASHTEXT(pattern_record.user_id::text)) % 5)]
        END;
        
        -- Update the pattern
        UPDATE user_conversation_patterns
        SET 
            interests = new_interests,
            conversation_topics = new_interests,
            communication_style = new_style,
            curiosity_level = 60 + (ABS(HASHTEXT(pattern_record.user_id::text)) % 40), -- 60-100
            topic_depth = 50 + (ABS(HASHTEXT(pattern_record.user_id::text || 'depth')) % 50), -- 50-100
            question_asking = 40 + (ABS(HASHTEXT(pattern_record.user_id::text || 'questions')) % 40), -- 40-80
            intellectual_curiosity = 65 + (ABS(HASHTEXT(pattern_record.user_id::text || 'curiosity')) % 35), -- 65-100
            emotional_intelligence = 55 + (ABS(HASHTEXT(pattern_record.user_id::text || 'emotion')) % 45), -- 55-100
            updated_at = NOW()
        WHERE user_id = pattern_record.user_id;
        
        RAISE NOTICE 'Updated pattern for user %: % style, % interests', 
            pattern_record.user_id, new_style, array_length(new_interests, 1);
    END LOOP;
END $$;

-- Show current matches and conversations for debugging
SELECT 
    'Current Matches:' as info,
    um.id,
    um.user_id_1,
    um.user_id_2,
    um.status,
    um.compatibility_score,
    um.created_at,
    CASE WHEN nc.id IS NOT NULL THEN 'Has Conversation' ELSE 'No Conversation' END as conversation_status
FROM user_matches um
LEFT JOIN networking_conversations nc ON nc.match_id = um.id
ORDER BY um.created_at DESC
LIMIT 10;

-- Show conversation patterns summary
SELECT 
    'Conversation Patterns:' as info,
    COUNT(*) as total_patterns,
    COUNT(DISTINCT communication_style) as unique_styles,
    ARRAY_AGG(DISTINCT communication_style) as styles_found
FROM user_conversation_patterns;
