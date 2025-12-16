-- Saved recipes from any source (Instagram, manual, AI suggestions)
CREATE TABLE IF NOT EXISTS saved_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL,
  source_url TEXT,
  source_account TEXT,
  image_url TEXT,
  ingredients JSONB DEFAULT '[]',
  instructions TEXT,
  estimated_time_minutes INTEGER,
  servings INTEGER DEFAULT 2,
  cuisine_type TEXT,
  tags JSONB DEFAULT '[]',
  is_favorite BOOLEAN DEFAULT false,
  times_cooked INTEGER DEFAULT 0,
  last_cooked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE saved_recipes ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage own recipes" ON saved_recipes
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_recipes_user_id ON saved_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_source_type ON saved_recipes(source_type);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_is_favorite ON saved_recipes(is_favorite);
