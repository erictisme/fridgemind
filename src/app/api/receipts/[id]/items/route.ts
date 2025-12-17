import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch all items for a specific receipt
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: receiptId } = await params

    // First verify the receipt exists and belongs to user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: receipt } = await (supabase as any)
      .from('receipts')
      .select('id, store_name')
      .eq('id', receiptId)
      .eq('user_id', user.id)
      .single()

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    // Fetch all items for this receipt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items, error } = await (supabase as any)
      .from('receipt_items')
      .select('id, item_name, normalized_name, quantity, unit_price, total_price, category')
      .eq('receipt_id', receiptId)
      .eq('user_id', user.id)
      .order('item_name')

    if (error) {
      console.error('Error fetching receipt items:', error)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    // If no items found, check if there might be items in the raw_ocr_response
    if (!items || items.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fullReceipt } = await (supabase as any)
        .from('receipts')
        .select('raw_ocr_response')
        .eq('id', receiptId)
        .single()

      // If there are items in the raw response but not in receipt_items table,
      // suggest re-processing
      if (fullReceipt?.raw_ocr_response?.items?.length > 0) {
        return NextResponse.json({
          items: [],
          count: 0,
          hint: 'Items exist in receipt data but were not saved to database. Try re-uploading.',
          raw_items_count: fullReceipt.raw_ocr_response.items.length,
        })
      }
    }

    return NextResponse.json({
      items: items || [],
      count: items?.length || 0,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
