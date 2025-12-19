import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface HistoryItem {
  id: string
  type: 'receipt' | 'cooked' | 'eaten' | 'wasted'
  date: string
  title: string
  subtitle?: string
  icon: string
  metadata?: Record<string, unknown>
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const filter = searchParams.get('filter') || 'all' // all, receipts, meals, consumption
    const limit = parseInt(searchParams.get('limit') || '50')

    const history: HistoryItem[] = []

    // Fetch receipts
    if (filter === 'all' || filter === 'receipts') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: receipts } = await (supabase as any)
        .from('receipts')
        .select('id, store_name, store_branch, receipt_date, total, created_at')
        .eq('user_id', user.id)
        .order('receipt_date', { ascending: false })
        .limit(limit)

      if (receipts) {
        for (const receipt of receipts) {
          history.push({
            id: `receipt-${receipt.id}`,
            type: 'receipt',
            date: receipt.receipt_date,
            title: receipt.store_name + (receipt.store_branch ? ` - ${receipt.store_branch}` : ''),
            subtitle: `$${receipt.total.toFixed(2)}`,
            icon: '🧾',
            metadata: { receipt_id: receipt.id, total: receipt.total },
          })
        }
      }
    }

    // Fetch cooked meals
    if (filter === 'all' || filter === 'meals') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: meals } = await (supabase as any)
        .from('cooked_meals')
        .select('id, name, meal_type, cuisine_type, cooked_at, rating')
        .eq('user_id', user.id)
        .order('cooked_at', { ascending: false })
        .limit(limit)

      if (meals) {
        for (const meal of meals) {
          history.push({
            id: `cooked-${meal.id}`,
            type: 'cooked',
            date: meal.cooked_at,
            title: `Made: ${meal.name}`,
            subtitle: [meal.cuisine_type, meal.meal_type].filter(Boolean).join(' • '),
            icon: '🍳',
            metadata: { meal_id: meal.id, rating: meal.rating },
          })
        }
      }
    }

    // Fetch eaten/wasted items from inventory
    if (filter === 'all' || filter === 'consumption') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: consumed } = await (supabase as any)
        .from('inventory_items')
        .select('id, name, quantity, unit, consumed_at, waste_reason')
        .eq('user_id', user.id)
        .not('consumed_at', 'is', null)
        .order('consumed_at', { ascending: false })
        .limit(limit)

      if (consumed) {
        for (const item of consumed) {
          const isWasted = item.waste_reason === 'spoiled'
          history.push({
            id: `consumed-${item.id}`,
            type: isWasted ? 'wasted' : 'eaten',
            date: item.consumed_at,
            title: isWasted ? `Wasted: ${item.name}` : `Ate: ${item.name}`,
            subtitle: item.quantity > 1 ? `${item.quantity} ${item.unit || 'pc'}` : undefined,
            icon: isWasted ? '🗑️' : '✅',
            metadata: { item_id: item.id, quantity: item.quantity, waste_reason: item.waste_reason },
          })
        }
      }
    }

    // Fetch eating out logs
    if (filter === 'all' || filter === 'meals') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: eatingOut } = await (supabase as any)
        .from('eating_out_logs')
        .select('id, meal_name, restaurant_name, estimated_calories, eaten_at')
        .eq('user_id', user.id)
        .order('eaten_at', { ascending: false })
        .limit(limit)

      if (eatingOut) {
        for (const meal of eatingOut) {
          history.push({
            id: `eating-out-${meal.id}`,
            type: 'cooked', // Using 'cooked' type for meals
            date: meal.eaten_at,
            title: meal.meal_name || 'Meal out',
            subtitle: meal.restaurant_name ? `at ${meal.restaurant_name}` : `~${meal.estimated_calories || '?'} cal`,
            icon: '🍽️',
            metadata: { meal_id: meal.id, calories: meal.estimated_calories },
          })
        }
      }
    }

    // Sort all history items by date descending
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Group by date
    const grouped: Record<string, HistoryItem[]> = {}
    for (const item of history.slice(0, limit)) {
      const dateKey = new Date(item.date).toISOString().split('T')[0]
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(item)
    }

    // Calculate summary stats
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    const monthItems = history.filter(h => new Date(h.date) >= startOfMonth)
    const receiptsThisMonth = monthItems.filter(h => h.type === 'receipt').length
    const mealsThisMonth = monthItems.filter(h => h.type === 'cooked').length
    const eatenThisMonth = monthItems.filter(h => h.type === 'eaten').length
    const wastedThisMonth = monthItems.filter(h => h.type === 'wasted').length

    return NextResponse.json({
      history: grouped,
      summary: {
        receipts_this_month: receiptsThisMonth,
        meals_this_month: mealsThisMonth,
        eaten_this_month: eatenThisMonth,
        wasted_this_month: wastedThisMonth,
        waste_rate: eatenThisMonth + wastedThisMonth > 0
          ? Math.round((wastedThisMonth / (eatenThisMonth + wastedThisMonth)) * 100)
          : 0,
      },
    })
  } catch (error) {
    console.error('History API error:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
