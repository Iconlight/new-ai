-- Create networking intelligence chats table
CREATE TABLE IF NOT EXISTS networking_intelligence_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES user_matches(id) ON DELETE CASCADE,
  
  messages JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, target_user_id)
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_intelligence_chats_user 
  ON networking_intelligence_chats(user_id, target_user_id);

CREATE INDEX IF NOT EXISTS idx_intelligence_chats_match
  ON networking_intelligence_chats(match_id);

-- Enable RLS
ALTER TABLE networking_intelligence_chats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own intelligence chats"
  ON networking_intelligence_chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create intelligence chats"
  ON networking_intelligence_chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own intelligence chats"
  ON networking_intelligence_chats FOR UPDATE
  USING (auth.uid() = user_id);

-- Add privacy settings to user_networking_preferences
ALTER TABLE user_networking_preferences 
  ADD COLUMN IF NOT EXISTS allow_intelligence_analysis BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS intelligence_detail_level TEXT DEFAULT 'detailed' CHECK (intelligence_detail_level IN ('basic', 'detailed'));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_networking_intelligence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_networking_intelligence_chats_updated_at
  BEFORE UPDATE ON networking_intelligence_chats
  FOR EACH ROW
  EXECUTE FUNCTION update_networking_intelligence_updated_at();
