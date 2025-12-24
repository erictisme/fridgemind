-- Add notes and recipe_group columns to shopping_list_items
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS recipe_group TEXT;

-- Add index for better query performance when filtering by recipe_group
CREATE INDEX IF NOT EXISTS idx_shopping_items_recipe_group ON shopping_list_items(recipe_group);

COMMENT ON COLUMN shopping_list_items.notes IS 'Optional notes about what to buy, e.g. "get Olivado brand" or "cold pressed if available"';
COMMENT ON COLUMN shopping_list_items.recipe_group IS 'Optional recipe or meal name that groups related ingredients together';
