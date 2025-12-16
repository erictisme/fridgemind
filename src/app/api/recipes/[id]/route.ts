import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch a single recipe by ID
export async function GET(
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recipe, error } = await (supabase as any)
      .from('saved_recipes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      recipe,
    })
  } catch (error) {
    console.error('Recipe fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recipe' },
      { status: 500 }
    )
  }
}
