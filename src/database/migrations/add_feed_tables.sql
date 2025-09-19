-- Batched feeds for TikTok-style experience
-- Tables: feed_batches (one per refresh) and feed_topics (items within a batch)

-- Feed batches: one active set per user per feed_type until next refresh
CREATE TABLE IF NOT EXISTS feed_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_type TEXT NOT NULL CHECK (feed_type IN ('interests','foryou')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  replaced_at TIMESTAMP WITH TIME ZONE
);

-- Feed topics: items that belong to a batch
CREATE TABLE IF NOT EXISTS feed_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES feed_batches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_type TEXT NOT NULL CHECK (feed_type IN ('interests','foryou')),
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  interests TEXT[] DEFAULT '{}',
  category TEXT,
  source_type TEXT CHECK (source_type IN ('news','evergreen','location','serendipity')),
  source_url TEXT,
  source_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  consumed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE feed_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_topics ENABLE ROW LEVEL SECURITY;

-- Policies: users can only manage their own feed data
DROP POLICY IF EXISTS "Users can view their own feed batches" ON feed_batches;
CREATE POLICY "Users can view their own feed batches" ON feed_batches
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own feed batches" ON feed_batches;
CREATE POLICY "Users can insert their own feed batches" ON feed_batches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own feed batches" ON feed_batches;
CREATE POLICY "Users can update their own feed batches" ON feed_batches
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own feed batches" ON feed_batches;
CREATE POLICY "Users can delete their own feed batches" ON feed_batches
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own feed topics" ON feed_topics;
CREATE POLICY "Users can view their own feed topics" ON feed_topics
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own feed topics" ON feed_topics;
CREATE POLICY "Users can insert their own feed topics" ON feed_topics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own feed topics" ON feed_topics;
CREATE POLICY "Users can update their own feed topics" ON feed_topics
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own feed topics" ON feed_topics;
CREATE POLICY "Users can delete their own feed topics" ON feed_topics
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for fast access
CREATE INDEX IF NOT EXISTS idx_feed_batches_user_type ON feed_batches(user_id, feed_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_topics_batch ON feed_topics(batch_id);
CREATE INDEX IF NOT EXISTS idx_feed_topics_user_type ON feed_topics(user_id, feed_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_topics_category ON feed_topics(category);
