import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { compareProducts } from '@/lib/gemini/brands'

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
    const { image, question } = body

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: 'image (base64) is required' },
        { status: 400 }
      )
    }

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'question is required' },
        { status: 400 }
      )
    }

    // Call Gemini to compare products
    const comparison = await compareProducts(image, question)

    return NextResponse.json(comparison)
  } catch (error) {
    console.error('Error in compare-products API:', error)
    return NextResponse.json(
      { error: 'Failed to compare products' },
      { status: 500 }
    )
  }
}
