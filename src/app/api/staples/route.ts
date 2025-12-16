import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface StapleItem {
  id: string
  name: string
  category: string | null
  purchase_count: number
  first_purchased_at: string | null
  last_purchased_at: string | null
  avg_purchase_frequency_days: number | null
  is_staple: boolean
  is_occasional: boolean
  never_suggest_alternative: boolean
  notes: string | null
}

// GET: Fetch user's staples (optionally filter by is_staple/is_occasional)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') // 'staples', 'occasional', 'all'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('user_staples')
      .select('*')
      .eq('user_id', user.id)
      .order('purchase_count', { ascending: false })

    if (filter === 'staples') {
      query = query.eq('is_staple', true)
    } else if (filter === 'occasional') {
      query = query.eq('is_occasional', true)
    }

    const { data: staples, error } = await query

    if (error) {
      console.error('Error fetching staples:', error)
      return NextResponse.json({ error: 'Failed to fetch staples' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      staples: staples || [],
      counts: {
        total: staples?.length || 0,
        staples: staples?.filter((s: StapleItem) => s.is_staple).length || 0,
        occasional: staples?.filter((s: StapleItem) => s.is_occasional).length || 0,
        unclassified: staples?.filter((s: StapleItem) => !s.is_staple && !s.is_occasional).length || 0,
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Update a staple's classification (staple/occasional)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, is_staple, is_occasional, never_suggest_alternative, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'Staple ID required' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof is_staple === 'boolean') updateData.is_staple = is_staple
    if (typeof is_occasional === 'boolean') updateData.is_occasional = is_occasional
    if (typeof never_suggest_alternative === 'boolean') updateData.never_suggest_alternative = never_suggest_alternative
    if (notes !== undefined) updateData.notes = notes

    // If marking as staple, unmark occasional and vice versa
    if (is_staple === true) updateData.is_occasional = false
    if (is_occasional === true) updateData.is_staple = false

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await (supabase as any)
      .from('user_staples')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating staple:', error)
      return NextResponse.json({ error: 'Failed to update staple' }, { status: 500 })
    }

    return NextResponse.json({ success: true, staple: updated })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Clear all staples (for re-analysis with normalized names)
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete all staples for this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('user_staples')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting staples:', error)
      return NextResponse.json({ error: 'Failed to clear staples' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'All staples cleared' })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
