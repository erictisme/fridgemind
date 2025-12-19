import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface InventoryItemInput {
  id?: string  // Present for existing items
  name: string
  storage_category: string
  nutritional_type: string
  location: string
  quantity: number
  unit: string
  purchase_date?: string
  expiry_date: string
  freshness: string
  confidence: number
}

// Normalize item name for matching (lowercase, trim, remove plurals)
function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/s$/, '') // Remove trailing 's' for basic plural handling
    .replace(/ies$/, 'y') // berries -> berry
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { items, location, syncMode = false } = body as {
      items: InventoryItemInput[]
      location?: string
      syncMode?: boolean
    }

    if (!items) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    // SYNC MODE: Full replacement for a location
    // This is the new smart merge - items with qty=0 get deleted, others get upserted
    if (syncMode && location) {
      const deleted: string[] = []
      const updated: string[] = []
      const inserted: string[] = []

      // Get existing items for this location
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingItems } = await (supabase as any)
        .from('inventory_items')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('location', location)
        .is('consumed_at', null)

      const existingIds = new Set((existingItems || []).map((e: { id: string }) => e.id))
      const incomingIds = new Set(items.filter(i => i.id).map(i => i.id as string))

      // Find items to delete (in existing but not in incoming, OR qty = 0)
      const itemsToDelete = items.filter(i => i.id && i.quantity === 0)
      const orphanedIds = [...existingIds].filter(id => !incomingIds.has(id as string))

      // Delete items with qty = 0
      for (const item of itemsToDelete) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('inventory_items')
          .delete()
          .eq('id', item.id)
        deleted.push(item.name)
      }

      // Delete orphaned items (in DB but not in incoming list)
      for (const id of orphanedIds) {
        const orphan = (existingItems || []).find((e: { id: string; name: string }) => e.id === id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('inventory_items')
          .delete()
          .eq('id', id)
        if (orphan) deleted.push(orphan.name)
      }

      // Process items with qty > 0
      const validItems = items.filter(i => i.quantity > 0)

      for (const item of validItems) {
        if (item.id && existingIds.has(item.id)) {
          // Update existing item
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('inventory_items')
            .update({
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              storage_category: item.storage_category,
              nutritional_type: item.nutritional_type,
              purchase_date: item.purchase_date || null,
              expiry_date: item.expiry_date,
              freshness: item.freshness,
              confidence: item.confidence,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)
          updated.push(item.name)
        } else {
          // Insert new item
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('inventory_items')
            .insert({
              user_id: user.id,
              name: item.name,
              storage_category: item.storage_category,
              nutritional_type: item.nutritional_type,
              location: location,
              quantity: item.quantity,
              unit: item.unit,
              purchase_date: item.purchase_date || null,
              expiry_date: item.expiry_date,
              freshness: item.freshness,
              confidence: item.confidence,
            })
          inserted.push(item.name)
        }
      }

      return NextResponse.json({
        success: true,
        inserted: inserted.length,
        updated: updated.length,
        deleted: deleted.length,
        insertedItems: inserted,
        updatedItems: updated,
        deletedItems: deleted,
        message: `Added ${inserted.length}, updated ${updated.length}, removed ${deleted.length} items`,
      })
    }

    // LEGACY MODE: Simple insert for backward compatibility (first-time scans)
    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        inserted: 0,
        updated: 0,
        deleted: 0,
        message: 'No items to save',
      })
    }

    // Get existing items for matching
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingItems } = await (supabase as any)
      .from('inventory_items')
      .select('id, name, location, quantity')
      .eq('user_id', user.id)
      .is('consumed_at', null)

    const existing = existingItems || []
    const insertedItems: string[] = []
    const updatedItems: string[] = []

    for (const item of items) {
      // Find matching existing item by normalized name and location
      const match = existing.find((e: { name: string; location: string }) =>
        normalizeItemName(e.name) === normalizeItemName(item.name) &&
        e.location === item.location
      )

      if (match) {
        // Update existing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('inventory_items')
          .update({
            quantity: item.quantity,
            unit: item.unit,
            storage_category: item.storage_category,
            nutritional_type: item.nutritional_type,
            purchase_date: item.purchase_date || null,
            expiry_date: item.expiry_date,
            freshness: item.freshness,
            confidence: item.confidence,
            updated_at: new Date().toISOString(),
          })
          .eq('id', match.id)
        updatedItems.push(item.name)
      } else {
        // Insert new
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('inventory_items')
          .insert({
            user_id: user.id,
            name: item.name,
            storage_category: item.storage_category,
            nutritional_type: item.nutritional_type,
            location: item.location,
            quantity: item.quantity,
            unit: item.unit,
            purchase_date: item.purchase_date || null,
            expiry_date: item.expiry_date,
            freshness: item.freshness,
            confidence: item.confidence,
          })
        insertedItems.push(item.name)
      }
    }

    return NextResponse.json({
      success: true,
      inserted: insertedItems.length,
      updated: updatedItems.length,
      deleted: 0,
      insertedItems,
      updatedItems,
      deletedItems: [],
      message: `Added ${insertedItems.length}, updated ${updatedItems.length} items`,
    })
  } catch (error) {
    console.error('Inventory save error:', error)
    return NextResponse.json(
      { error: 'Failed to save inventory' },
      { status: 500 }
    )
  }
}

// PUT - Update a single inventory item
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
      .from('inventory_items')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id) // Security: only update own items

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Item updated' })
  } catch (error) {
    console.error('Inventory update error:', error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

// DELETE - Remove a single inventory item and log consumption
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, reason = 'consumed', itemName, category, quantity } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 })
    }

    // Log to consumption_logs for tracking (consumed vs wasted)
    if (itemName && category) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('consumption_logs')
        .insert({
          user_id: user.id,
          item_name: itemName,
          category: category,
          quantity_consumed: quantity || 1,
          reason: reason, // 'consumed' or 'wasted'
          consumed_at: new Date().toISOString(),
        })
    }

    // Delete the inventory item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deletedData, error } = await (supabase as any)
      .from('inventory_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Security: only delete own items
      .select()

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete item', details: error.message }, { status: 500 })
    }

    // Check if anything was actually deleted
    if (!deletedData || deletedData.length === 0) {
      console.warn('Delete returned no rows - item may not exist or RLS blocked:', { id, user_id: user.id })
      // Still return success since the item doesn't exist (idempotent)
    }

    return NextResponse.json({ success: true, message: 'Item removed', reason, deleted: deletedData?.length || 0 })
  } catch (error) {
    console.error('Inventory delete error:', error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get optional location filter from query params
    const { searchParams } = new URL(request.url)
    const location = searchParams.get('location')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('inventory_items')
      .select('*')
      .eq('user_id', user.id)
      .is('consumed_at', null)

    // Apply location filter if provided
    if (location) {
      query = query.eq('location', location)
    }

    const { data, error } = await query.order('expiry_date', { ascending: true })

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
