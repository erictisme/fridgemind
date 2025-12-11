import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseReceiptPDF, parseReceiptImage } from '@/lib/gemini/receipt-parser'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { file_data, file_type, file_name } = body

    if (!file_data) {
      return NextResponse.json({ error: 'No file data provided' }, { status: 400 })
    }

    // Parse receipt based on file type
    let parsedReceipt
    if (file_type === 'application/pdf' || file_name?.endsWith('.pdf')) {
      parsedReceipt = await parseReceiptPDF(file_data)
    } else {
      parsedReceipt = await parseReceiptImage(file_data)
    }

    // Save receipt to database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: receipt, error: receiptError } = await (supabase as any)
      .from('receipts')
      .insert({
        user_id: user.id,
        store_name: parsedReceipt.store_name,
        store_branch: parsedReceipt.store_branch,
        receipt_date: parsedReceipt.receipt_date,
        receipt_number: parsedReceipt.receipt_number,
        subtotal: parsedReceipt.subtotal,
        gst: parsedReceipt.gst,
        total: parsedReceipt.total,
        payment_method: parsedReceipt.payment_method,
        file_name: file_name,
        raw_ocr_response: parsedReceipt,
      })
      .select()
      .single()

    if (receiptError) {
      console.error('Error saving receipt:', receiptError)
      return NextResponse.json({ error: 'Failed to save receipt' }, { status: 500 })
    }

    // Save receipt items
    const receiptItems = parsedReceipt.items.map((item) => ({
      receipt_id: receipt.id,
      user_id: user.id,
      item_name: item.name,
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
      .insert(receiptItems)

    if (itemsError) {
      console.error('Error saving receipt items:', itemsError)
      // Don't fail completely, receipt was saved
    }

    return NextResponse.json({
      success: true,
      receipt: receipt,
      items_count: parsedReceipt.items.length,
      parsed: parsedReceipt,
    })
  } catch (error) {
    console.error('Receipt parsing error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process receipt' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get receipts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: receipts, error } = await (supabase as any)
      .from('receipts')
      .select('*')
      .eq('user_id', user.id)
      .order('receipt_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching receipts:', error)
      return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 })
    }

    // Get spending summary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: summary } = await (supabase as any)
      .from('receipts')
      .select('total, receipt_date')
      .eq('user_id', user.id)

    const totalSpent = summary?.reduce((acc: number, r: { total: number }) => acc + (r.total || 0), 0) || 0
    const receiptCount = summary?.length || 0

    // Get current month spending
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const thisMonthSpent = summary
      ?.filter((r: { receipt_date: string }) => r.receipt_date >= monthStart)
      .reduce((acc: number, r: { total: number }) => acc + (r.total || 0), 0) || 0

    return NextResponse.json({
      receipts,
      summary: {
        total_spent: totalSpent,
        receipt_count: receiptCount,
        this_month_spent: thisMonthSpent,
        avg_per_trip: receiptCount > 0 ? totalSpent / receiptCount : 0,
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const receiptId = searchParams.get('id')

    if (!receiptId) {
      return NextResponse.json({ error: 'Receipt ID required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('receipts')
      .delete()
      .eq('id', receiptId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting receipt:', error)
      return NextResponse.json({ error: 'Failed to delete receipt' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
