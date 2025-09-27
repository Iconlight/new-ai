-- Add push tokens table for storing user device tokens
-- This enables sending push notifications to users when they receive messages

CREATE TABLE IF NOT EXISTS user_push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')) DEFAULT 'android',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, push_token)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_active ON user_push_tokens(is_active) WHERE is_active = true;

-- Row Level Security
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own push tokens
CREATE POLICY "Users can manage own push tokens" ON user_push_tokens
    FOR ALL USING (auth.uid() = user_id);

-- Trigger for updated_at column
CREATE TRIGGER update_user_push_tokens_updated_at 
    BEFORE UPDATE ON user_push_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old/inactive tokens
CREATE OR REPLACE FUNCTION cleanup_old_push_tokens()
RETURNS void AS $$
BEGIN
    -- Remove tokens older than 30 days that haven't been updated
    DELETE FROM user_push_tokens 
    WHERE updated_at < NOW() - INTERVAL '30 days' 
    AND is_active = false;
END;
$$ LANGUAGE plpgsql;
