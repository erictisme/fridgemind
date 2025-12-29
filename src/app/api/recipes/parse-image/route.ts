import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractRecipeFromImage } from '@/lib/gemini/vision'

interface ParseImageBody {
  file_data: string // base64 image data
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as ParseImageBody
    const { file_data } = body

    if (!file_data) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 })
    }

    // Extract recipe from image using Gemini Vision
    const extracted = await extractRecipeFromImage(file_data)

    if (!extracted.name || extracted.name === 'Untitled Recipe') {
      return NextResponse.json({
        success: false,
        error: 'Could not extract recipe from image. Please make sure the text is clearly visible.',
      }, { status: 400 })
    }

    // Calculate total time if not set
    const totalTime = extracted.total_time_minutes ||
      ((extracted.prep_time_minutes || 0) + (extracted.cook_time_minutes || 0)) ||
      null

    return NextResponse.json({
      success: true,
      recipe: {
        name: extracted.name,
        description: extracted.description,
        servings: extracted.servings,
        prep_time_minutes: extracted.prep_time_minutes,
        cook_time_minutes: extracted.cook_time_minutes,
        total_time_minutes: totalTime,
        ingredients: extracted.ingredients,
        instructions: extracted.instructions,
        cuisine_type: extracted.cuisine_type,
        tags: extracted.tags,
        source_notes: extracted.source_notes,
        confidence: extracted.confidence,
      },
    })

  } catch (error) {
    console.error('Recipe image parse error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse recipe image' },
      { status: 500 }
    )
  }
}
