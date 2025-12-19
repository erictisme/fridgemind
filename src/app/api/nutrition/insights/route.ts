import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface NutritionInsight {
  type: 'red_flag' | 'positive' | 'recommendation'
  severity: 'info' | 'warning' | 'critical'
  icon: string
  title: string
  message: string
}

// Default thresholds (will be replaced by user's health_profiles settings later)
const DEFAULT_THRESHOLDS = {
  max_red_meat_weekly: 3,
  max_fried_food_weekly: 2,
  max_high_sodium_weekly: 3,
  min_vegetable_servings_daily: 3,
  min_fiber_daily: 25,
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get last 7 days of meals
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 6)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: meals, error } = await (supabase as any)
      .from('eating_out_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('eaten_at', `${startDateStr}T00:00:00`)
      .lte('eaten_at', `${endDateStr}T23:59:59`)

    if (error) {
      console.error('Error fetching meals for insights:', error)
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
    }

    const insights: NutritionInsight[] = []

    if (!meals || meals.length === 0) {
      insights.push({
        type: 'recommendation',
        severity: 'info',
        icon: '📝',
        title: 'Start Logging',
        message: 'Log your meals to get personalized nutrition insights!',
      })
      return NextResponse.json({ insights })
    }

    // Calculate weekly stats
    const weekStats = {
      total_calories: 0,
      total_protein: 0,
      total_fiber: 0,
      total_vegetable_servings: 0,
      meals_count: meals.length,
      fried_food_count: 0,
      red_meat_count: 0,
      high_sodium_count: 0,
      days_with_data: new Set<string>(),
    }

    for (const meal of meals) {
      weekStats.total_calories += meal.estimated_calories || 0
      weekStats.total_protein += meal.protein_grams || 0
      weekStats.total_fiber += meal.fiber_grams || 0
      weekStats.total_vegetable_servings += parseFloat(meal.vegetable_servings) || 0
      if (meal.is_fried) weekStats.fried_food_count += 1
      if (meal.contains_red_meat) weekStats.red_meat_count += 1
      if (meal.sodium_level === 'high') weekStats.high_sodium_count += 1
      weekStats.days_with_data.add(new Date(meal.eaten_at).toISOString().split('T')[0])
    }

    const daysWithData = weekStats.days_with_data.size || 1
    const avgVeggiesPerDay = weekStats.total_vegetable_servings / daysWithData
    const avgFiberPerDay = weekStats.total_fiber / daysWithData

    // RED FLAGS
    if (weekStats.red_meat_count > DEFAULT_THRESHOLDS.max_red_meat_weekly) {
      insights.push({
        type: 'red_flag',
        severity: 'warning',
        icon: '🥩',
        title: 'High Red Meat Intake',
        message: `You've had red meat ${weekStats.red_meat_count}× this week (goal: ≤${DEFAULT_THRESHOLDS.max_red_meat_weekly}). Consider plant-based proteins like tofu, beans, or lentils.`,
      })
    }

    if (weekStats.fried_food_count > DEFAULT_THRESHOLDS.max_fried_food_weekly) {
      insights.push({
        type: 'red_flag',
        severity: 'warning',
        icon: '🍟',
        title: 'High Fried Food Intake',
        message: `You've had fried food ${weekStats.fried_food_count}× this week (goal: ≤${DEFAULT_THRESHOLDS.max_fried_food_weekly}). Try grilled, steamed, or baked alternatives.`,
      })
    }

    if (weekStats.high_sodium_count > DEFAULT_THRESHOLDS.max_high_sodium_weekly) {
      insights.push({
        type: 'red_flag',
        severity: 'warning',
        icon: '🧂',
        title: 'High Sodium Meals',
        message: `${weekStats.high_sodium_count} high-sodium meals this week (goal: ≤${DEFAULT_THRESHOLDS.max_high_sodium_weekly}). Watch out for soy sauce, processed foods, and heavy sauces.`,
      })
    }

    // POSITIVE FEEDBACK
    if (avgVeggiesPerDay >= DEFAULT_THRESHOLDS.min_vegetable_servings_daily) {
      insights.push({
        type: 'positive',
        severity: 'info',
        icon: '🥬',
        title: 'Great Veggie Intake!',
        message: `Averaging ${avgVeggiesPerDay.toFixed(1)} vegetable servings per day. Keep it up for gut health!`,
      })
    }

    if (avgFiberPerDay >= DEFAULT_THRESHOLDS.min_fiber_daily) {
      insights.push({
        type: 'positive',
        severity: 'info',
        icon: '🌾',
        title: 'Excellent Fiber Intake',
        message: `Averaging ${Math.round(avgFiberPerDay)}g of fiber per day. Great for digestion!`,
      })
    }

    if (weekStats.red_meat_count <= 1 && weekStats.meals_count >= 5) {
      insights.push({
        type: 'positive',
        severity: 'info',
        icon: '🌱',
        title: 'Low Red Meat Week',
        message: 'Great job limiting red meat intake this week! This is linked to better heart health.',
      })
    }

    // RECOMMENDATIONS
    if (avgVeggiesPerDay < DEFAULT_THRESHOLDS.min_vegetable_servings_daily && weekStats.meals_count >= 3) {
      insights.push({
        type: 'recommendation',
        severity: 'info',
        icon: '🥗',
        title: 'Add More Vegetables',
        message: `Only averaging ${avgVeggiesPerDay.toFixed(1)} veggie servings/day. Try adding a salad or veggie side to each meal.`,
      })
    }

    if (avgFiberPerDay < DEFAULT_THRESHOLDS.min_fiber_daily && weekStats.meals_count >= 3) {
      insights.push({
        type: 'recommendation',
        severity: 'info',
        icon: '🫘',
        title: 'Boost Your Fiber',
        message: `Only ${Math.round(avgFiberPerDay)}g fiber/day (goal: ${DEFAULT_THRESHOLDS.min_fiber_daily}g). Try beans, whole grains, or fruit.`,
      })
    }

    // Sort insights: red flags first, then recommendations, then positive
    const priorityOrder = { red_flag: 0, recommendation: 1, positive: 2 }
    insights.sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type])

    return NextResponse.json({
      insights,
      period: {
        start: startDateStr,
        end: endDateStr,
        days_with_data: daysWithData,
        meals_logged: weekStats.meals_count,
      },
    })
  } catch (error) {
    console.error('Nutrition insights error:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
