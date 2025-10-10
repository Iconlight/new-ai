-- Migration: Add news_context column to chats table
-- This stores the news article context for AI conversations

-- Add news_context column to store article information
ALTER TABLE chats 
ADD COLUMN IF NOT EXISTS news_context JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN chats.news_context IS 'Stores news article context (title, description, url, category) for grounding AI conversations';

-- Create index for faster queries on news-based chats
CREATE INDEX IF NOT EXISTS idx_chats_news_context ON chats USING GIN (news_context);

-- Example of news_context structure:
-- {
--   "title": "Article Title",
--   "description": "Article description...",
--   "url": "https://example.com/article",
--   "category": "technology"
-- }
