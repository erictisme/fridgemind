import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
      meal_source, // 'home_cooked' | 'restaurant'
      meal_time, // 'breakfast' | 'lunch' | 'dinner' | 'snack'
      eaten_at,
      household_member,
      portion_percentage,
      divide_by,
      estimated_calories,
      protein_grams,
      carbs_grams,
      fat_grams,
      fiber_grams,
      vegetable_servings,
      detected_components,
      health_assessment,
      ai_notes,
      image_url,
    } = body

    // Build insert data
    const insertData: Record<string, unknown> = {
      user_id: user.id,
      meal_name,
      meal_type: meal_source, // Uses existing column
      eaten_at: eaten_at || new Date().toISOString(),
      estimated_calories,
      protein_grams,
      carbs_grams,
      fat_grams,
      fiber_grams,
      vegetable_servings,
      detected_components: detected_components || [],
      health_assessment,
      ai_notes,
      image_url,
      // Store household info in notes/ai_notes for now
      // Could add dedicated columns later
      notes: household_member ? `${household_member} (${portion_percentage}%)${divide_by > 1 ? ` ÷${divide_by}` : ''}` : null,
      portion_divider: divide_by || 1,
      // For restaurant meals
      restaurant_name: meal_source === 'restaurant' ? 'Restaurant' : 'Home',
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('eating_out_logs')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Save meal error:', error)
      return NextResponse.json({ error: 'Failed to save meal', details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      meal: data,
    })

  } catch (error) {
    console.error('Save meal error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      error: 'Failed to save meal',
      details: errorMessage
    }, { status: 500 })
  }
}
