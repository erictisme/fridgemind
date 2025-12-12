-- Cooked meals log (for learning user preferences)
CREATE TABLE IF NOT EXISTS cooked_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- Meal details
  name TEXT NOT NULL,
  image_url TEXT,

  -- AI-extracted features for learning
  detected_ingredients JSONB DEFAULT '[]'::jsonb,  -- ["chicken", "broccoli", ...]
  cooking_method TEXT,  -- stir-fry, baked, grilled, etc.
  cuisine_type TEXT,  -- chinese, italian, etc.
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),

  -- User feedback
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  would_make_again BOOLEAN,
  notes TEXT,

  -- Timestamps
  cooked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE cooked_meals ENABLE ROW LEVEL SECURITY;

-- Users can only access their own cooked meals
CREATE POLICY "Users can view own cooked meals"
  ON cooked_meals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cooked meals"
  ON cooked_meals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cooked meals"
  ON cooked_meals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cooked meals"
  ON cooked_meals FOR DELETE
  USING (auth.uid() = user_id);

-- Index for efficient date queries
CREATE INDEX idx_cooked_meals_user_date ON cooked_meals(user_id, cooked_at DESC);
