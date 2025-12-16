import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { suggestAlternatives } from '@/lib/gemini/shopping'

interface RequestBody {
  item_name: string
  context?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as RequestBody
    const { item_name, context } = body

    if (!item_name || item_name.trim().length === 0) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 })
    }

    // Get alternatives from Gemini
    const result = await suggestAlternatives(item_name.trim(), context)

    return NextResponse.json({
      success: true,
      original_item: item_name,
      alternatives: result.alternatives,
    })
  } catch (error) {
    console.error('Suggest-alternative API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to suggest alternatives' },
      { status: 500 }
    )
  }
}
