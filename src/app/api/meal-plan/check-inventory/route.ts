import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RecipeIngredient {
  name: string
  quantity?: string | number
  unit?: string
  optional?: boolean
}

interface PlannedRecipeInput {
  recipe_id: string
  servings: number
}

interface IngredientStatus {
  name: string
  required_qty: number
  available_qty: number
  unit: string | null
  status: 'available' | 'partial' | 'missing'
  shortage: number
}

interface RecipeCheckResult {
  recipe_id: string
  recipe_name: string
  ingredients: IngredientStatus[]
}

interface ShortageItem {
  name: string
  quantity: number
  unit: string | null
}

// POST - Check inventory availability for planned recipes
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { recipes } = body as { recipes: PlannedRecipeInput[] }

    if (!recipes || recipes.length === 0) {
      return NextResponse.json({ error: 'No recipes provided' }, { status: 400 })
    }

    // Get all requested recipes
    const recipeIds = recipes.map(r => r.recipe_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: savedRecipes, error: recipesError } = await (supabase as any)
      .from('saved_recipes')
      .select('id, name, servings, ingredients')
      .eq('user_id', user.id)
      .in('id', recipeIds)

    if (recipesError) {
      console.error('Error fetching recipes:', recipesError)
      return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 })
    }

    // Get user's inventory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inventory } = await (supabase as any)
      .from('inventory_items')
      .select('id, name, quantity, unit')
      .eq('user_id', user.id)

    const inventoryItems: Array<{ id: string; name: string; quantity: number; unit: string | null }> = inventory || []

    // Create a map of available quantities (to track usage across recipes)
    const availableQty: Record<string, { quantity: number; unit: string | null; originalName: string }> = {}
    for (const item of inventoryItems) {
      availableQty[item.name.toLowerCase()] = {
        quantity: item.quantity,
        unit: item.unit,
        originalName: item.name,
      }
    }

    // Check each recipe
    const recipeResults: RecipeCheckResult[] = []
    const aggregatedShortages: Record<string, ShortageItem> = {}

    for (const plannedRecipe of recipes) {
      const recipe = savedRecipes?.find((r: { id: string }) => r.id === plannedRecipe.recipe_id)
      if (!recipe) continue

      const recipeIngredients: RecipeIngredient[] = recipe.ingredients || []
      const servingsMultiplier = plannedRecipe.servings / (recipe.servings || 2)

      const ingredientStatuses: IngredientStatus[] = []

      for (const ingredient of recipeIngredients) {
        if (ingredient.optional) continue

        const ingredientName = ingredient.name.toLowerCase()

        // Find matching inventory item (fuzzy match)
        const matchKey = Object.keys(availableQty).find(itemName => {
          return itemName.includes(ingredientName) ||
                 ingredientName.includes(itemName) ||
                 itemName.includes(ingredientName.replace(/s$/, '')) ||
                 ingredientName.includes(itemName.replace(/s$/, ''))
        })

        // Calculate required quantity
        let requiredQty = 1
        const qty = ingredient.quantity
        if (typeof qty === 'number') {
          requiredQty = qty * servingsMultiplier
        } else if (typeof qty === 'string') {
          const parsed = parseFloat(qty)
          if (!isNaN(parsed)) {
            requiredQty = parsed * servingsMultiplier
          }
        }

        let status: 'available' | 'partial' | 'missing' = 'missing'
        let availableAmount = 0
        let shortage = requiredQty

        if (matchKey && availableQty[matchKey]) {
          availableAmount = availableQty[matchKey].quantity

          if (availableAmount >= requiredQty) {
            status = 'available'
            shortage = 0
            // Deduct from available (for next recipe checks)
            availableQty[matchKey].quantity -= requiredQty
          } else if (availableAmount > 0) {
            status = 'partial'
            shortage = requiredQty - availableAmount
            // Use all available
            availableQty[matchKey].quantity = 0
          }
        }

        ingredientStatuses.push({
          name: ingredient.name,
          required_qty: Math.round(requiredQty * 10) / 10,
          available_qty: Math.round(availableAmount * 10) / 10,
          unit: ingredient.unit || null,
          status,
          shortage: Math.round(shortage * 10) / 10,
        })

        // Track aggregate shortages
        if (shortage > 0) {
          const shortageKey = ingredient.name.toLowerCase()
          if (aggregatedShortages[shortageKey]) {
            aggregatedShortages[shortageKey].quantity += shortage
          } else {
            aggregatedShortages[shortageKey] = {
              name: ingredient.name,
              quantity: shortage,
              unit: ingredient.unit || null,
            }
          }
        }
      }

      recipeResults.push({
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        ingredients: ingredientStatuses,
      })
    }

    // Convert aggregated shortages to array
    const totalShortages: ShortageItem[] = Object.values(aggregatedShortages).map(s => ({
      ...s,
      quantity: Math.round(s.quantity * 10) / 10,
    }))

    return NextResponse.json({
      recipes: recipeResults,
      total_shortages: totalShortages,
      has_shortages: totalShortages.length > 0,
    })
  } catch (error) {
    console.error('Check inventory error:', error)
    return NextResponse.json(
      { error: 'Failed to check inventory' },
      { status: 500 }
    )
  }
}
