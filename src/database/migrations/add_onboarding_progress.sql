-- Migration: Add onboarding progress tracking

CREATE TABLE IF NOT EXISTS user_onboarding_progress (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    signup BOOLEAN DEFAULT TRUE,
    first_topic_seen BOOLEAN DEFAULT FALSE,
    first_message_sent BOOLEAN DEFAULT FALSE,
    interests_selected BOOLEAN DEFAULT FALSE,
    networking_intro_seen BOOLEAN DEFAULT FALSE,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id ON user_onboarding_progress(user_id);

ALTER TABLE user_onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding progress"
    ON user_onboarding_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding progress"
    ON user_onboarding_progress FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE user_onboarding_progress IS 'Tracks user progress through onboarding steps';
