import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface MealPlanInput {
  week_start: string
  breakfasts_home: number
  lunches_home: number
  dinners_home: number
  cravings: string[]
  notes: string
}

// Helper to get Monday of current week
function getMondayOfWeek(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
  const monday = new Date(d.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

// GET - Fetch meal plan for a specific week
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get week_start from query params, default to current week
    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('week_start')
    const weekStart = weekStartParam || getMondayOfWeek(new Date())

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('meal_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch meal plan' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mealPlan: data || null,
      weekStart,
    })
  } catch (error) {
    console.error('Meal plan fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meal plan' },
      { status: 500 }
    )
  }
}

// POST - Create a new meal plan
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as MealPlanInput

    if (!body.week_start) {
      return NextResponse.json({ error: 'week_start is required' }, { status: 400 })
    }

    // Check if meal plan already exists for this week
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('meal_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_start', body.week_start)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Meal plan already exists for this week. Use PUT to update.' },
        { status: 409 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('meal_plans')
      .insert({
        user_id: user.id,
        week_start: body.week_start,
        breakfasts_home: body.breakfasts_home || 0,
        lunches_home: body.lunches_home || 0,
        dinners_home: body.dinners_home || 0,
        cravings: body.cravings || [],
        notes: body.notes || '',
      })
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: 'Failed to create meal plan' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mealPlan: data,
      message: 'Meal plan created successfully',
    })
  } catch (error) {
    console.error('Meal plan create error:', error)
    return NextResponse.json(
      { error: 'Failed to create meal plan' },
      { status: 500 }
    )
  }
}

// PUT - Update existing meal plan
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as MealPlanInput

    if (!body.week_start) {
      return NextResponse.json({ error: 'week_start is required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('meal_plans')
      .update({
        breakfasts_home: body.breakfasts_home || 0,
        lunches_home: body.lunches_home || 0,
        dinners_home: body.dinners_home || 0,
        cravings: body.cravings || [],
        notes: body.notes || '',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('week_start', body.week_start)
      .select()
      .single()

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({ error: 'Failed to update meal plan' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mealPlan: data,
      message: 'Meal plan updated successfully',
    })
  } catch (error) {
    console.error('Meal plan update error:', error)
    return NextResponse.json(
      { error: 'Failed to update meal plan' },
      { status: 500 }
    )
  }
}
