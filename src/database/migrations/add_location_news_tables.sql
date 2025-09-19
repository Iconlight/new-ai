-- Add tables for location, news, and proactive topics functionality

-- Proactive topics table for storing AI-generated conversation starters
CREATE TABLE IF NOT EXISTS proactive_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  interests TEXT[] DEFAULT '{}',
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User locations table for learning home/work/travel patterns
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  location_type TEXT NOT NULL CHECK (location_type IN ('home', 'work', 'travel', 'unknown')),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  address TEXT,
  confidence DECIMAL(3, 2) DEFAULT 0.5,
  visit_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, latitude, longitude)
);

-- News articles cache table
CREATE TABLE IF NOT EXISTS news_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  source TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE proactive_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- Proactive topics policies
DROP POLICY IF EXISTS "Users can view their own proactive topics" ON proactive_topics;
CREATE POLICY "Users can view their own proactive topics" ON proactive_topics
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own proactive topics" ON proactive_topics;
CREATE POLICY "Users can insert their own proactive topics" ON proactive_topics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own proactive topics" ON proactive_topics;
CREATE POLICY "Users can update their own proactive topics" ON proactive_topics
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own proactive topics" ON proactive_topics;
CREATE POLICY "Users can delete their own proactive topics" ON proactive_topics
  FOR DELETE USING (auth.uid() = user_id);

-- User locations policies
DROP POLICY IF EXISTS "Users can view their own locations" ON user_locations;
CREATE POLICY "Users can view their own locations" ON user_locations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own locations" ON user_locations;
CREATE POLICY "Users can insert their own locations" ON user_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own locations" ON user_locations;
CREATE POLICY "Users can update their own locations" ON user_locations
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own locations" ON user_locations;
CREATE POLICY "Users can delete their own locations" ON user_locations
  FOR DELETE USING (auth.uid() = user_id);

-- News articles policies (read-only for all authenticated users)
DROP POLICY IF EXISTS "Authenticated users can view news articles" ON news_articles;
CREATE POLICY "Authenticated users can view news articles" ON news_articles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service can insert news articles" ON news_articles;
CREATE POLICY "Service can insert news articles" ON news_articles
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update news articles" ON news_articles;
CREATE POLICY "Service can update news articles" ON news_articles
  FOR UPDATE USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_proactive_topics_user_id ON proactive_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_proactive_topics_scheduled ON proactive_topics(scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_proactive_topics_sent ON proactive_topics(is_sent);
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_type ON user_locations(location_type);
CREATE INDEX IF NOT EXISTS idx_user_locations_coords ON user_locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_news_articles_published ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_category ON news_articles(category);
CREATE INDEX IF NOT EXISTS idx_news_articles_external_id ON news_articles(external_id);

-- Ensure sent_at column exists for proactive topics updates
ALTER TABLE proactive_topics
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;
