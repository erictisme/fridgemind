-- Add reason column to consumption_logs for tracking waste vs consumed
-- Run this in Supabase SQL Editor

ALTER TABLE consumption_logs
ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT 'consumed'; -- 'consumed' or 'wasted'

-- Add index for waste analysis queries
CREATE INDEX IF NOT EXISTS idx_consumption_reason ON consumption_logs(reason);
CREATE INDEX IF NOT EXISTS idx_consumption_user_reason ON consumption_logs(user_id, reason);
