-- Purchase History Schema for Receipt Tracking
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. RECEIPTS TABLE (stores uploaded receipt metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  store_name TEXT NOT NULL DEFAULT 'FairPrice',
  store_branch TEXT,
  receipt_date DATE NOT NULL,
  receipt_number TEXT,
  subtotal DECIMAL(10,2),
  gst DECIMAL(10,2),
  total DECIMAL(10,2) NOT NULL,
  payment_method TEXT,
  file_name TEXT,
  file_url TEXT,
  raw_ocr_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own receipts" ON receipts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own receipts" ON receipts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own receipts" ON receipts
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_receipts_user ON receipts(user_id);
CREATE INDEX idx_receipts_date ON receipts(receipt_date);
CREATE INDEX idx_receipts_store ON receipts(store_name);

-- ============================================
-- 2. RECEIPT ITEMS TABLE (individual line items)
-- ============================================
CREATE TABLE IF NOT EXISTS receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  item_code TEXT,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit TEXT DEFAULT 'pc',
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  category TEXT, -- 'produce', 'dairy', 'protein', 'pantry', 'beverage', 'household', 'other'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own receipt items" ON receipt_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own receipt items" ON receipt_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own receipt items" ON receipt_items
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_receipt_items_receipt ON receipt_items(receipt_id);
CREATE INDEX idx_receipt_items_user ON receipt_items(user_id);
CREATE INDEX idx_receipt_items_category ON receipt_items(category);
CREATE INDEX idx_receipt_items_date ON receipt_items(created_at);

-- ============================================
-- 3. SPENDING SUMMARY VIEW (for analytics)
-- ============================================
CREATE OR REPLACE VIEW spending_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', receipt_date) as month,
  store_name,
  COUNT(DISTINCT id) as receipt_count,
  SUM(total) as total_spent,
  AVG(total) as avg_per_trip
FROM receipts
GROUP BY user_id, DATE_TRUNC('month', receipt_date), store_name;

-- ============================================
-- 4. CATEGORY SPENDING VIEW
-- ============================================
CREATE OR REPLACE VIEW category_spending AS
SELECT
  ri.user_id,
  DATE_TRUNC('month', r.receipt_date) as month,
  ri.category,
  COUNT(*) as item_count,
  SUM(ri.total_price) as total_spent
FROM receipt_items ri
JOIN receipts r ON ri.receipt_id = r.id
GROUP BY ri.user_id, DATE_TRUNC('month', r.receipt_date), ri.category;
