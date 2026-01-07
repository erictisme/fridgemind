-- Rate Limits Table
-- Tracks API usage per user per day for rate limiting

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- UUID for users, 'GLOBAL' for global limits
  action TEXT NOT NULL,  -- 'scan', 'recipe_search', etc.
  date DATE NOT NULL,    -- The day this limit applies to
  count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one record per user/action/day
  UNIQUE(user_id, action, date)
);

-- Index for fast lookups
CREATE INDEX idx_rate_limits_lookup ON rate_limits(user_id, action, date);

-- Auto-cleanup: delete records older than 7 days (optional, saves space)
-- You can run this manually or set up a cron job
-- DELETE FROM rate_limits WHERE date < CURRENT_DATE - INTERVAL '7 days';

-- RLS: Allow authenticated users to read/write their own rate limit records
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own limits
CREATE POLICY "Users can view own rate limits" ON rate_limits
  FOR SELECT USING (user_id = auth.uid()::text OR user_id = 'GLOBAL');

-- Policy: Service role can do anything (for API routes)
CREATE POLICY "Service role full access" ON rate_limits
  FOR ALL USING (true);
