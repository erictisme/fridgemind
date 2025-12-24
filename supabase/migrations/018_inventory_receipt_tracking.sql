-- Add receipt tracking to inventory_items
-- Allows users to undo bulk imports from receipts

-- Add columns to track which receipt items came from
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS source_receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS added_from_receipt_at TIMESTAMPTZ;

-- Index for quick lookup by receipt_id
CREATE INDEX IF NOT EXISTS idx_inventory_source_receipt ON inventory_items(source_receipt_id) WHERE source_receipt_id IS NOT NULL;

-- Index for quick lookup of recent imports (for time-based undo restrictions)
CREATE INDEX IF NOT EXISTS idx_inventory_receipt_added_at ON inventory_items(added_from_receipt_at) WHERE added_from_receipt_at IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN inventory_items.source_receipt_id IS 'References the receipt that was used to add this item to inventory (null if manually added)';
COMMENT ON COLUMN inventory_items.added_from_receipt_at IS 'Timestamp when this item was added from a receipt (used to enforce undo time limits)';
