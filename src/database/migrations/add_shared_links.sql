-- Migration: Shared Links for deep linking and previews
-- Creates a table to store shareable slugs and associated context

CREATE TABLE IF NOT EXISTS shared_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('topic')),
  item_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  image_url TEXT,
  source_url TEXT,
  category TEXT,
  news_context JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shared_links_slug ON shared_links(slug);
CREATE INDEX IF NOT EXISTS idx_shared_links_item ON shared_links(item_type, item_id);

ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view shared links" ON shared_links;
CREATE POLICY "Anyone can view shared links"
  ON shared_links FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert shared links" ON shared_links;
CREATE POLICY "Users can insert shared links"
  ON shared_links FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE shared_links IS 'Stores shareable slugs and context for deep links and previews';
