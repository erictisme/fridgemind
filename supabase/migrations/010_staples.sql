-- User staples: items they buy regularly and consider essential
-- Populated from receipt history analysis, can be manually edited
CREATE TABLE user_staples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- Normalized item name
  category TEXT, -- produce, dairy, protein, pantry, etc.
  purchase_count INTEGER DEFAULT 1, -- How many times purchased
  first_purchased_at TIMESTAMPTZ,
  last_purchased_at TIMESTAMPTZ,
  avg_purchase_frequency_days INTEGER, -- Average days between purchases
  is_staple BOOLEAN DEFAULT false, -- User-confirmed staple
  is_occasional BOOLEAN DEFAULT false, -- User-marked as occasional (challenge variety)
  never_suggest_alternative BOOLEAN DEFAULT false, -- Don't suggest alternatives for this
  notes TEXT, -- "We use this for X recipe"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index on lowercase name to prevent duplicates
CREATE UNIQUE INDEX idx_user_staples_unique_name ON user_staples(user_id, LOWER(name));

-- Track receipt analysis history to prevent re-analyzing
CREATE TABLE receipt_analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receipts_analyzed INTEGER DEFAULT 0,
  items_found INTEGER DEFAULT 0,
  staples_identified INTEGER DEFAULT 0,
  run_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_staples ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_analysis_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own staples" ON user_staples
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own analysis runs" ON receipt_analysis_runs
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_user_staples_user_id ON user_staples(user_id);
CREATE INDEX idx_user_staples_is_staple ON user_staples(is_staple);
CREATE INDEX idx_user_staples_purchase_count ON user_staples(purchase_count DESC);
CREATE INDEX idx_receipt_analysis_runs_user_id ON receipt_analysis_runs(user_id);
