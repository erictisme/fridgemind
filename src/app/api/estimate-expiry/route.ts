import { NextRequest, NextResponse } from 'next/server'
import { estimateExpiry } from '@/lib/gemini/vision'

export async function POST(request: NextRequest) {
  try {
    const { itemName, location, purchaseDate } = await request.json()

    if (!itemName || !location || !purchaseDate) {
      return NextResponse.json(
        { error: 'Missing required fields: itemName, location, purchaseDate' },
        { status: 400 }
      )
    }

    const estimate = await estimateExpiry(itemName, location, purchaseDate)

    return NextResponse.json(estimate)
  } catch (error) {
    console.error('Expiry estimation error:', error)
    return NextResponse.json(
      { error: 'Failed to estimate expiry date' },
      { status: 500 }
    )
  }
}
