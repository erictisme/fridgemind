import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ReceiptItem {
  item_name: string
  normalized_name: string | null
  total_price: number
  quantity: number
}

// GET: Fetch items for a specific category
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    if (!category) {
      return NextResponse.json({ error: 'Category required' }, { status: 400 })
    }

    // Fetch all items in this category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items, error } = await (supabase as any)
      .from('receipt_items')
      .select('item_name, normalized_name, total_price, quantity')
      .eq('user_id', user.id)
      .eq('category', category)

    if (error) {
      console.error('Error fetching category items:', error)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    // Aggregate by normalized_name (or item_name if not normalized)
    const itemMap = new Map<string, { name: string; normalized_name: string | null; total: number; count: number }>()

    for (const item of (items as ReceiptItem[]) || []) {
      const key = (item.normalized_name || item.item_name).toLowerCase().trim()
      const displayName = item.normalized_name || item.item_name

      if (itemMap.has(key)) {
        const existing = itemMap.get(key)!
        existing.total += item.total_price || 0
        existing.count += item.quantity || 1
      } else {
        itemMap.set(key, {
          name: item.item_name,
          normalized_name: item.normalized_name,
          total: item.total_price || 0,
          count: item.quantity || 1,
        })
      }
    }

    // Sort by total spend descending
    const aggregatedItems = Array.from(itemMap.values())
      .sort((a, b) => b.total - a.total)

    return NextResponse.json({
      category,
      items: aggregatedItems,
      total_items: aggregatedItems.length,
      total_spend: aggregatedItems.reduce((sum, i) => sum + i.total, 0),
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
