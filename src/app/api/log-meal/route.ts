import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeNutrition, estimateHomeMealNutrition } from '@/lib/gemini/vision'

interface HomeMealItem {
  id: string
  name: string
  quantity: number
  unit: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type } = body

    if (type === 'home') {
      // Home meal - use inventory items
      const { items } = body as { type: 'home'; items: HomeMealItem[] }

      if (!items || items.length === 0) {
        return NextResponse.json({ error: 'No items provided' }, { status: 400 })
      }

      // Estimate nutrition from items
      const nutrition = await estimateHomeMealNutrition(items)

      // Deduct items from inventory
      for (const item of items) {
        // Get current inventory item
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inventoryItem } = await (supabase as any)
          .from('inventory_items')
          .select('quantity')
          .eq('id', item.id)
          .eq('user_id', user.id)
          .single()

        if (inventoryItem) {
          const newQuantity = inventoryItem.quantity - item.quantity

          if (newQuantity <= 0) {
            // Delete item if quantity reaches 0
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('inventory_items')
              .delete()
              .eq('id', item.id)
              .eq('user_id', user.id)
          } else {
            // Update quantity
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('inventory_items')
              .update({ quantity: newQuantity })
              .eq('id', item.id)
              .eq('user_id', user.id)
          }
        }
      }

      // Save to eating_out_logs (we'll use this for all meals)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('eating_out_logs')
        .insert({
          user_id: user.id,
          restaurant_name: 'Home', // Mark as home meal
          meal_name: nutrition.meal_name,
          meal_type: 'home_cooked',
          estimated_calories: nutrition.estimated_calories,
          protein_grams: nutrition.protein_grams,
          carbs_grams: nutrition.carbs_grams,
          fat_grams: nutrition.fat_grams,
          fiber_grams: nutrition.fiber_grams,
          vegetable_servings: nutrition.vegetable_servings,
          detected_components: nutrition.detected_components,
          health_assessment: nutrition.health_assessment,
          ai_notes: nutrition.notes,
          eaten_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error('Save home meal error:', error)
        return NextResponse.json({ error: 'Failed to save meal' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        meal: data,
        nutrition,
        inventory_updated: true,
        items_deducted: items.length,
      })

    } else if (type === 'out') {
      // Eating out - analyze photo
      const { image, restaurant_name } = body

      if (!image) {
        return NextResponse.json({ error: 'No image provided' }, { status: 400 })
      }

      // Analyze nutrition with Gemini
      let nutrition
      try {
        nutrition = await analyzeNutrition(image)
      } catch (analysisError) {
        console.error('Nutrition analysis error:', analysisError)
        const errorMessage = analysisError instanceof Error ? analysisError.message : 'Unknown error'
        return NextResponse.json({
          error: 'Failed to analyze meal',
          details: errorMessage
        }, { status: 500 })
      }

      // Save to database - only include columns that exist
      // Note: sodium_level, is_fried, contains_red_meat, contains_processed_food
      // require migration 012_nutrition_analytics.sql to be applied
      const insertData: Record<string, unknown> = {
        user_id: user.id,
        restaurant_name: restaurant_name || null,
        meal_name: nutrition.meal_name,
        meal_type: 'restaurant',
        estimated_calories: nutrition.estimated_calories,
        protein_grams: nutrition.protein_grams,
        carbs_grams: nutrition.carbs_grams,
        fat_grams: nutrition.fat_grams,
        fiber_grams: nutrition.fiber_grams,
        vegetable_servings: nutrition.vegetable_servings,
        detected_components: nutrition.detected_components,
        health_assessment: nutrition.health_assessment,
        ai_notes: nutrition.notes,
        eaten_at: new Date().toISOString(),
      }

      // Add red flag fields if they exist in the nutrition response
      // These will only work after migration is applied
      if (nutrition.sodium_level) insertData.sodium_level = nutrition.sodium_level
      if (nutrition.is_fried !== undefined) insertData.is_fried = nutrition.is_fried
      if (nutrition.contains_red_meat !== undefined) insertData.contains_red_meat = nutrition.contains_red_meat
      if (nutrition.contains_processed_food !== undefined) insertData.contains_processed_food = nutrition.contains_processed_food

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let { data, error } = await (supabase as any)
        .from('eating_out_logs')
        .insert(insertData)
        .select()
        .single()

      // If insert failed due to missing columns, retry without red flag fields
      if (error && error.message?.includes('column')) {
        console.warn('Insert failed, retrying without red flag columns:', error.message)
        const basicInsertData = {
          user_id: user.id,
          restaurant_name: restaurant_name || null,
          meal_name: nutrition.meal_name,
          meal_type: 'restaurant',
          estimated_calories: nutrition.estimated_calories,
          protein_grams: nutrition.protein_grams,
          carbs_grams: nutrition.carbs_grams,
          fat_grams: nutrition.fat_grams,
          fiber_grams: nutrition.fiber_grams,
          vegetable_servings: nutrition.vegetable_servings,
          detected_components: nutrition.detected_components,
          health_assessment: nutrition.health_assessment,
          ai_notes: nutrition.notes,
          eaten_at: new Date().toISOString(),
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (supabase as any)
          .from('eating_out_logs')
          .insert(basicInsertData)
          .select()
          .single()
        data = result.data
        error = result.error
      }

      if (error) {
        console.error('Save eating out error:', error)
        return NextResponse.json({ error: 'Failed to save meal', details: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        meal: data,
        nutrition,
      })

    } else {
      return NextResponse.json({ error: 'Invalid meal type' }, { status: 400 })
    }

  } catch (error) {
    console.error('Log meal error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      error: 'Failed to log meal',
      details: errorMessage
    }, { status: 500 })
  }
}

// Get meal history (both home and out)
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
      console.error('Fetch meals error:', error)
      return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      meals: data || [],
    })
  } catch (error) {
    console.error('Fetch meals error:', error)
    return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 })
  }
}
