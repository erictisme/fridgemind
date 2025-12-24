import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    // Fetch meals for the month
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mealsData, error } = await (supabase as any)
      .from('eating_out_logs')
      .select('id, meal_name, meal_type, restaurant_name, image_url, eaten_at, estimated_calories, protein_grams, carbs_grams, fat_grams, health_assessment, source')
      .eq('user_id', user.id)
      .gte('eaten_at', startDate.toISOString())
      .lte('eaten_at', endDate.toISOString())
      .order('eaten_at', { ascending: false })

    if (error) {
      console.error('Fetch meals error:', error)
      return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 })
    }

    // Group meals by date
    const meals: Record<string, typeof mealsData> = {}
    const calendar: Record<string, number> = {}

    for (const meal of mealsData || []) {
      const dateKey = new Date(meal.eaten_at).toISOString().split('T')[0]

      if (!meals[dateKey]) {
        meals[dateKey] = []
      }
      meals[dateKey].push(meal)

      calendar[dateKey] = (calendar[dateKey] || 0) + 1
    }

    return NextResponse.json({
      meals,
      calendar,
    })
  } catch (error) {
    console.error('Meals fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      meal_name,
      meal_type,
      restaurant_name,
      image_url,
      eaten_at,
      estimated_calories,
      protein_grams,
      carbs_grams,
      fat_grams,
      fiber_grams,
      vegetable_servings,
      detected_components,
      health_assessment,
      notes,
      source,
      fatsecret_food_id,
      nutrition_source,
    } = body

    if (!meal_name) {
      return NextResponse.json({ error: 'Meal name is required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('eating_out_logs')
      .insert({
        user_id: user.id,
        meal_name,
        meal_type: meal_type || null,
        restaurant_name: restaurant_name || null,
        image_url: image_url || null,
        eaten_at: eaten_at || new Date().toISOString(),
        estimated_calories: estimated_calories || null,
        protein_grams: protein_grams || null,
        carbs_grams: carbs_grams || null,
        fat_grams: fat_grams || null,
        fiber_grams: fiber_grams || null,
        vegetable_servings: vegetable_servings || null,
        detected_components: detected_components || null,
        health_assessment: health_assessment || null,
        notes: notes || null,
        source: source || 'app',
        fatsecret_food_id: fatsecret_food_id || null,
        nutrition_source: nutrition_source || 'manual',
      })
      .select()
      .single()

    if (error) {
      console.error('Save meal error:', error)
      return NextResponse.json({ error: 'Failed to save meal' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      meal: data,
    })
  } catch (error) {
    console.error('Meal save error:', error)
    return NextResponse.json({ error: 'Failed to save meal' }, { status: 500 })
  }
}
