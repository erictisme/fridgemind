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

// Process a batch of items with AI
async function normalizeBatch(items: ReceiptItem[]): Promise<{ normalized_name: string; food_type: string }[]> {
  const itemNames = items.map(i => i.item_name)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent([
    NORMALIZE_PROMPT,
    `\n\nItems to normalize:\n${JSON.stringify(itemNames)}`,
  ])

  const response = await result.response
  const text = response.text()

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response')
  }

  return JSON.parse(jsonMatch[0])
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch ALL items without normalized_name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allItems, error: fetchError } = await (supabase as any)
      .from('receipt_items')
      .select('id, item_name, category')
      .eq('user_id', user.id)
      .is('normalized_name', null)

    if (fetchError) {
      console.error('Error fetching items:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    if (!allItems || allItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items need normalization',
        processed: 0,
        remaining: 0,
      })
    }

    const items = allItems as ReceiptItem[]
    const BATCH_SIZE = 50 // Process 50 items per AI call
    const batches: ReceiptItem[][] = []

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push(items.slice(i, i + BATCH_SIZE))
    }

    // Process all batches in parallel (max 3 concurrent)
    let updatedCount = 0
    const CONCURRENT_LIMIT = 3

    for (let i = 0; i < batches.length; i += CONCURRENT_LIMIT) {
      const batchGroup = batches.slice(i, i + CONCURRENT_LIMIT)

      const results = await Promise.all(
        batchGroup.map(async (batch) => {
          try {
            const normalized = await normalizeBatch(batch)

            // Bulk update using Promise.all
            const updates = batch.map((item, idx) => {
              if (normalized[idx]) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return (supabase as any)
                  .from('receipt_items')
                  .update({
                    normalized_name: normalized[idx].normalized_name,
                    food_type: normalized[idx].food_type,
                  })
                  .eq('id', item.id)
              }
              return Promise.resolve({ error: null })
            })

            const updateResults = await Promise.all(updates)
            return updateResults.filter(r => !r.error).length
          } catch (error) {
            console.error('Batch error:', error)
            return 0
          }
        })
      )

      updatedCount += results.reduce((a, b) => a + b, 0)
    }

    return NextResponse.json({
      success: true,
      message: `Normalized ${updatedCount} items`,
      processed: updatedCount,
      remaining: items.length - updatedCount,
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
