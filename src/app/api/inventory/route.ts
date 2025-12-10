import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface InventoryItemInput {
  name: string
  storage_category: string
  nutritional_type: string
  location: string
  quantity: number
  unit: string
  expiry_date: string
  freshness: string
  confidence: number
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { items } = body as { items: InventoryItemInput[] }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    // Prepare items for insertion
    const itemsToInsert = items.map(item => ({
      user_id: user.id,
      name: item.name,
      storage_category: item.storage_category,
      nutritional_type: item.nutritional_type,
      location: item.location,
      quantity: item.quantity,
      unit: item.unit,
      expiry_date: item.expiry_date,
      freshness: item.freshness,
      confidence: item.confidence,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('inventory_items')
      .insert(itemsToInsert)
      .select()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to save items' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      items: data,
      count: data?.length || 0,
    })
  } catch (error) {
    console.error('Inventory save error:', error)
    return NextResponse.json(
      { error: 'Failed to save inventory' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('inventory_items')
      .select('*')
      .eq('user_id', user.id)
      .is('consumed_at', null)
      .order('expiry_date', { ascending: true })

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
