-- Migration: Add analytics events table
-- This table stores all user interaction events for analysis and improvement

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_event ON analytics_events(user_id, event_type);

-- Create index on JSONB properties for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_properties ON analytics_events USING gin(properties);

-- Enable RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can only read their own events
CREATE POLICY "Users can view own analytics events"
    ON analytics_events FOR SELECT
    USING (auth.uid() = user_id);

-- Anyone authenticated can insert events (for their own userId or anonymous)
CREATE POLICY "Authenticated users can insert analytics events"
    ON analytics_events FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        (user_id = auth.uid() OR user_id IS NULL)
    );

-- Add comment
COMMENT ON TABLE analytics_events IS 'Stores user interaction events for analytics and product improvements';
