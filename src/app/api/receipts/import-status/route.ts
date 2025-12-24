import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all receipts that have items in inventory
    // Group by receipt_id and count items, also get the timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: imports, error } = await (supabase as any)
      .from('inventory_items')
      .select('source_receipt_id, added_from_receipt_at, id')
      .eq('user_id', user.id)
      .not('source_receipt_id', 'is', null)
      .is('consumed_at', null) // Only count items that haven't been consumed

    if (error) {
      console.error('Error fetching import status:', error)
      return NextResponse.json({ error: 'Failed to fetch import status' }, { status: 500 })
    }

    // Group by receipt_id
    const receiptStatus: Record<string, { count: number; added_at: string; can_undo: boolean }> = {}
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    if (imports) {
      imports.forEach((item: { source_receipt_id: string; added_from_receipt_at: string }) => {
        const receiptId = item.source_receipt_id
        const addedAt = new Date(item.added_from_receipt_at)
        const canUndo = addedAt > twentyFourHoursAgo

        if (!receiptStatus[receiptId]) {
          receiptStatus[receiptId] = {
            count: 0,
            added_at: item.added_from_receipt_at,
            can_undo: canUndo,
          }
        }
        receiptStatus[receiptId].count++
      })
    }

    return NextResponse.json({ imports: receiptStatus })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
