-- Eating out meal logs with nutrition estimates (fully idempotent)

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS eating_out_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT,
  restaurant_name TEXT,
  meal_name TEXT,
  meal_type TEXT,
  estimated_calories INTEGER,
  protein_grams INTEGER,
  carbs_grams INTEGER,
  fat_grams INTEGER,
  fiber_grams INTEGER,
  vegetable_servings DECIMAL(3,1),
  detected_components JSONB DEFAULT '[]'::jsonb,
  health_assessment TEXT,
  ai_notes TEXT,
  notes TEXT,
  eaten_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sodium_level TEXT,
  is_fried BOOLEAN DEFAULT FALSE,
  contains_red_meat BOOLEAN DEFAULT FALSE,
  contains_processed_food BOOLEAN DEFAULT FALSE,
  user_caption TEXT,
  portion_divider INTEGER DEFAULT 1,
  source TEXT DEFAULT 'app'
);

-- Drop the restrictive constraint that only allowed breakfast/lunch/dinner/snack
ALTER TABLE eating_out_logs DROP CONSTRAINT IF EXISTS eating_out_logs_meal_type_check;

-- Add columns if they don't exist (for existing tables)
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS sodium_level TEXT;
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS is_fried BOOLEAN DEFAULT FALSE;
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS contains_red_meat BOOLEAN DEFAULT FALSE;
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS contains_processed_food BOOLEAN DEFAULT FALSE;
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS user_caption TEXT;
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS portion_divider INTEGER DEFAULT 1;
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'app';

-- Enable RLS
ALTER TABLE eating_out_logs ENABLE ROW LEVEL SECURITY;

-- Idempotent policies using DO block
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eating_out_logs' AND policyname = 'Users can view own eating out logs') THEN
    CREATE POLICY "Users can view own eating out logs" ON eating_out_logs FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eating_out_logs' AND policyname = 'Users can insert own eating out logs') THEN
    CREATE POLICY "Users can insert own eating out logs" ON eating_out_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eating_out_logs' AND policyname = 'Users can update own eating out logs') THEN
    CREATE POLICY "Users can update own eating out logs" ON eating_out_logs FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eating_out_logs' AND policyname = 'Users can delete own eating out logs') THEN
    CREATE POLICY "Users can delete own eating out logs" ON eating_out_logs FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_eating_out_logs_user_date ON eating_out_logs(user_id, eaten_at DESC);
