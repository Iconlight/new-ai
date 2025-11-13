-- Add source_description column to feed_topics table
-- This stores the RSS feed description/summary for articles

ALTER TABLE feed_topics 
ADD COLUMN IF NOT EXISTS source_description TEXT;

COMMENT ON COLUMN feed_topics.source_description IS 'Article description/summary from RSS feed';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'feed_topics'
  AND column_name = 'source_description';
