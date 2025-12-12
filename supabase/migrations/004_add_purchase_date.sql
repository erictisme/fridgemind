-- Add purchase_date column to inventory_items
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS purchase_date DATE;

-- Optionally backfill existing items with created_at date as purchase date
-- UPDATE inventory_items SET purchase_date = created_at::date WHERE purchase_date IS NULL;
