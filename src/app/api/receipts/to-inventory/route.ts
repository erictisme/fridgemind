import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { estimateStorage } from '@/lib/gemini/vision'

interface ReceiptItemWithInventory {
  name: string
  quantity: number
  unit: string
  category: string
}

interface RequestBody {
  items: ReceiptItemWithInventory[]
  receipt_date: string
}

// Map receipt categories to inventory storage_category and nutritional_type
const categoryMapping: Record<string, { storage_category: string; nutritional_type: string }> = {
  produce: { storage_category: 'produce', nutritional_type: 'vegetables' },
  dairy: { storage_category: 'dairy', nutritional_type: 'dairy' },
  protein: { storage_category: 'protein', nutritional_type: 'protein' },
  pantry: { storage_category: 'pantry', nutritional_type: 'carbs' },
  beverage: { storage_category: 'beverage', nutritional_type: 'other' },
  frozen: { storage_category: 'frozen', nutritional_type: 'other' },
  snacks: { storage_category: 'pantry', nutritional_type: 'carbs' },
  bakery: { storage_category: 'pantry', nutritional_type: 'carbs' },
  other: { storage_category: 'pantry', nutritional_type: 'other' },
}

export async function POST(request: NextRequest) {
  console.log('[to-inventory] Starting POST request')
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.log('[to-inventory] No user found - unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[to-inventory] User authenticated:', user.id)

    const body = await request.json() as RequestBody
    const { items, receipt_date } = body
    console.log('[to-inventory] Received:', { itemCount: items?.length, receipt_date })

    if (!items || items.length === 0) {
      console.log('[to-inventory] No items provided')
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    if (!receipt_date) {
      console.log('[to-inventory] No receipt date')
      return NextResponse.json({ error: 'Receipt date is required' }, { status: 400 })
    }

    const insertedItems: string[] = []
    const errors: Array<{ item: string; error: string }> = []

    // Aggregate duplicate items (same name) by summing quantities
    const aggregatedItems = items.reduce((acc, item) => {
      const existing = acc.find(i => i.name.toLowerCase() === item.name.toLowerCase())
      if (existing) {
        existing.quantity += item.quantity
      } else {
        acc.push({ ...item })
      }
      return acc
    }, [] as ReceiptItemWithInventory[])

    console.log(`[to-inventory] Aggregated ${items.length} items into ${aggregatedItems.length} unique items`)

    // Process each item
    for (const item of aggregatedItems) {
      console.log(`[to-inventory] Processing item: ${item.name}`)
      try {
        // Map category to storage_category and nutritional_type
        const mapping = categoryMapping[item.category] || categoryMapping.other

        // Let Gemini decide storage location AND expiry date
        console.log(`[to-inventory] Calling estimateStorage for: ${item.name}`)
        let storageEstimate
        try {
          storageEstimate = await estimateStorage(item.name, receipt_date)
          console.log(`[to-inventory] Storage estimate for ${item.name}:`, storageEstimate)
        } catch (geminiError) {
          console.error(`[to-inventory] Gemini failed for ${item.name}:`, geminiError)
          // Fallback: default to fridge with 7 days expiry
          const fallbackExpiry = new Date(receipt_date)
          fallbackExpiry.setDate(fallbackExpiry.getDate() + 7)
          storageEstimate = {
            location: 'fridge',
            expiry_date: fallbackExpiry.toISOString().split('T')[0]
          }
          console.log(`[to-inventory] Using fallback for ${item.name}:`, storageEstimate)
        }

        // Insert into inventory using the same pattern as inventory/route.ts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('inventory_items')
          .insert({
            user_id: user.id,
            name: item.name,
            storage_category: mapping.storage_category,
            nutritional_type: mapping.nutritional_type,
            location: storageEstimate.location, // AI decides location
            quantity: item.quantity,
            unit: item.unit,
            purchase_date: receipt_date,
            expiry_date: storageEstimate.expiry_date, // AI decides expiry
            freshness: 'fresh',
            confidence: 1.0,
          })

        if (error) {
          console.error(`[to-inventory] Failed to insert ${item.name}:`, error)
          errors.push({ item: item.name, error: error.message })
        } else {
          console.log(`[to-inventory] Successfully inserted: ${item.name}`)
          insertedItems.push(item.name)
        }
      } catch (error) {
        console.error(`[to-inventory] Error processing ${item.name}:`, error)
        errors.push({
          item: item.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`[to-inventory] Complete. Inserted: ${insertedItems.length}, Errors: ${errors.length}`)
    // Return success response
    return NextResponse.json({
      success: true,
      inserted: insertedItems.length,
      items: insertedItems,
      ...(errors.length > 0 && { errors }),
    })
  } catch (error) {
    console.error('[to-inventory] Receipt to inventory error:', error)
    return NextResponse.json(
      { error: 'Failed to add items to inventory' },
      { status: 500 }
    )
  }
}
