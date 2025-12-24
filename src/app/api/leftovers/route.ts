import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      location = 'fridge',
      expiry_date,
      nutritional_type = 'misc',
      quantity = 1,
      unit = 'container',
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Calculate expiry date if not provided (default 3 days)
    const expiryDate = expiry_date || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('inventory_items')
      .insert({
        user_id: user.id,
        name,
        storage_category: 'prepared',
        nutritional_type,
        location,
        quantity,
        unit,
        purchase_date: new Date().toISOString().split('T')[0],
        expiry_date: expiryDate,
        freshness: 'fresh',
        confidence: 1.0,
      })
      .select()
      .single()

    if (error) {
      console.error('Save leftover error:', error)
      return NextResponse.json({ error: 'Failed to save leftover' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      item: data,
    })
  } catch (error) {
    console.error('Leftover save error:', error)
    return NextResponse.json({ error: 'Failed to save leftover' }, { status: 500 })
  }
}
