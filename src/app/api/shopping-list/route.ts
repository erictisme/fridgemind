import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch active shopping list with items
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get or create active shopping list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data: activeList } = await (supabase as any)
      .from('shopping_lists')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    // Create a new list if none exists
    if (!activeList) {
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
        console.error('Error creating list:', createError)
        return NextResponse.json({ error: 'Failed to create shopping list' }, { status: 500 })
      }

      activeList = newList
    }

    // Get items for the active list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items, error: itemsError } = await (supabase as any)
      .from('shopping_list_items')
      .select('*')
      .eq('list_id', activeList.id)
      .order('is_checked', { ascending: true })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })

    if (itemsError) {
      console.error('Error fetching items:', itemsError)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      list: activeList,
      items: items || [],
    })
  } catch (error) {
    console.error('Shopping list fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shopping list' },
      { status: 500 }
    )
  }
}

// POST - Add item to shopping list
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, category, quantity, unit } = body

    if (!name) {
      return NextResponse.json({ error: 'Item name required' }, { status: 400 })
    }

    // Get active shopping list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data: activeList } = await (supabase as any)
      .from('shopping_lists')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    // Create a new list if none exists
    if (!activeList) {
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
        console.error('Error creating list:', createError)
        return NextResponse.json({ error: 'Failed to create shopping list' }, { status: 500 })
      }

      activeList = newList
    }

    // Add item to the list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newItem, error: insertError } = await (supabase as any)
      .from('shopping_list_items')
      .insert({
        list_id: activeList.id,
        user_id: user.id,
        name: name,
        category: category || null,
        quantity: quantity || 1,
        unit: unit || null,
        is_checked: false,
        priority: 0,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error adding item:', insertError)
      return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      item: newItem,
      message: 'Item added to shopping list',
    })
  } catch (error) {
    console.error('Shopping list add error:', error)
    return NextResponse.json(
      { error: 'Failed to add item' },
      { status: 500 }
    )
  }
}

// PUT - Update item (toggle check, edit)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, ...updates } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('shopping_list_items')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id) // Security: only update own items

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Item updated' })
  } catch (error) {
    console.error('Shopping list update error:', error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

// DELETE - Remove item or clear checked items
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, clearChecked, listId } = body

    // Clear all checked items
    if (clearChecked && listId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('shopping_list_items')
        .delete()
        .eq('list_id', listId)
        .eq('user_id', user.id)
        .eq('is_checked', true)

      if (error) {
        console.error('Clear checked error:', error)
        return NextResponse.json({ error: 'Failed to clear checked items' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Checked items cleared' })
    }

    // Delete single item
    if (id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('shopping_list_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id) // Security: only delete own items

      if (error) {
        console.error('Delete error:', error)
        return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Item removed' })
    }

    return NextResponse.json({ error: 'Invalid delete request' }, { status: 400 })
  } catch (error) {
    console.error('Shopping list delete error:', error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
