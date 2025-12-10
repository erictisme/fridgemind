-- FridgeMind Initial Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- ============================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  household_size INTEGER DEFAULT 1,
  dietary_preferences JSONB DEFAULT '[]'::jsonb,
  notification_preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. INVENTORY ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  storage_category TEXT NOT NULL, -- 'produce', 'dairy', 'protein', 'pantry', 'beverage', 'condiment', 'frozen'
  nutritional_type TEXT, -- 'vegetables', 'protein', 'carbs', 'vitamins', 'fats', 'other'
  location TEXT NOT NULL, -- 'fridge', 'freezer', 'pantry'
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT, -- 'piece', 'lb', 'oz', 'gallon', 'bunch', etc.
  expiry_date DATE,
  freshness TEXT DEFAULT 'fresh', -- 'fresh', 'use_soon', 'expired'
  confidence DECIMAL(3,2), -- AI confidence score (0.00-1.00)
  image_url TEXT,
  notes TEXT,
  is_staple BOOLEAN DEFAULT FALSE, -- auto-reorder item
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  consumed_at TIMESTAMPTZ -- when item was marked as used/consumed
);

-- Enable RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Policies for inventory_items
CREATE POLICY "Users can view own inventory" ON inventory_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own inventory" ON inventory_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own inventory" ON inventory_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own inventory" ON inventory_items
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_inventory_user ON inventory_items(user_id);
CREATE INDEX idx_inventory_expiry ON inventory_items(expiry_date);
CREATE INDEX idx_inventory_location ON inventory_items(location);
CREATE INDEX idx_inventory_freshness ON inventory_items(freshness);

-- ============================================
-- 3. SCAN SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  location TEXT NOT NULL, -- what was scanned (fridge, freezer, pantry)
  image_urls TEXT[] NOT NULL,
  raw_ai_response JSONB,
  items_detected INTEGER DEFAULT 0,
  items_confirmed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for scan_sessions
CREATE POLICY "Users can view own scan sessions" ON scan_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scan sessions" ON scan_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 4. MEAL PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  breakfasts_home INTEGER DEFAULT 0,
  lunches_home INTEGER DEFAULT 0,
  dinners_home INTEGER DEFAULT 0,
  cravings TEXT[], -- array of desired dishes/cuisines
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

-- Policies for meal_plans
CREATE POLICY "Users can manage own meal plans" ON meal_plans
  FOR ALL USING (auth.uid() = user_id);

-- Unique constraint: one plan per week per user
CREATE UNIQUE INDEX idx_meal_plans_user_week ON meal_plans(user_id, week_start);

-- ============================================
-- 5. SHOPPING LISTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT DEFAULT 'Shopping List',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;

-- Policies for shopping_lists
CREATE POLICY "Users can manage own shopping lists" ON shopping_lists
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 6. SHOPPING LIST ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES shopping_lists(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL, -- denormalized for RLS
  name TEXT NOT NULL,
  category TEXT,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT,
  is_checked BOOLEAN DEFAULT FALSE,
  source TEXT, -- 'auto_restock', 'expiring', 'meal_plan', 'manual', 'craving'
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

-- Policies for shopping_list_items
CREATE POLICY "Users can manage own shopping list items" ON shopping_list_items
  FOR ALL USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_shopping_items_list ON shopping_list_items(list_id);

-- ============================================
-- 7. CONSUMPTION LOGS TABLE (for predictions)
-- ============================================
CREATE TABLE IF NOT EXISTS consumption_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity_consumed DECIMAL(10,2) DEFAULT 1,
  consumed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE consumption_logs ENABLE ROW LEVEL SECURITY;

-- Policies for consumption_logs
CREATE POLICY "Users can manage own consumption logs" ON consumption_logs
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_consumption_user ON consumption_logs(user_id);
CREATE INDEX idx_consumption_date ON consumption_logs(consumed_at);

-- ============================================
-- 8. TRIGGER: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 9. TRIGGER: Auto-update updated_at timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_plans_updated_at
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_lists_updated_at
  BEFORE UPDATE ON shopping_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. STORAGE BUCKET FOR IMAGES
-- ============================================
-- Note: Run this in Supabase Dashboard > Storage > Create bucket
-- Bucket name: fridge-photos
-- Public: No (private bucket)
-- Allowed MIME types: image/jpeg, image/png, image/webp
-- File size limit: 10MB
