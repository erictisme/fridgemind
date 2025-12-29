import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeNutritionFromText } from '@/lib/gemini/vision'

interface RequestBody {
  description: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as RequestBody
    const { description } = body

    if (!description || description.trim().length === 0) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    // Use Gemini to estimate nutrition from text description
    const nutrition = await analyzeNutritionFromText(description.trim())

    return NextResponse.json({
      success: true,
      ...nutrition,
    })

  } catch (error) {
    console.error('Nutrition estimate error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to estimate nutrition' },
      { status: 500 }
    )
  }
}
