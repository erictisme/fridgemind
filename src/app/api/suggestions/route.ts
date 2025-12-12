import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMealSuggestions } from '@/lib/gemini/vision'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's inventory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items, error } = await (supabase as any)
      .from('inventory_items')
      .select('name, quantity, expiry_date')
      .eq('user_id', user.id)
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

    // Get user's taste profile for preferences
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('taste_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Build preferences string from profile
    let preferences = ''
    if (profile) {
      const parts = []
      if (profile.skill_level) parts.push(`Skill level: ${profile.skill_level}`)
      if (profile.cooking_time_preference) parts.push(`Time preference: ${profile.cooking_time_preference}`)
      if (profile.spice_tolerance) parts.push(`Spice tolerance: ${profile.spice_tolerance}`)
      if (profile.dietary_restrictions?.length > 0) {
        parts.push(`Dietary restrictions: ${profile.dietary_restrictions.join(', ')}`)
      }
      if (profile.cuisine_preferences?.length > 0) {
        const cuisines = profile.cuisine_preferences.map((c: { cuisine: string }) => c.cuisine).join(', ')
        parts.push(`Preferred cuisines: ${cuisines}`)
      }
      preferences = parts.join('. ')
    }

    // Generate suggestions with Gemini
    const suggestions = await generateMealSuggestions(items, preferences || undefined)

    return NextResponse.json({
      success: true,
      suggestions,
      inventory_count: items.length,
    })
  } catch (error) {
    console.error('Suggestions error:', error)
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}
