import { createClient } from '@/lib/supabase/server'

// Rate limits per user per day
export const RATE_LIMITS = {
  scan: 15,           // 15 scans per day (uses Gemini vision)
  recipe_search: 30,  // 30 recipe searches per day (uses YouTube API)
  recipe_generate: 10, // 10 AI recipe generations per day
  nutrition_estimate: 20, // 20 nutrition estimates per day
  expiry_estimate: 30, // 30 expiry estimates per day
} as const

export type RateLimitAction = keyof typeof RATE_LIMITS

// Global daily limits (emergency brake for all users combined)
export const GLOBAL_LIMITS = {
  scan: 500,           // 500 total scans per day
  recipe_search: 100,  // 100 YouTube searches per day (YouTube API is very limited)
  recipe_generate: 300,
  nutrition_estimate: 500,
  expiry_estimate: 500,
} as const

interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  resetAt: Date
}

// Get today's date key (YYYY-MM-DD in UTC)
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]
}

// Check and increment rate limit for a user
export async function checkRateLimit(
  userId: string,
  action: RateLimitAction
): Promise<RateLimitResult> {
  const supabase = await createClient()
  const today = getTodayKey()
  const limit = RATE_LIMITS[action]

  // Get current usage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('rate_limits')
    .select('count')
    .eq('user_id', userId)
    .eq('action', action)
    .eq('date', today)
    .single()

  const currentCount = existing?.count || 0
  const remaining = Math.max(0, limit - currentCount)

  // Calculate reset time (midnight UTC)
  const resetAt = new Date(today)
  resetAt.setUTCDate(resetAt.getUTCDate() + 1)
  resetAt.setUTCHours(0, 0, 0, 0)

  if (currentCount >= limit) {
    return { allowed: false, remaining: 0, limit, resetAt }
  }

  // Increment usage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (existing) {
    await (supabase as any)
      .from('rate_limits')
      .update({ count: currentCount + 1 })
      .eq('user_id', userId)
      .eq('action', action)
      .eq('date', today)
  } else {
    await (supabase as any)
      .from('rate_limits')
      .insert({ user_id: userId, action, date: today, count: 1 })
  }

  return { allowed: true, remaining: remaining - 1, limit, resetAt }
}

// Check global rate limit (for expensive APIs like YouTube)
export async function checkGlobalRateLimit(
  action: RateLimitAction
): Promise<RateLimitResult> {
  const supabase = await createClient()
  const today = getTodayKey()
  const limit = GLOBAL_LIMITS[action]

  // Get current global usage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('rate_limits')
    .select('count')
    .eq('user_id', 'GLOBAL')
    .eq('action', action)
    .eq('date', today)
    .single()

  const currentCount = existing?.count || 0
  const remaining = Math.max(0, limit - currentCount)

  const resetAt = new Date(today)
  resetAt.setUTCDate(resetAt.getUTCDate() + 1)
  resetAt.setUTCHours(0, 0, 0, 0)

  if (currentCount >= limit) {
    return { allowed: false, remaining: 0, limit, resetAt }
  }

  // Increment global usage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (existing) {
    await (supabase as any)
      .from('rate_limits')
      .update({ count: currentCount + 1 })
      .eq('user_id', 'GLOBAL')
      .eq('action', action)
      .eq('date', today)
  } else {
    await (supabase as any)
      .from('rate_limits')
      .insert({ user_id: 'GLOBAL', action, date: today, count: 1 })
  }

  return { allowed: true, remaining: remaining - 1, limit, resetAt }
}

// Combined check: user limit + global limit
export async function checkBothLimits(
  userId: string,
  action: RateLimitAction
): Promise<RateLimitResult & { globalLimitHit?: boolean }> {
  // Check global limit first (for expensive APIs)
  if (action === 'recipe_search') {
    const globalResult = await checkGlobalRateLimit(action)
    if (!globalResult.allowed) {
      return { ...globalResult, globalLimitHit: true }
    }
  }

  // Then check user limit
  return checkRateLimit(userId, action)
}

// Helper to format remaining time
export function formatTimeUntilReset(resetAt: Date): string {
  const now = new Date()
  const diff = resetAt.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}
