import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeNutrition } from '@/lib/gemini/vision'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { image, restaurant_name, meal_type, notes } = await request.json()

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // Analyze nutrition with Gemini
    const nutrition = await analyzeNutrition(image)

    // Save to database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('eating_out_logs')
      .insert({
        user_id: user.id,
        restaurant_name: restaurant_name || null,
        meal_name: nutrition.meal_name,
        meal_type: meal_type || null,
        estimated_calories: nutrition.estimated_calories,
        protein_grams: nutrition.protein_grams,
        carbs_grams: nutrition.carbs_grams,
        fat_grams: nutrition.fat_grams,
        fiber_grams: nutrition.fiber_grams,
        vegetable_servings: nutrition.vegetable_servings,
        detected_components: nutrition.detected_components,
        health_assessment: nutrition.health_assessment,
        ai_notes: nutrition.notes,
        notes: notes || null,
        eaten_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Save eating out error:', error)
      return NextResponse.json({ error: 'Failed to save meal' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      meal: data,
      nutrition,
    })
  } catch (error) {
    console.error('Eating out analysis error:', error)
    return NextResponse.json({ error: 'Failed to analyze meal' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('eating_out_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('eaten_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Fetch eating out error:', error)
      return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      meals: data || [],
    })
  } catch (error) {
    console.error('Eating out fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 })
  }
}
