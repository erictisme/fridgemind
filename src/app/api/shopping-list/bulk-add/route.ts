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
    const { items } = body as {
      items: Array<{ name: string; quantity?: number; unit?: string | null; recipe_group?: string | null }>
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    // Get or create active shopping list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data: list } = await (supabase as any)
      .from('shopping_lists')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!list) {
      // Create new active list
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newList, error: createError } = await (supabase as any)
        .from('shopping_lists')
        .insert({
          user_id: user.id,
          name: 'My Shopping List',
          is_active: true,
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating shopping list:', createError)
        return NextResponse.json({ error: 'Failed to create shopping list' }, { status: 500 })
      }
      list = newList
    }

    // Prepare items for insertion
    const itemsToInsert = items.map(item => ({
      list_id: list.id,
      user_id: user.id,
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit || null,
      is_checked: false,
      source: 'recipe',
      recipe_group: item.recipe_group || null,
    }))

    // Insert all items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedItems, error: insertError } = await (supabase as any)
      .from('shopping_list_items')
      .insert(itemsToInsert)
      .select()

    if (insertError) {
      console.error('Error adding items:', insertError)
      return NextResponse.json({ error: 'Failed to add items' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      items_added: insertedItems?.length || 0,
    })
  } catch (error) {
    console.error('Bulk add error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
