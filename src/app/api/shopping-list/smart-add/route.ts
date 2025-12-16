import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseShoppingText } from '@/lib/gemini/shopping'

interface RequestBody {
  text: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as RequestBody
    const { text } = body

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text input is required' }, { status: 400 })
    }

    // Parse the text using Gemini
    const parsedItems = await parseShoppingText(text.trim())

    if (parsedItems.length === 0) {
      return NextResponse.json({ error: 'No items could be parsed from the text' }, { status: 400 })
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
      // Create new list
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newList } = await (supabase as any)
        .from('shopping_lists')
        .insert({ user_id: user.id, name: 'My Shopping List', is_active: true })
        .select('id')
        .single()
      list = newList
    }

    if (!list) {
      return NextResponse.json({ error: 'Failed to get or create shopping list' }, { status: 500 })
    }

    // Insert all parsed items
    const itemsToInsert = parsedItems.map(item => ({
      list_id: list.id,
      user_id: user.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      source: 'smart_add',
      is_checked: false,
      priority: 0,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedItems, error } = await (supabase as any)
      .from('shopping_list_items')
      .insert(itemsToInsert)
      .select()

    if (error) {
      console.error('Failed to insert items:', error)
      return NextResponse.json({ error: 'Failed to add items to list' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      items: insertedItems,
      parsed_count: parsedItems.length,
    })
  } catch (error) {
    console.error('Smart-add API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse and add items' },
      { status: 500 }
    )
  }
}
