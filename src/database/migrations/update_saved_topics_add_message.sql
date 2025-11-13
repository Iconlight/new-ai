-- Migration: Add topic_message and article_content columns to saved_topics table
-- Run this if you already ran add_engagement_features.sql

-- Add topic_message column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'saved_topics' AND column_name = 'topic_message'
    ) THEN
        ALTER TABLE saved_topics ADD COLUMN topic_message TEXT;
    END IF;
END $$;

-- Add article_content column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'saved_topics' AND column_name = 'article_content'
    ) THEN
        ALTER TABLE saved_topics ADD COLUMN article_content TEXT;
    END IF;
END $$;

COMMENT ON COLUMN saved_topics.topic_message IS 'The AI conversation starter message for this topic';
COMMENT ON COLUMN saved_topics.article_content IS 'The full RSS article content for context';
