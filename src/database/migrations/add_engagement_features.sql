-- Migration: Add tables for engagement features
-- Includes: saved topics, topic reactions, conversation insights, match ratings

-- ============================================================================
-- SAVED TOPICS
-- ============================================================================
CREATE TABLE IF NOT EXISTS saved_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id TEXT NOT NULL,
    topic_title TEXT,
    topic_message TEXT,
    article_content TEXT,
    topic_category TEXT,
    source_url TEXT,
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    opened BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_topics_user_id ON saved_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_topics_saved_at ON saved_topics(saved_at DESC);

ALTER TABLE saved_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own saved topics" ON saved_topics;
CREATE POLICY "Users can manage own saved topics"
    ON saved_topics FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TOPIC REACTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS topic_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id TEXT NOT NULL,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'insightful', 'inspiring')),
    topic_category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_reactions_user_id ON topic_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_reactions_topic_id ON topic_reactions(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_reactions_created_at ON topic_reactions(created_at DESC);

ALTER TABLE topic_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own topic reactions" ON topic_reactions;
CREATE POLICY "Users can manage own topic reactions"
    ON topic_reactions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- HIDDEN TOPICS
-- ============================================================================
CREATE TABLE IF NOT EXISTS hidden_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id TEXT,
    category TEXT,
    hide_type TEXT NOT NULL CHECK (hide_type IN ('topic', 'category')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, topic_id, category, hide_type)
);

CREATE INDEX IF NOT EXISTS idx_hidden_topics_user_id ON hidden_topics(user_id);

ALTER TABLE hidden_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own hidden topics" ON hidden_topics;
CREATE POLICY "Users can manage own hidden topics"
    ON hidden_topics FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- CONVERSATION INSIGHTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    insights JSONB NOT NULL DEFAULT '[]'::jsonb,
    key_takeaways TEXT[],
    topics_discussed TEXT[],
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_insights_user_id ON conversation_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_chat_id ON conversation_insights(chat_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_updated_at ON conversation_insights(updated_at DESC);

ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own conversation insights" ON conversation_insights;
CREATE POLICY "Users can manage own conversation insights"
    ON conversation_insights FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- MATCH RATINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS match_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES user_matches(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    conversation_quality INTEGER CHECK (conversation_quality >= 1 AND conversation_quality <= 5),
    would_recommend BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_match_ratings_user_id ON match_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_match_ratings_match_id ON match_ratings(match_id);
CREATE INDEX IF NOT EXISTS idx_match_ratings_rating ON match_ratings(rating);

ALTER TABLE match_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own match ratings" ON match_ratings;
CREATE POLICY "Users can manage own match ratings"
    ON match_ratings FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can see aggregate ratings for matches they're part of
DROP POLICY IF EXISTS "Users can view ratings for their matches" ON match_ratings;
CREATE POLICY "Users can view ratings for their matches"
    ON match_ratings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_matches
            WHERE user_matches.id = match_ratings.match_id
            AND (user_matches.user_id_1 = auth.uid() OR user_matches.user_id_2 = auth.uid())
        )
    );

-- ============================================================================
-- USER REFERRALS
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referred_email TEXT NOT NULL,
    referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'joined', 'active')),
    referral_code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(referrer_id, referred_email)
);

CREATE INDEX IF NOT EXISTS idx_user_referrals_referrer_id ON user_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_user_referrals_referral_code ON user_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_user_referrals_status ON user_referrals(status);

ALTER TABLE user_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own referrals" ON user_referrals;
CREATE POLICY "Users can manage own referrals"
    ON user_referrals FOR ALL
    USING (auth.uid() = referrer_id)
    WITH CHECK (auth.uid() = referrer_id);

-- ============================================================================
-- DAILY STREAKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    total_active_days INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own streaks" ON user_streaks;
CREATE POLICY "Users can view own streaks"
    ON user_streaks FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can manage user streaks" ON user_streaks;
CREATE POLICY "System can manage user streaks"
    ON user_streaks FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE saved_topics IS 'Topics saved by users for later reading';
COMMENT ON TABLE topic_reactions IS 'User reactions to topics for personalization';
COMMENT ON TABLE hidden_topics IS 'Topics or categories hidden by users';
COMMENT ON TABLE conversation_insights IS 'AI-generated insights from conversations';
COMMENT ON TABLE match_ratings IS 'User ratings and feedback for networking matches';
COMMENT ON TABLE user_referrals IS 'User referral tracking system';
COMMENT ON TABLE user_streaks IS 'User daily activity streaks';
