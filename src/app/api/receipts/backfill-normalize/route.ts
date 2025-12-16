import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

interface ReceiptItem {
  id: string
  item_name: string
  category: string
}

const NORMALIZE_PROMPT = `You are a receipt item normalizer. Given a list of receipt item names (often cryptic abbreviations from Singapore supermarkets like FairPrice), normalize each one.

For each item:
1. normalized_name: A clean, human-readable name
   - "G JAPANSE CAI XIN220" → "Japanese Cai Xin"
   - "D B.PORK SHOULDER250" → "Pork Shoulder"
   - "CHY TOM 250G" → "Cherry Tomatoes"
   - "FP ORG BN CHKN WHL" → "Organic Chicken Whole"
   - Remove brand codes, weights, store prefixes (G, D, FP, etc.)

2. food_type: A generic type for grouping similar items
   - Use lowercase with underscores
   - Be specific but not brand-specific
   - Examples: "cherry_tomatoes", "pork_shoulder", "leafy_greens", "chicken_whole", "milk", "eggs", "rice"

Return a JSON array matching the input order:
[
  {"normalized_name": "string", "food_type": "string"},
  ...
]

IMPORTANT: Return ONLY the JSON array, no other text.`

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all items without normalized_name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items, error: fetchError } = await (supabase as any)
      .from('receipt_items')
      .select('id, item_name, category')
      .eq('user_id', user.id)
      .is('normalized_name', null)
      .limit(100) // Process in batches

    if (fetchError) {
      console.error('Error fetching items:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items need normalization',
        processed: 0,
        remaining: 0,
      })
    }

    // Get count of remaining items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: remaining } = await (supabase as any)
      .from('receipt_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('normalized_name', null)

    // Prepare items for AI
    const itemNames = (items as ReceiptItem[]).map(i => i.item_name)

    // Call Gemini to normalize
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent([
      NORMALIZE_PROMPT,
      `\n\nItems to normalize:\n${JSON.stringify(itemNames)}`,
    ])

    const response = await result.response
    const text = response.text()

    // Parse response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('Failed to parse normalization response:', text)
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const normalized = JSON.parse(jsonMatch[0]) as { normalized_name: string; food_type: string }[]

    if (normalized.length !== items.length) {
      console.error('Mismatch in normalized count:', normalized.length, 'vs', items.length)
      return NextResponse.json({ error: 'AI returned wrong number of items' }, { status: 500 })
    }

    // Update each item
    let updatedCount = 0
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as ReceiptItem
      const norm = normalized[i]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('receipt_items')
        .update({
          normalized_name: norm.normalized_name,
          food_type: norm.food_type,
        })
        .eq('id', item.id)

      if (!updateError) {
        updatedCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Normalized ${updatedCount} items`,
      processed: updatedCount,
      remaining: (remaining || 0) - updatedCount,
      sample: normalized.slice(0, 5).map((n, i) => ({
        original: itemNames[i],
        normalized: n.normalized_name,
        food_type: n.food_type,
      })),
    })
  } catch (error) {
    console.error('Backfill error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to normalize items' },
      { status: 500 }
    )
  }
}

// GET: Check normalization status
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Count total and unnormalized items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: total } = await (supabase as any)
      .from('receipt_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: unnormalized } = await (supabase as any)
      .from('receipt_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('normalized_name', null)

    return NextResponse.json({
      total: total || 0,
      normalized: (total || 0) - (unnormalized || 0),
      unnormalized: unnormalized || 0,
      percent_complete: total ? Math.round(((total - (unnormalized || 0)) / total) * 100) : 100,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
