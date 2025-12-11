import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '6')

    // Get all receipts for the period
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('receipt_date', startDate.toISOString().split('T')[0])
      .order('receipt_date', { ascending: true })

    if (receiptsError) {
      console.error('Error fetching receipts:', receiptsError)
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
    }

    // Get all receipt items for the period
    const { data: items, error: itemsError } = await supabase
      .from('receipt_items')
      .select('*, receipts!inner(receipt_date)')
      .eq('user_id', session.user.id)
      .gte('receipts.receipt_date', startDate.toISOString().split('T')[0])

    if (itemsError) {
      console.error('Error fetching items:', itemsError)
    }

    // Calculate monthly spending
    const monthlySpending: Record<string, number> = {}
    receipts?.forEach((r) => {
      const month = r.receipt_date.substring(0, 7) // YYYY-MM
      monthlySpending[month] = (monthlySpending[month] || 0) + (r.total || 0)
    })

    // Calculate category breakdown
    const categorySpending: Record<string, number> = {}
    items?.forEach((item) => {
      const category = item.category || 'other'
      categorySpending[category] = (categorySpending[category] || 0) + (item.total_price || 0)
    })

    // Calculate store breakdown
    const storeSpending: Record<string, { total: number; count: number }> = {}
    receipts?.forEach((r) => {
      const store = r.store_name || 'Unknown'
      if (!storeSpending[store]) {
        storeSpending[store] = { total: 0, count: 0 }
      }
      storeSpending[store].total += r.total || 0
      storeSpending[store].count += 1
    })

    // Top items by spend
    const itemSpending: Record<string, { total: number; count: number }> = {}
    items?.forEach((item) => {
      const name = item.item_name
      if (!itemSpending[name]) {
        itemSpending[name] = { total: 0, count: 0 }
      }
      itemSpending[name].total += item.total_price || 0
      itemSpending[name].count += item.quantity || 1
    })

    const topItems = Object.entries(itemSpending)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)

    // Current month vs last month
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const lastMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`

    const currentMonthSpend = monthlySpending[currentMonth] || 0
    const lastMonthSpend = monthlySpending[lastMonth] || 0
    const monthOverMonth = lastMonthSpend > 0
      ? ((currentMonthSpend - lastMonthSpend) / lastMonthSpend) * 100
      : 0

    // Total statistics
    const totalSpent = receipts?.reduce((acc, r) => acc + (r.total || 0), 0) || 0
    const receiptCount = receipts?.length || 0
    const avgPerTrip = receiptCount > 0 ? totalSpent / receiptCount : 0
    const itemCount = items?.length || 0

    return NextResponse.json({
      summary: {
        total_spent: totalSpent,
        receipt_count: receiptCount,
        avg_per_trip: avgPerTrip,
        item_count: itemCount,
        current_month_spend: currentMonthSpend,
        last_month_spend: lastMonthSpend,
        month_over_month_percent: monthOverMonth,
      },
      monthly_spending: Object.entries(monthlySpending)
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      category_breakdown: Object.entries(categorySpending)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
      store_breakdown: Object.entries(storeSpending)
        .map(([store, data]) => ({ store, ...data }))
        .sort((a, b) => b.total - a.total),
      top_items: topItems,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
