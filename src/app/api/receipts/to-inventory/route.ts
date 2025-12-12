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
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as RequestBody
    const { items, receipt_date } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    if (!receipt_date) {
      return NextResponse.json({ error: 'Receipt date is required' }, { status: 400 })
    }

    const insertedItems: string[] = []
    const errors: Array<{ item: string; error: string }> = []

    // Process each item
    for (const item of items) {
      try {
        // Map category to storage_category and nutritional_type
        const mapping = categoryMapping[item.category] || categoryMapping.other

        // Let Gemini decide storage location AND expiry date
        const storageEstimate = await estimateStorage(item.name, receipt_date)

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
          console.error(`Failed to insert ${item.name}:`, error)
          errors.push({ item: item.name, error: error.message })
        } else {
          insertedItems.push(item.name)
        }
      } catch (error) {
        console.error(`Error processing ${item.name}:`, error)
        errors.push({
          item: item.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      inserted: insertedItems.length,
      items: insertedItems,
      ...(errors.length > 0 && { errors }),
    })
  } catch (error) {
    console.error('Receipt to inventory error:', error)
    return NextResponse.json(
      { error: 'Failed to add items to inventory' },
      { status: 500 }
    )
  }
}
