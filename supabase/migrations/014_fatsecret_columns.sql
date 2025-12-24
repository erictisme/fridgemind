-- Add FatSecret integration columns to eating_out_logs
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS fatsecret_food_id BIGINT;
ALTER TABLE eating_out_logs ADD COLUMN IF NOT EXISTS nutrition_source TEXT DEFAULT 'gemini';

-- Add comment for documentation
COMMENT ON COLUMN eating_out_logs.fatsecret_food_id IS 'FatSecret food_id for verified nutrition data';
COMMENT ON COLUMN eating_out_logs.nutrition_source IS 'Source of nutrition data: gemini, fatsecret, or manual';

-- Create index for nutrition source queries
CREATE INDEX IF NOT EXISTS idx_eating_out_logs_nutrition_source
ON eating_out_logs(nutrition_source) WHERE nutrition_source IS NOT NULL;
