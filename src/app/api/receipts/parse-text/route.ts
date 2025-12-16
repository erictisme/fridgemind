import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseReceiptText } from '@/lib/gemini/receipt-parser'

interface RequestBody {
  text: string
  save?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as RequestBody
    const { text, save = true } = body

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ error: 'Receipt text is too short' }, { status: 400 })
    }

    // Parse the receipt text with AI
    const parsed = await parseReceiptText(text)

    if (!save) {
      return NextResponse.json({
        success: true,
        parsed,
        saved: false,
      })
    }

    // Check for duplicate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingReceipt } = await (supabase as any)
      .from('receipts')
      .select('id, store_name, receipt_date')
      .eq('user_id', user.id)
      .eq('store_name', parsed.store_name)
      .eq('receipt_date', parsed.receipt_date)
      .eq('total', parsed.total)
      .single()

    if (existingReceipt) {
      return NextResponse.json({
        success: false,
        duplicate: true,
        existing: {
          store: existingReceipt.store_name,
          date: existingReceipt.receipt_date,
        },
        parsed,
      })
    }

    // Save receipt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: receipt, error: receiptError } = await (supabase as any)
      .from('receipts')
      .insert({
        user_id: user.id,
        store_name: parsed.store_name,
        store_branch: parsed.store_branch,
        receipt_date: parsed.receipt_date,
        receipt_number: parsed.receipt_number,
        subtotal: parsed.subtotal,
        gst: parsed.gst,
        total: parsed.total,
        payment_method: parsed.payment_method,
        file_name: 'text-paste',
      })
      .select()
      .single()

    if (receiptError) {
      console.error('Error saving receipt:', receiptError)
      return NextResponse.json({ error: 'Failed to save receipt' }, { status: 500 })
    }

    // Save receipt items
    const itemsToInsert = parsed.items.map(item => ({
      user_id: user.id,
      receipt_id: receipt.id,
      item_name: item.name,
      normalized_name: item.normalized_name,
      food_type: item.food_type,
      item_code: item.item_code,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      total_price: item.total_price,
      discount: item.discount,
      category: item.category,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: itemsError } = await (supabase as any)
      .from('receipt_items')
      .insert(itemsToInsert)

    if (itemsError) {
      console.error('Error saving receipt items:', itemsError)
    }

    return NextResponse.json({
      success: true,
      receipt_id: receipt.id,
      parsed,
      saved: true,
    })
  } catch (error) {
    console.error('Parse text receipt error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse receipt' },
      { status: 500 }
    )
  }
}
