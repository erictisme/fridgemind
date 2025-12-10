import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface InventoryItemInput {
  name: string
  storage_category: string
  nutritional_type: string
  location: string
  quantity: number
  unit: string
  expiry_date: string
  freshness: string
  confidence: number
}

interface ExistingItem {
  id: string
  name: string
  location: string
  storage_category: string
  quantity: number
  unit: string
}

// Normalize item name for matching (lowercase, trim, remove plurals)
function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/s$/, '') // Remove trailing 's' for basic plural handling
    .replace(/ies$/, 'y') // berries -> berry
}

// Check if two items are the same (match by name and location)
function itemsMatch(newItem: InventoryItemInput, existing: ExistingItem): boolean {
  const newName = normalizeItemName(newItem.name)
  const existingName = normalizeItemName(existing.name)

  // Match if same normalized name AND same location
  return newName === existingName && newItem.location === existing.location
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { items, mergeMode = 'replace' } = body as {
      items: InventoryItemInput[]
      mergeMode?: 'replace' | 'add' | 'skip'
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    // Fetch existing inventory items for this user (non-consumed only)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingItems, error: fetchError } = await (supabase as any)
      .from('inventory_items')
      .select('id, name, location, storage_category, quantity, unit')
      .eq('user_id', user.id)
      .is('consumed_at', null)

    if (fetchError) {
      console.error('Failed to fetch existing items:', fetchError)
      return NextResponse.json({ error: 'Failed to check existing inventory' }, { status: 500 })
    }

    const existing: ExistingItem[] = existingItems || []
    const itemsToInsert: Array<Record<string, unknown>> = []
    const itemsToUpdate: Array<{ id: string; quantity: number; expiry_date: string; freshness: string }> = []
    const skippedItems: string[] = []
    const mergedItems: string[] = []

    for (const item of items) {
      // Find matching existing item
      const matchingItem = existing.find(e => itemsMatch(item, e))

      if (matchingItem) {
        if (mergeMode === 'skip') {
          // Skip - don't update existing item
          skippedItems.push(item.name)
        } else if (mergeMode === 'add') {
          // Add - increment quantity
          itemsToUpdate.push({
            id: matchingItem.id,
            quantity: matchingItem.quantity + item.quantity,
            expiry_date: item.expiry_date,
            freshness: item.freshness,
          })
          mergedItems.push(`${item.name} (+${item.quantity})`)
        } else {
          // Replace (default) - set to new quantity
          itemsToUpdate.push({
            id: matchingItem.id,
            quantity: item.quantity,
            expiry_date: item.expiry_date,
            freshness: item.freshness,
          })
          mergedItems.push(`${item.name} (→${item.quantity})`)
        }
      } else {
        // New item - insert
        itemsToInsert.push({
          user_id: user.id,
          name: item.name,
          storage_category: item.storage_category,
          nutritional_type: item.nutritional_type,
          location: item.location,
          quantity: item.quantity,
          unit: item.unit,
          expiry_date: item.expiry_date,
          freshness: item.freshness,
          confidence: item.confidence,
        })
      }
    }

    // Perform updates
    for (const update of itemsToUpdate) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('inventory_items')
        .update({
          quantity: update.quantity,
          expiry_date: update.expiry_date,
          freshness: update.freshness,
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.id)

      if (updateError) {
        console.error('Failed to update item:', updateError)
      }
    }

    // Perform inserts
    let insertedData = []
    if (itemsToInsert.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: insertError } = await (supabase as any)
        .from('inventory_items')
        .insert(itemsToInsert)
        .select()

      if (insertError) {
        console.error('Database insert error:', insertError)
        return NextResponse.json({ error: 'Failed to save new items' }, { status: 500 })
      }
      insertedData = data || []
    }

    return NextResponse.json({
      success: true,
      inserted: insertedData.length,
      updated: itemsToUpdate.length,
      skipped: skippedItems.length,
      mergedItems,
      skippedItems,
      message: `Added ${insertedData.length} new items, updated ${itemsToUpdate.length} existing items${skippedItems.length > 0 ? `, skipped ${skippedItems.length}` : ''}`,
    })
  } catch (error) {
    console.error('Inventory save error:', error)
    return NextResponse.json(
      { error: 'Failed to save inventory' },
      { status: 500 }
    )
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
      .from('inventory_items')
      .select('*')
      .eq('user_id', user.id)
      .is('consumed_at', null)
      .order('expiry_date', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      items: data || [],
    })
  } catch (error) {
    console.error('Inventory fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}
