import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

interface ParsedItem {
  name: string
  quantity: number
  unit: string
  type: 'protein' | 'carbs' | 'fibre' | 'misc'
}

const PARSE_PROMPT = `You are a grocery list parser. Parse the following text into a structured list of food items.

The text may contain:
- Delivery confirmations (from services like Talula Farms, RedMart, etc.)
- Shopping lists
- Recipe ingredient lists
- Any other format with food items

For each item, extract:
1. name: The clean item name (e.g., "Avocado", "Cherry Tomatoes", "Broccoli")
2. quantity: Number of items/packs (default 1 if not specified)
3. unit: Unit of measurement (pc, g, kg, ml, L, pack, bunch, etc.)
4. type: Nutritional category - one of:
   - "protein" (meat, fish, eggs, tofu, legumes)
   - "carbs" (rice, pasta, bread, potatoes)
   - "fibre" (vegetables, fruits, leafy greens)
   - "misc" (sauces, condiments, dairy, snacks, household items)

Examples:
- "Avocado (1pc) x 1" → {"name": "Avocado", "quantity": 1, "unit": "pc", "type": "fibre"}
- "Tomato (Cherry) (500g) x 1" → {"name": "Cherry Tomatoes", "quantity": 500, "unit": "g", "type": "fibre"}
- "2 chicken breasts" → {"name": "Chicken Breast", "quantity": 2, "unit": "pc", "type": "protein"}
- "Lady Finger (250g) x 1" → {"name": "Okra", "quantity": 250, "unit": "g", "type": "fibre"}

Return ONLY a JSON array of items. Do not include any explanatory text.
If no food items are found, return an empty array: []

Input text:
`

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { text } = await request.json()

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    // Use Gemini to parse the text
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent([
      PARSE_PROMPT,
      text.trim(),
    ])

    const response = await result.response
    const responseText = response.text()

    // Extract JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({
        success: true,
        items: [],
        message: 'No items found in the text',
      })
    }

    let items: ParsedItem[]
    try {
      items = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({
        success: true,
        items: [],
        message: 'Failed to parse AI response',
      })
    }

    // Validate and clean up items
    const validatedItems = items
      .filter(item => item.name && typeof item.name === 'string')
      .map(item => ({
        name: item.name.trim(),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit: item.unit || 'pc',
        type: ['protein', 'carbs', 'fibre', 'misc'].includes(item.type) ? item.type : 'misc',
      }))

    return NextResponse.json({
      success: true,
      items: validatedItems,
      count: validatedItems.length,
    })
  } catch (error) {
    console.error('Parse text error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse text' },
      { status: 500 }
    )
  }
}
