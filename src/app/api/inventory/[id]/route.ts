import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE - Remove item from inventory with reason tracking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const reason = body.reason as 'eaten' | 'bad' | 'wrong' | undefined

    // Get the item first to log what was deleted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: item } = await (supabase as any)
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // If reason is 'eaten' or 'bad', we could log to a waste_log table
    // For now, just update consumed_at and waste_reason
    if (reason === 'eaten') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('inventory_items')
        .update({
          consumed_at: new Date().toISOString(),
          waste_reason: null,
        })
        .eq('id', id)
        .eq('user_id', user.id)
    } else if (reason === 'bad') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('inventory_items')
        .update({
          consumed_at: new Date().toISOString(),
          waste_reason: 'spoiled',
        })
        .eq('id', id)
        .eq('user_id', user.id)
    } else {
      // 'wrong' or no reason - just delete
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('inventory_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
    }

    return NextResponse.json({
      success: true,
      message: 'Item removed',
      reason,
    })
  } catch (error) {
    console.error('Delete inventory item error:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
