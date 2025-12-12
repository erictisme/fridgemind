import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeMultipleImages } from '@/lib/gemini/vision'

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

    // Analyze images with Gemini Vision
    const result = await analyzeMultipleImages(images)

    // Calculate expiry dates from days, default purchase_date to today
    const today = new Date().toISOString().split('T')[0]
    const itemsWithExpiry = result.items.map(item => ({
      ...item,
      purchase_date: today,
      expiry_date: new Date(Date.now() + item.estimated_expiry_days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      location,
    }))

    return NextResponse.json({
      success: true,
      items: itemsWithExpiry,
      summary: result.summary,
      location,
    })
  } catch (error) {
    console.error('Scan error:', error)
    return NextResponse.json(
      { error: 'Failed to process images' },
      { status: 500 }
    )
  }
}
