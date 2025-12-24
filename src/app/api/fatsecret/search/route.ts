import { NextRequest, NextResponse } from 'next/server'
import { searchFoods, autocompleteFoods, isConfigured } from '@/lib/fatsecret/client'

export async function GET(request: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'FatSecret API not configured' },
      { status: 503 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const mode = searchParams.get('mode') || 'search' // 'search' or 'autocomplete'
  const page = parseInt(searchParams.get('page') || '0')
  const maxResults = parseInt(searchParams.get('max') || '20')

  if (!query) {
    return NextResponse.json(
      { error: 'Missing query parameter' },
      { status: 400 }
    )
  }

  try {
    if (mode === 'autocomplete') {
      const suggestions = await autocompleteFoods(query, maxResults)
      return NextResponse.json({ suggestions })
    }

    const result = await searchFoods(query, { page, maxResults })

    // Transform to simpler format for frontend
    const foods = result.foods?.food?.map(food => ({
      id: food.food_id,
      name: food.food_name,
      brand: food.brand_name,
      type: food.food_type,
      description: food.food_description,
    })) || []

    return NextResponse.json({
      foods,
      total: parseInt(result.foods?.total_results || '0'),
      page: parseInt(result.foods?.page_number || '0'),
    })
  } catch (error) {
    console.error('FatSecret search error:', error)
    return NextResponse.json(
      { error: 'Failed to search foods' },
      { status: 500 }
    )
  }
}
