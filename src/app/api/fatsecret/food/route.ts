import { NextRequest, NextResponse } from 'next/server'
import { getNutrition, getFood, isConfigured } from '@/lib/fatsecret/client'

export async function GET(request: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'FatSecret API not configured' },
      { status: 503 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const foodId = searchParams.get('id')
  const detailed = searchParams.get('detailed') === 'true'

  if (!foodId) {
    return NextResponse.json(
      { error: 'Missing food ID parameter' },
      { status: 400 }
    )
  }

  try {
    if (detailed) {
      // Return full food data with all servings
      const result = await getFood(foodId)
      return NextResponse.json(result.food)
    }

    // Return normalized nutrition (simpler format)
    const nutrition = await getNutrition(foodId)

    if (!nutrition) {
      return NextResponse.json(
        { error: 'Food not found or no nutrition data' },
        { status: 404 }
      )
    }

    return NextResponse.json(nutrition)
  } catch (error) {
    console.error('FatSecret food lookup error:', error)
    return NextResponse.json(
      { error: 'Failed to get food data' },
      { status: 500 }
    )
  }
}
