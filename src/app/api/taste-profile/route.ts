import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('taste_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (profile doesn't exist yet)
      console.error('Fetch taste profile error:', error)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      profile: data || null,
      exists: !!data,
    })
  } catch (error) {
    console.error('Taste profile fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      skill_level,
      cooking_time_preference,
      spice_tolerance,
      cuisine_preferences,
      dietary_restrictions,
      onboarding_completed,
    } = body

    // Check if profile exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('taste_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      // Update existing profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('taste_profiles')
        .update({
          skill_level,
          cooking_time_preference,
          spice_tolerance,
          cuisine_preferences,
          dietary_restrictions,
          onboarding_completed,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Update taste profile error:', error)
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
      }

      return NextResponse.json({ success: true, profile: data })
    } else {
      // Create new profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('taste_profiles')
        .insert({
          user_id: user.id,
          skill_level,
          cooking_time_preference,
          spice_tolerance,
          cuisine_preferences,
          dietary_restrictions,
          onboarding_completed,
        })
        .select()
        .single()

      if (error) {
        console.error('Create taste profile error:', error)
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
      }

      return NextResponse.json({ success: true, profile: data })
    }
  } catch (error) {
    console.error('Taste profile update error:', error)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}
