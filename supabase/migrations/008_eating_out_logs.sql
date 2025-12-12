-- Eating out meal logs with nutrition estimates
CREATE TABLE IF NOT EXISTS eating_out_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- Meal details
  image_url TEXT,
  restaurant_name TEXT,
  meal_name TEXT,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),

  -- AI-estimated nutrition (rough estimates)
  estimated_calories INTEGER,
  protein_grams INTEGER,
  carbs_grams INTEGER,
  fat_grams INTEGER,
  fiber_grams INTEGER,
  vegetable_servings DECIMAL(3,1),  -- e.g., 1.5 servings

  -- AI analysis
  detected_components JSONB DEFAULT '[]'::jsonb,  -- ["grilled chicken", "rice", "salad"]
  health_assessment TEXT,  -- balanced, protein-heavy, carb-heavy, etc.
  ai_notes TEXT,

  -- User notes
  notes TEXT,

  -- Timestamps
  eaten_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE eating_out_logs ENABLE ROW LEVEL SECURITY;

-- Users can only access their own eating out logs
CREATE POLICY "Users can view own eating out logs"
  ON eating_out_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own eating out logs"
  ON eating_out_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own eating out logs"
  ON eating_out_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own eating out logs"
  ON eating_out_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Index for efficient date queries
CREATE INDEX idx_eating_out_logs_user_date ON eating_out_logs(user_id, eaten_at DESC);
