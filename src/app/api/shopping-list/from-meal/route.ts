import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateListFromMeal } from '@/lib/gemini/shopping'

interface RequestBody {
  meal_description: string
  add_to_list?: boolean // If true, add items directly to shopping list
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as RequestBody
    const { meal_description, add_to_list = false } = body

    if (!meal_description || meal_description.trim().length === 0) {
      return NextResponse.json({ error: 'Meal description is required' }, { status: 400 })
    }

    // Fetch user's current inventory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inventoryItems } = await (supabase as any)
      .from('inventory_items')
      .select('name')
      .eq('user_id', user.id)
      .is('consumed_at', null)

    const inventoryNames = (inventoryItems || []).map((item: { name: string }) => item.name)

    // Generate shopping list from meal idea
    const result = await generateListFromMeal(meal_description, inventoryNames)

    // If add_to_list is true, add items directly to shopping list
    if (add_to_list && result.ingredients_needed.length > 0) {
      // Get or create active shopping list
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let { data: list } = await (supabase as any)
        .from('shopping_lists')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (!list) {
        // Create new list
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newList } = await (supabase as any)
          .from('shopping_lists')
          .insert({ user_id: user.id, name: 'My Shopping List', is_active: true })
          .select('id')
          .single()
        list = newList
      }

      if (list) {
        // Insert items
        const itemsToInsert = result.ingredients_needed.map(item => ({
          list_id: list.id,
          user_id: user.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          source: 'meal_plan',
          is_checked: false,
          priority: 0,
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('shopping_list_items')
          .insert(itemsToInsert)
      }
    }

    return NextResponse.json({
      success: true,
      recipe_name: result.recipe_name,
      ingredients_needed: result.ingredients_needed,
      already_have: result.already_have,
      added_to_list: add_to_list,
    })
  } catch (error) {
    console.error('From-meal API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate shopping list' },
      { status: 500 }
    )
  }
}
