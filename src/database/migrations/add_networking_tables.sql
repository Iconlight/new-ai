-- Networking Tables for AI-Powered Conversational Matching

-- User conversation patterns analysis
CREATE TABLE IF NOT EXISTS user_conversation_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    communication_style TEXT CHECK (communication_style IN ('analytical', 'creative', 'empathetic', 'direct', 'philosophical')),
    curiosity_level INTEGER CHECK (curiosity_level >= 0 AND curiosity_level <= 100),
    topic_depth INTEGER CHECK (topic_depth >= 0 AND topic_depth <= 100),
    question_asking INTEGER CHECK (question_asking >= 0 AND question_asking <= 100),
    response_length TEXT CHECK (response_length IN ('concise', 'moderate', 'detailed')),
    interests TEXT[] DEFAULT '{}',
    conversation_topics TEXT[] DEFAULT '{}',
    intellectual_curiosity INTEGER CHECK (intellectual_curiosity >= 0 AND intellectual_curiosity <= 100),
    emotional_intelligence INTEGER CHECK (emotional_intelligence >= 0 AND emotional_intelligence <= 100),
    last_analyzed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- User networking preferences
CREATE TABLE IF NOT EXISTS user_networking_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_networking_enabled BOOLEAN DEFAULT true,
    visibility_level TEXT CHECK (visibility_level IN ('public', 'limited', 'private')) DEFAULT 'limited',
    max_matches_per_day INTEGER DEFAULT 5,
    preferred_communication_styles TEXT[] DEFAULT '{}',
    blocked_users UUID[] DEFAULT '{}',
    minimum_compatibility_score INTEGER DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- User compatibility matches
CREATE TABLE IF NOT EXISTS user_matches (
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

-- Networking conversations (separate from regular AI chats)
CREATE TABLE IF NOT EXISTS networking_conversations (
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

-- Messages in networking conversations
CREATE TABLE IF NOT EXISTS networking_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES networking_conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT CHECK (message_type IN ('text', 'system', 'starter')) DEFAULT 'text',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User networking activity log
CREATE TABLE IF NOT EXISTS networking_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type TEXT CHECK (activity_type IN ('match_found', 'match_accepted', 'match_declined', 'conversation_started', 'message_sent')),
    related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_conversation_patterns_user_id ON user_conversation_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_conversation_patterns_interests ON user_conversation_patterns USING GIN(interests);
CREATE INDEX IF NOT EXISTS idx_user_matches_user_id_1 ON user_matches(user_id_1);
CREATE INDEX IF NOT EXISTS idx_user_matches_user_id_2 ON user_matches(user_id_2);
CREATE INDEX IF NOT EXISTS idx_user_matches_status ON user_matches(status);
CREATE INDEX IF NOT EXISTS idx_user_matches_compatibility_score ON user_matches(compatibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_networking_conversations_match_id ON networking_conversations(match_id);
CREATE INDEX IF NOT EXISTS idx_networking_messages_conversation_id ON networking_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_networking_messages_created_at ON networking_messages(created_at DESC);

-- Row Level Security (RLS) Policies

-- User conversation patterns - users can only see their own
ALTER TABLE user_conversation_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own conversation patterns" ON user_conversation_patterns
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own conversation patterns" ON user_conversation_patterns
    FOR ALL USING (auth.uid() = user_id);

-- User networking preferences - users can only manage their own
ALTER TABLE user_networking_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own networking preferences" ON user_networking_preferences
    FOR ALL USING (auth.uid() = user_id);

-- User matches - users can see matches they're part of
ALTER TABLE user_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their matches" ON user_matches
    FOR SELECT USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);
CREATE POLICY "Users can update their matches" ON user_matches
    FOR UPDATE USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Networking conversations - participants can access
ALTER TABLE networking_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their networking conversations" ON networking_conversations
    FOR ALL USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Networking messages - conversation participants can access
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

-- Networking activity - users can see their own activity
ALTER TABLE networking_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own networking activity" ON networking_activity
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can log networking activity" ON networking_activity
    FOR INSERT WITH CHECK (true);

-- Functions for automatic updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
CREATE TRIGGER update_user_conversation_patterns_updated_at 
    BEFORE UPDATE ON user_conversation_patterns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_networking_preferences_updated_at 
    BEFORE UPDATE ON user_networking_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_networking_conversations_updated_at 
    BEFORE UPDATE ON networking_conversations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
