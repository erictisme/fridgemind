import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('[undo-inventory] Starting POST request')
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.log('[undo-inventory] No user found - unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[undo-inventory] User authenticated:', user.id)

    const body = await request.json()
    const { receipt_id } = body
    console.log('[undo-inventory] Received receipt_id:', receipt_id)

    if (!receipt_id) {
      console.log('[undo-inventory] No receipt_id provided')
      return NextResponse.json({ error: 'Receipt ID is required' }, { status: 400 })
    }

    // First, check if items exist and are still within the 24-hour undo window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items, error: fetchError } = await (supabase as any)
      .from('inventory_items')
      .select('id, name, added_from_receipt_at')
      .eq('user_id', user.id)
      .eq('source_receipt_id', receipt_id)
      .is('consumed_at', null) // Only items that haven't been consumed yet

    if (fetchError) {
      console.error('[undo-inventory] Error fetching items:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    if (!items || items.length === 0) {
      console.log('[undo-inventory] No items found for receipt_id:', receipt_id)
      return NextResponse.json(
        { error: 'No items found from this receipt, or items have already been consumed' },
        { status: 404 }
      )
    }

    console.log(`[undo-inventory] Found ${items.length} items to potentially undo`)

    // Check if items are within 24-hour window
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const tooOldItems = items.filter((item: { added_from_receipt_at: string }) => {
      const addedAt = new Date(item.added_from_receipt_at)
      return addedAt < twentyFourHoursAgo
    })

    if (tooOldItems.length > 0) {
      console.log(`[undo-inventory] ${tooOldItems.length} items are too old to undo`)
      return NextResponse.json(
        { error: 'Cannot undo: Items were added more than 24 hours ago' },
        { status: 400 }
      )
    }

    // Delete all items from this receipt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('inventory_items')
      .delete()
      .eq('user_id', user.id)
      .eq('source_receipt_id', receipt_id)
      .is('consumed_at', null)

    if (deleteError) {
      console.error('[undo-inventory] Error deleting items:', deleteError)
      return NextResponse.json({ error: 'Failed to delete items' }, { status: 500 })
    }

    console.log(`[undo-inventory] Successfully deleted ${items.length} items`)
    return NextResponse.json({
      success: true,
      deleted: items.length,
      items: items.map((item: { name: string }) => item.name),
    })
  } catch (error) {
    console.error('[undo-inventory] Error:', error)
    return NextResponse.json(
      { error: 'Failed to undo inventory import' },
      { status: 500 }
    )
  }
}
