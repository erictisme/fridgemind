import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseRecipeText } from '@/lib/gemini/recipes'

interface RequestBody {
  text: string
  save?: boolean // If true, save directly to database
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as RequestBody
    const { text, save = false } = body

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Recipe text is required' }, { status: 400 })
    }

    // Parse the recipe text using Gemini
    const parsedRecipe = await parseRecipeText(text.trim())

    if (!parsedRecipe.is_recipe) {
      return NextResponse.json({
        success: false,
        is_recipe: false,
        message: 'The text does not appear to be a recipe',
        parsed: parsedRecipe,
      })
    }

    // If save is true, store the recipe in the database
    if (save) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: savedRecipe, error } = await (supabase as any)
        .from('saved_recipes')
        .insert({
          user_id: user.id,
          name: parsedRecipe.name,
          description: parsedRecipe.description,
          source_type: 'manual',
          ingredients: parsedRecipe.ingredients,
          instructions: parsedRecipe.instructions,
          estimated_time_minutes: parsedRecipe.estimated_time_minutes,
          servings: parsedRecipe.servings || 2,
          cuisine_type: parsedRecipe.cuisine_type,
          tags: parsedRecipe.tags,
          is_favorite: false,
          times_cooked: 0,
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to save recipe:', error)
        return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        is_recipe: true,
        parsed: parsedRecipe,
        saved: true,
        recipe: savedRecipe,
      })
    }

    // Just return the parsed recipe for preview
    return NextResponse.json({
      success: true,
      is_recipe: true,
      parsed: parsedRecipe,
      saved: false,
    })
  } catch (error) {
    console.error('Parse recipe text error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse recipe' },
      { status: 500 }
    )
  }
}
