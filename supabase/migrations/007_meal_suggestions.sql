-- Cached meal suggestions from AI
CREATE TABLE IF NOT EXISTS meal_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- Suggestion details
  name TEXT NOT NULL,
  description TEXT,
  recipe_summary TEXT,  -- Brief instructions
  estimated_time_minutes INTEGER,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),

  -- Ingredients analysis
  ingredients_available JSONB DEFAULT '[]'::jsonb,  -- Items from user's inventory
  ingredients_missing JSONB DEFAULT '[]'::jsonb,  -- Items they'd need to buy

  -- Priority scoring (higher = more urgent to cook)
  priority_score DECIMAL(5,2) DEFAULT 0,  -- Based on expiring items
  expiring_items_used JSONB DEFAULT '[]'::jsonb,  -- Which expiring items this uses

  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'cooked')),

  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE meal_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own suggestions
CREATE POLICY "Users can view own meal suggestions"
  ON meal_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal suggestions"
  ON meal_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal suggestions"
  ON meal_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal suggestions"
  ON meal_suggestions FOR DELETE
  USING (auth.uid() = user_id);

-- Index for active suggestions
CREATE INDEX idx_meal_suggestions_active ON meal_suggestions(user_id, status) WHERE status = 'active';
