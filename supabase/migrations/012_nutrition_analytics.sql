-- Migration 012: Nutrition Analytics
-- Adds red flag tracking columns and daily summaries table

-- Extend eating_out_logs with nutrition flags
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS sodium_level TEXT; -- 'low'/'moderate'/'high'
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS is_fried BOOLEAN DEFAULT FALSE;
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS contains_red_meat BOOLEAN DEFAULT FALSE;
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS contains_processed_food BOOLEAN DEFAULT FALSE;
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS user_caption TEXT;
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS portion_divider INTEGER DEFAULT 1;
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'app'; -- 'app'/'telegram'/'quick_log'

-- Daily summaries for fast dashboard queries
CREATE TABLE IF NOT EXISTS nutrition_daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  total_calories INTEGER DEFAULT 0,
  total_protein INTEGER DEFAULT 0,
  total_carbs INTEGER DEFAULT 0,
  total_fat INTEGER DEFAULT 0,
  total_fiber INTEGER DEFAULT 0,
  total_vegetable_servings DECIMAL(4,1) DEFAULT 0,
  meals_logged INTEGER DEFAULT 0,
  home_meals INTEGER DEFAULT 0,
  restaurant_meals INTEGER DEFAULT 0,
  fried_food_count INTEGER DEFAULT 0,
  red_meat_count INTEGER DEFAULT 0,
  high_sodium_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_nutrition_daily_user_date ON nutrition_daily_summaries(user_id, date DESC);

-- RLS policies for nutrition_daily_summaries
ALTER TABLE nutrition_daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nutrition summaries"
  ON nutrition_daily_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrition summaries"
  ON nutrition_daily_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nutrition summaries"
  ON nutrition_daily_summaries FOR UPDATE
  USING (auth.uid() = user_id);
