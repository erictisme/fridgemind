import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMealSuggestions } from '@/lib/gemini/vision'

interface Staple {
  name: string
  is_staple: boolean
  is_occasional: boolean
}

// POST: Generate suggestions with specific options (selected items, recipe count)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { mustUseItems, recipeCount, challenge, cookingMethods, remarks } = body as {
      mustUseItems?: string[]
      recipeCount?: number
      challenge?: boolean
      cookingMethods?: string[]
      remarks?: string
    }

    // Fetch user's inventory (exclude consumed items)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items, error } = await (supabase as any)
      .from('inventory_items')
      .select('name, quantity, expiry_date')
      .eq('user_id', user.id)
      .is('consumed_at', null)
      .order('expiry_date', { ascending: true })

    if (error) {
      console.error('Fetch inventory error:', error)
      return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: [],
        message: 'No items in inventory. Scan your kitchen to get meal suggestions!',
      })
    }

    // Fetch user's staples
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: staples } = await (supabase as any)
      .from('user_staples')
      .select('name, is_staple, is_occasional')
      .eq('user_id', user.id)

    // Get user's taste profile for preferences
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('taste_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Build preferences string from profile
    const prefParts: string[] = []
    if (profile) {
      if (profile.skill_level) prefParts.push(`Skill level: ${profile.skill_level}`)
      if (profile.cooking_time_preference) prefParts.push(`Time preference: ${profile.cooking_time_preference}`)
      if (profile.spice_tolerance) prefParts.push(`Spice tolerance: ${profile.spice_tolerance}`)
      if (profile.dietary_restrictions?.length > 0) {
        prefParts.push(`Dietary restrictions: ${profile.dietary_restrictions.join(', ')}`)
      }
      if (profile.cuisine_preferences?.length > 0) {
        const cuisines = profile.cuisine_preferences.map((c: { cuisine: string }) => c.cuisine).join(', ')
        prefParts.push(`Preferred cuisines: ${cuisines}`)
      }
    }

    // Add staples context to preferences
    const stapleItems = staples?.filter((s: Staple) => s.is_staple).map((s: Staple) => s.name) || []
    const occasionalItems = staples?.filter((s: Staple) => s.is_occasional).map((s: Staple) => s.name) || []

    if (stapleItems.length > 0) {
      prefParts.push(`User's staple items (always available): ${stapleItems.slice(0, 10).join(', ')}`)
    }

    if (challenge && occasionalItems.length > 0) {
      prefParts.push(`CHALLENGE MODE: Try to suggest meals that use different ingredients than their usual staples. Encourage variety and new flavors!`)
      prefParts.push(`Items they could try using more creatively: ${occasionalItems.slice(0, 5).join(', ')}`)
    }

    const preferences = prefParts.length > 0 ? prefParts.join('. ') : undefined

    // Generate suggestions with Gemini
    const suggestions = await generateMealSuggestions(items, preferences, {
      recipeCount: recipeCount || 3,
      mustUseItems: mustUseItems || [],
      cookingMethods: cookingMethods || [],
      remarks: remarks || '',
    })

    return NextResponse.json({
      success: true,
      suggestions,
      inventory_count: items.length,
      challenge_mode: challenge,
      staples_count: stapleItems.length,
      options_used: {
        must_use_items: mustUseItems || [],
        recipe_count: recipeCount || 3,
      },
    })
  } catch (error) {
    console.error('Suggestions error:', error)
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}

// GET: Legacy endpoint - generate suggestions with basic options
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for "challenge variety" mode
    const { searchParams } = new URL(request.url)
    const challengeVariety = searchParams.get('challenge') === 'true'

    // Fetch user's inventory (exclude consumed items)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items, error } = await (supabase as any)
      .from('inventory_items')
      .select('name, quantity, expiry_date')
      .eq('user_id', user.id)
      .is('consumed_at', null)
      .order('expiry_date', { ascending: true })

    if (error) {
      console.error('Fetch inventory error:', error)
      return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: [],
        message: 'No items in inventory. Scan your kitchen to get meal suggestions!',
      })
    }

    // Fetch user's staples
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: staples } = await (supabase as any)
      .from('user_staples')
      .select('name, is_staple, is_occasional')
      .eq('user_id', user.id)

    // Create a map of staple info for quick lookup
    const stapleMap = new Map<string, Staple>()
    if (staples) {
      for (const s of staples as Staple[]) {
        stapleMap.set(s.name.toLowerCase(), s)
      }
    }

    // Get user's taste profile for preferences
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('taste_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Build preferences string from profile
    const prefParts: string[] = []
    if (profile) {
      if (profile.skill_level) prefParts.push(`Skill level: ${profile.skill_level}`)
      if (profile.cooking_time_preference) prefParts.push(`Time preference: ${profile.cooking_time_preference}`)
      if (profile.spice_tolerance) prefParts.push(`Spice tolerance: ${profile.spice_tolerance}`)
      if (profile.dietary_restrictions?.length > 0) {
        prefParts.push(`Dietary restrictions: ${profile.dietary_restrictions.join(', ')}`)
      }
      if (profile.cuisine_preferences?.length > 0) {
        const cuisines = profile.cuisine_preferences.map((c: { cuisine: string }) => c.cuisine).join(', ')
        prefParts.push(`Preferred cuisines: ${cuisines}`)
      }
    }

    // Add staples context to preferences
    const stapleItems = staples?.filter((s: Staple) => s.is_staple).map((s: Staple) => s.name) || []
    const occasionalItems = staples?.filter((s: Staple) => s.is_occasional).map((s: Staple) => s.name) || []

    if (stapleItems.length > 0) {
      prefParts.push(`User's staple items (always available): ${stapleItems.slice(0, 10).join(', ')}`)
    }

    if (challengeVariety && occasionalItems.length > 0) {
      prefParts.push(`CHALLENGE MODE: Try to suggest meals that use different ingredients than their usual staples. Encourage variety and new flavors!`)
      prefParts.push(`Items they could try using more creatively: ${occasionalItems.slice(0, 5).join(', ')}`)
    }

    const preferences = prefParts.length > 0 ? prefParts.join('. ') : undefined

    // Generate suggestions with Gemini
    const suggestions = await generateMealSuggestions(items, preferences)

    return NextResponse.json({
      success: true,
      suggestions,
      inventory_count: items.length,
      challenge_mode: challengeVariety,
      staples_count: stapleItems.length,
    })
  } catch (error) {
    console.error('Suggestions error:', error)
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}
