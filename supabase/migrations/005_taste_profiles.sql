-- Taste profiles for cooking preferences (learned over time)
CREATE TABLE IF NOT EXISTS taste_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Onboarding data (explicit preferences)
  skill_level TEXT DEFAULT 'intermediate' CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  cooking_time_preference TEXT DEFAULT 'medium' CHECK (cooking_time_preference IN ('quick', 'medium', 'elaborate')),
  spice_tolerance TEXT DEFAULT 'medium' CHECK (spice_tolerance IN ('mild', 'medium', 'spicy', 'very_spicy')),

  -- Cuisine preferences (JSONB array of weighted preferences)
  -- Format: [{"cuisine": "italian", "weight": 0.8}, ...]
  cuisine_preferences JSONB DEFAULT '[]'::jsonb,

  -- Dietary restrictions (JSONB array)
  -- Format: ["vegetarian", "gluten-free", ...]
  dietary_restrictions JSONB DEFAULT '[]'::jsonb,

  -- AI-learned preferences (updated from meal photos)
  learned_ingredients JSONB DEFAULT '{}'::jsonb,  -- {ingredient: frequency_score}
  learned_cooking_methods JSONB DEFAULT '{}'::jsonb,  -- {method: frequency_score}

  -- Status
  onboarding_completed BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE taste_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only access their own taste profile
CREATE POLICY "Users can view own taste profile"
  ON taste_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own taste profile"
  ON taste_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own taste profile"
  ON taste_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER update_taste_profiles_updated_at
  BEFORE UPDATE ON taste_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
