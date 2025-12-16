import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - List user's saved recipes
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const source_type = searchParams.get('source_type')
    const favorites_only = searchParams.get('favorites') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('saved_recipes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (source_type) {
      query = query.eq('source_type', source_type)
    }

    if (favorites_only) {
      query = query.eq('is_favorite', true)
    }

    const { data: recipes, error } = await query

    if (error) {
      console.error('Error fetching recipes:', error)
      return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      recipes: recipes || [],
    })
  } catch (error) {
    console.error('Recipes fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    )
  }
}

// POST - Save a new recipe
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      source_type,
      source_url,
      source_account,
      image_url,
      ingredients,
      instructions,
      estimated_time_minutes,
      servings,
      cuisine_type,
      tags,
      notes,
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Recipe name is required' }, { status: 400 })
    }

    if (!source_type) {
      return NextResponse.json({ error: 'Source type is required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recipe, error } = await (supabase as any)
      .from('saved_recipes')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        source_type,
        source_url: source_url || null,
        source_account: source_account || null,
        image_url: image_url || null,
        ingredients: ingredients || [],
        instructions: instructions || null,
        estimated_time_minutes: estimated_time_minutes || null,
        servings: servings || 2,
        cuisine_type: cuisine_type || null,
        tags: tags || [],
        notes: notes || null,
        is_favorite: false,
        times_cooked: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving recipe:', error)
      return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      recipe,
    })
  } catch (error) {
    console.error('Recipe save error:', error)
    return NextResponse.json(
      { error: 'Failed to save recipe' },
      { status: 500 }
    )
  }
}

// PUT - Update a recipe
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, ...updates } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Recipe ID is required' }, { status: 400 })
    }

    // Add updated_at timestamp
    updates.updated_at = new Date().toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recipe, error } = await (supabase as any)
      .from('saved_recipes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating recipe:', error)
      return NextResponse.json({ error: 'Failed to update recipe' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      recipe,
    })
  } catch (error) {
    console.error('Recipe update error:', error)
    return NextResponse.json(
      { error: 'Failed to update recipe' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a recipe
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Recipe ID is required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('saved_recipes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting recipe:', error)
      return NextResponse.json({ error: 'Failed to delete recipe' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Recipe deleted',
    })
  } catch (error) {
    console.error('Recipe delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete recipe' },
      { status: 500 }
    )
  }
}
