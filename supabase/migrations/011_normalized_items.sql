-- Add normalized name and food type to receipt_items
-- normalized_name: AI-cleaned name like "Cherry Tomatoes" instead of "CHY TOM 250G"
-- food_type: Generic type like "tomato", "pork", "milk" for grouping similar items

ALTER TABLE receipt_items
ADD COLUMN normalized_name TEXT,
ADD COLUMN food_type TEXT;

-- Also add to user_staples for better grouping
ALTER TABLE user_staples
ADD COLUMN food_type TEXT;

-- Index for faster lookups
CREATE INDEX idx_receipt_items_normalized_name ON receipt_items(normalized_name);
CREATE INDEX idx_receipt_items_food_type ON receipt_items(food_type);
CREATE INDEX idx_user_staples_food_type ON user_staples(food_type);
