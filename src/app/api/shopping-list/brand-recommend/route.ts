import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { suggestBrands } from '@/lib/gemini/brands'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { item_name, context } = body

    if (!item_name || typeof item_name !== 'string') {
      return NextResponse.json(
        { error: 'item_name is required' },
        { status: 400 }
      )
    }

    // Call Gemini to suggest brands
    const recommendations = await suggestBrands(
      item_name,
      context
    )

    return NextResponse.json({
      recommendations,
    })
  } catch (error) {
    console.error('Error in brand-recommend API:', error)
    return NextResponse.json(
      { error: 'Failed to suggest brands' },
      { status: 500 }
    )
  }
}
