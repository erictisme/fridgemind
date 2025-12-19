import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface DailySummary {
  date: string
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  total_fiber: number
  total_vegetable_servings: number
  meals_logged: number
  home_meals: number
  restaurant_meals: number
  fried_food_count: number
  red_meat_count: number
  high_sodium_count: number
}

interface NutritionSummaryResponse {
  period: 'daily' | 'weekly' | 'monthly'
  start_date: string
  end_date: string
  totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    vegetable_servings: number
    meals_logged: number
    home_meals: number
    restaurant_meals: number
  }
  averages: {
    calories_per_day: number
    protein_per_day: number
    carbs_per_day: number
    fat_per_day: number
    fiber_per_day: number
    vegetable_servings_per_day: number
  }
  red_flags: {
    fried_food_count: number
    red_meat_count: number
    high_sodium_count: number
  }
  daily_breakdown: DailySummary[]
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = (searchParams.get('period') || 'weekly') as 'daily' | 'weekly' | 'monthly'
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Calculate date range based on period
    const endDate = new Date(dateParam)
    const startDate = new Date(dateParam)

    switch (period) {
      case 'daily':
        // Just today
        break
      case 'weekly':
        startDate.setDate(startDate.getDate() - 6) // Last 7 days
        break
      case 'monthly':
        startDate.setDate(startDate.getDate() - 29) // Last 30 days
        break
    }

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Fetch meals from eating_out_logs for the period
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: meals, error } = await (supabase as any)
      .from('eating_out_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('eaten_at', `${startDateStr}T00:00:00`)
      .lte('eaten_at', `${endDateStr}T23:59:59`)
      .order('eaten_at', { ascending: true })

    if (error) {
      console.error('Error fetching meals:', error)
      return NextResponse.json({ error: 'Failed to fetch nutrition data' }, { status: 500 })
    }

    // Aggregate by day
    const dailyMap = new Map<string, DailySummary>()

    for (const meal of meals || []) {
      const mealDate = new Date(meal.eaten_at).toISOString().split('T')[0]

      if (!dailyMap.has(mealDate)) {
        dailyMap.set(mealDate, {
          date: mealDate,
          total_calories: 0,
          total_protein: 0,
          total_carbs: 0,
          total_fat: 0,
          total_fiber: 0,
          total_vegetable_servings: 0,
          meals_logged: 0,
          home_meals: 0,
          restaurant_meals: 0,
          fried_food_count: 0,
          red_meat_count: 0,
          high_sodium_count: 0,
        })
      }

      const day = dailyMap.get(mealDate)!
      day.total_calories += meal.estimated_calories || 0
      day.total_protein += meal.protein_grams || 0
      day.total_carbs += meal.carbs_grams || 0
      day.total_fat += meal.fat_grams || 0
      day.total_fiber += meal.fiber_grams || 0
      day.total_vegetable_servings += parseFloat(meal.vegetable_servings) || 0
      day.meals_logged += 1

      if (meal.meal_type === 'home_cooked') {
        day.home_meals += 1
      } else {
        day.restaurant_meals += 1
      }

      // Red flags
      if (meal.is_fried) day.fried_food_count += 1
      if (meal.contains_red_meat) day.red_meat_count += 1
      if (meal.sodium_level === 'high') day.high_sodium_count += 1
    }

    const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    )

    // Calculate totals
    const totals = dailyBreakdown.reduce(
      (acc, day) => ({
        calories: acc.calories + day.total_calories,
        protein: acc.protein + day.total_protein,
        carbs: acc.carbs + day.total_carbs,
        fat: acc.fat + day.total_fat,
        fiber: acc.fiber + day.total_fiber,
        vegetable_servings: acc.vegetable_servings + day.total_vegetable_servings,
        meals_logged: acc.meals_logged + day.meals_logged,
        home_meals: acc.home_meals + day.home_meals,
        restaurant_meals: acc.restaurant_meals + day.restaurant_meals,
      }),
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        vegetable_servings: 0,
        meals_logged: 0,
        home_meals: 0,
        restaurant_meals: 0,
      }
    )

    // Calculate red flag totals
    const redFlags = dailyBreakdown.reduce(
      (acc, day) => ({
        fried_food_count: acc.fried_food_count + day.fried_food_count,
        red_meat_count: acc.red_meat_count + day.red_meat_count,
        high_sodium_count: acc.high_sodium_count + day.high_sodium_count,
      }),
      { fried_food_count: 0, red_meat_count: 0, high_sodium_count: 0 }
    )

    // Calculate averages (based on number of days in period)
    const daysInPeriod = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30
    const daysWithData = dailyBreakdown.length || 1

    const averages = {
      calories_per_day: Math.round(totals.calories / daysWithData),
      protein_per_day: Math.round(totals.protein / daysWithData),
      carbs_per_day: Math.round(totals.carbs / daysWithData),
      fat_per_day: Math.round(totals.fat / daysWithData),
      fiber_per_day: Math.round(totals.fiber / daysWithData),
      vegetable_servings_per_day: Math.round((totals.vegetable_servings / daysWithData) * 10) / 10,
    }

    const response: NutritionSummaryResponse = {
      period,
      start_date: startDateStr,
      end_date: endDateStr,
      totals,
      averages,
      red_flags: redFlags,
      daily_breakdown: dailyBreakdown,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Nutrition summary error:', error)
    return NextResponse.json({ error: 'Failed to fetch nutrition summary' }, { status: 500 })
  }
}
