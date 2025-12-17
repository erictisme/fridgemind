import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RecipeIngredient {
  name: string
  quantity?: string | number
  unit?: string
  optional?: boolean
}

// POST - Mark recipe as cooked and deduct ingredients from inventory
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { servings_cooked = 1 } = body

    // Get the recipe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recipe, error: recipeError } = await (supabase as any)
      .from('saved_recipes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (recipeError || !recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }

    // Get user's inventory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inventory } = await (supabase as any)
      .from('inventory_items')
      .select('id, name, quantity, unit')
      .eq('user_id', user.id)

    const inventoryItems = inventory || []
    const deductedItems: string[] = []
    const notFoundItems: string[] = []

    // Try to match and deduct each ingredient
    const recipeIngredients: RecipeIngredient[] = recipe.ingredients || []
    const servingsMultiplier = servings_cooked / (recipe.servings || 1)

    for (const ingredient of recipeIngredients) {
      if (ingredient.optional) continue // Skip optional ingredients

      const ingredientName = ingredient.name.toLowerCase()

      // Find matching inventory item (fuzzy match)
      const matchingItem = inventoryItems.find((item: { name: string }) => {
        const itemName = item.name.toLowerCase()
        return itemName.includes(ingredientName) ||
               ingredientName.includes(itemName) ||
               // Handle plurals
               itemName.includes(ingredientName.replace(/s$/, '')) ||
               ingredientName.includes(itemName.replace(/s$/, ''))
      })

      if (matchingItem) {
        // Calculate amount to deduct
        let deductAmount = 1 // Default to 1 serving/unit

        // Try to parse quantity from ingredient
        const qty = ingredient.quantity
        if (typeof qty === 'number') {
          deductAmount = qty * servingsMultiplier
        } else if (typeof qty === 'string') {
          const parsed = parseFloat(qty)
          if (!isNaN(parsed)) {
            deductAmount = parsed * servingsMultiplier
          }
        }

        // Deduct from inventory (reduce quantity, delete if 0 or less)
        const newQuantity = Math.max(0, matchingItem.quantity - deductAmount)

        if (newQuantity <= 0) {
          // Delete the item
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('inventory_items')
            .delete()
            .eq('id', matchingItem.id)
        } else {
          // Update quantity
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('inventory_items')
            .update({ quantity: newQuantity })
            .eq('id', matchingItem.id)
        }

        deductedItems.push(`${ingredient.name} (${deductAmount.toFixed(1)} from ${matchingItem.name})`)
      } else {
        notFoundItems.push(ingredient.name)
      }
    }

    // Update recipe's times_cooked
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('saved_recipes')
      .update({
        times_cooked: (recipe.times_cooked || 0) + 1,
        last_cooked_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      message: 'Recipe marked as cooked',
      times_cooked: (recipe.times_cooked || 0) + 1,
      inventory_updated: {
        deducted: deductedItems,
        not_found: notFoundItems,
      },
    })
  } catch (error) {
    console.error('Cook recipe error:', error)
    return NextResponse.json(
      { error: 'Failed to mark recipe as cooked' },
      { status: 500 }
    )
  }
}
