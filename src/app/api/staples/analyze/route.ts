import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ReceiptItem {
  item_name: string
  category: string
  quantity: number
  created_at: string
  receipt: {
    receipt_date: string
  }
}

interface ItemAggregate {
  name: string
  category: string
  purchase_count: number
  first_purchased_at: string
  last_purchased_at: string
  purchase_dates: string[]
}

// POST: Analyze receipt history and populate staples
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all receipt items with their receipt dates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: receiptItems, error: itemsError } = await (supabase as any)
      .from('receipt_items')
      .select(`
        item_name,
        category,
        quantity,
        created_at,
        receipt:receipts!inner(receipt_date)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (itemsError) {
      console.error('Error fetching receipt items:', itemsError)
      return NextResponse.json({ error: 'Failed to fetch receipt history' }, { status: 500 })
    }

    if (!receiptItems || receiptItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No receipt items found to analyze',
        items_found: 0,
        staples_identified: 0,
      })
    }

    // Aggregate items by normalized name
    const itemMap = new Map<string, ItemAggregate>()

    for (const item of receiptItems as ReceiptItem[]) {
      // Normalize name: lowercase, trim, remove extra spaces
      const normalizedName = item.item_name.toLowerCase().trim().replace(/\s+/g, ' ')

      if (itemMap.has(normalizedName)) {
        const existing = itemMap.get(normalizedName)!
        existing.purchase_count += 1
        existing.purchase_dates.push(item.receipt.receipt_date)
        if (item.receipt.receipt_date > existing.last_purchased_at) {
          existing.last_purchased_at = item.receipt.receipt_date
        }
        if (item.receipt.receipt_date < existing.first_purchased_at) {
          existing.first_purchased_at = item.receipt.receipt_date
        }
      } else {
        itemMap.set(normalizedName, {
          name: item.item_name, // Keep original casing from first occurrence
          category: item.category,
          purchase_count: 1,
          first_purchased_at: item.receipt.receipt_date,
          last_purchased_at: item.receipt.receipt_date,
          purchase_dates: [item.receipt.receipt_date],
        })
      }
    }

    // Calculate average purchase frequency for each item
    const staplesData = Array.from(itemMap.values()).map((item) => {
      let avgFrequency: number | null = null

      if (item.purchase_dates.length > 1) {
        // Sort dates and calculate average gap
        const sortedDates = item.purchase_dates
          .map((d) => new Date(d).getTime())
          .sort((a, b) => a - b)

        const gaps: number[] = []
        for (let i = 1; i < sortedDates.length; i++) {
          const daysDiff = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24)
          gaps.push(daysDiff)
        }

        if (gaps.length > 0) {
          avgFrequency = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
        }
      }

      // Auto-mark as staple if purchased 3+ times
      const isAutoStaple = item.purchase_count >= 3

      return {
        user_id: user.id,
        name: item.name,
        category: item.category,
        purchase_count: item.purchase_count,
        first_purchased_at: item.first_purchased_at,
        last_purchased_at: item.last_purchased_at,
        avg_purchase_frequency_days: avgFrequency,
        is_staple: isAutoStaple,
        is_occasional: false,
        never_suggest_alternative: false,
      }
    })

    // Upsert staples (update if exists, insert if new)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertError } = await (supabase as any)
      .from('user_staples')
      .upsert(staplesData, {
        onConflict: 'user_id,name',
        ignoreDuplicates: false,
      })

    if (upsertError) {
      console.error('Error upserting staples:', upsertError)
      return NextResponse.json({ error: 'Failed to save staples' }, { status: 500 })
    }

    // Log the analysis run
    const staplesIdentified = staplesData.filter((s) => s.is_staple).length

    // Get receipt count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: receiptCount } = await (supabase as any)
      .from('receipts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('receipt_analysis_runs')
      .insert({
        user_id: user.id,
        receipts_analyzed: receiptCount || 0,
        items_found: staplesData.length,
        staples_identified: staplesIdentified,
      })

    // Return summary with top staples for review
    const topStaples = staplesData
      .filter((s) => s.is_staple)
      .sort((a, b) => b.purchase_count - a.purchase_count)
      .slice(0, 20)

    const occasionalItems = staplesData
      .filter((s) => !s.is_staple && s.purchase_count >= 2)
      .sort((a, b) => b.purchase_count - a.purchase_count)
      .slice(0, 10)

    return NextResponse.json({
      success: true,
      message: 'Receipt history analyzed',
      receipts_analyzed: receiptCount || 0,
      items_found: staplesData.length,
      staples_identified: staplesIdentified,
      top_staples: topStaples,
      frequent_occasional: occasionalItems,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
