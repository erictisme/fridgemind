import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeImagesWithInventory } from '@/lib/gemini/vision'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { images, location } = body as { images: string[]; location: string }

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    if (!location || !['fridge', 'freezer', 'pantry'].includes(location)) {
      return NextResponse.json({ error: 'Invalid location' }, { status: 400 })
    }

    // Fetch existing inventory for this location to cross-check for duplicates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingItems } = await (supabase as any)
      .from('inventory_items')
      .select('name, quantity')
      .eq('user_id', user.id)
      .eq('location', location)
      .is('consumed_at', null)

    // Analyze images with Gemini Vision, cross-checking against existing inventory
    const result = await analyzeImagesWithInventory(
      images,
      existingItems || []
    )

    // Calculate expiry dates from days, default purchase_date to today
    const today = new Date().toISOString().split('T')[0]
    const itemsWithExpiry = result.items.map(item => ({
      ...item,
      purchase_date: today,
      expiry_date: new Date(Date.now() + item.estimated_expiry_days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      location,
      // Duplicate detection fields from AI
      is_new_item: item.is_new_item ?? true,
      possible_duplicate_of: item.possible_duplicate_of ?? null,
    }))

    // Count duplicates for summary
    const duplicateCount = itemsWithExpiry.filter(i => !i.is_new_item).length

    return NextResponse.json({
      success: true,
      items: itemsWithExpiry,
      summary: {
        ...result.summary,
        possible_duplicates: duplicateCount,
      },
      location,
      existing_item_count: existingItems?.length || 0,
    })
  } catch (error) {
    console.error('Scan error:', error)
    return NextResponse.json(
      { error: 'Failed to process images' },
      { status: 500 }
    )
  }
}
