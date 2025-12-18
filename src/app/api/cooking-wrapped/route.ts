import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

interface RecipeData {
  id: string
  name: string
  cuisine_type: string | null
  tags: string[]
  ingredients: Array<{ name: string; quantity?: string | number; unit?: string }>
  estimated_time_minutes: number | null
  times_cooked: number
  is_favorite: boolean
  created_at: string
}

interface CookedMealData {
  id: string
  name: string
  cuisine_type: string | null
  cooking_method: string | null
  cooked_at: string
}

interface EatingOutData {
  id: string
  meal_name: string | null
  cuisine_type: string | null
  eaten_at: string
}

interface ReceiptData {
  id: string
  store_name: string | null
  total: number
  receipt_date: string
}

interface ReceiptItemData {
  id: string
  item_name: string
  category: string | null
  quantity: number
  total_price: number
}

// GET - Generate Cooking Wrapped insights
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all cooking data including receipts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [recipesResult, cookedMealsResult, eatingOutResult, inventoryResult, receiptsResult, receiptItemsResult] = await Promise.all([
      (supabase as any).from('saved_recipes').select('*').eq('user_id', user.id),
      (supabase as any).from('cooked_meals').select('*').eq('user_id', user.id),
      (supabase as any).from('eating_out_logs').select('*').eq('user_id', user.id),
      (supabase as any).from('inventory_items').select('*').eq('user_id', user.id),
      (supabase as any).from('receipts').select('*').eq('user_id', user.id),
      (supabase as any).from('receipt_items').select('*').eq('user_id', user.id),
    ])

    const recipes: RecipeData[] = recipesResult.data || []
    const cookedMeals: CookedMealData[] = cookedMealsResult.data || []
    const eatingOut: EatingOutData[] = eatingOutResult.data || []
    const inventoryItems = inventoryResult.data || []
    const receipts: ReceiptData[] = receiptsResult.data || []
    const receiptItems: ReceiptItemData[] = receiptItemsResult.data || []

    // Calculate statistics
    const stats = calculateStats(recipes, cookedMeals, eatingOut, inventoryItems, receipts, receiptItems)

    // Generate AI insights
    const aiInsights = await generateAIInsights(stats)

    return NextResponse.json({
      year: 2025,
      stats,
      insights: aiInsights,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cooking Wrapped error:', error)
    return NextResponse.json(
      { error: 'Failed to generate Cooking Wrapped' },
      { status: 500 }
    )
  }
}

function calculateStats(
  recipes: RecipeData[],
  cookedMeals: CookedMealData[],
  eatingOut: EatingOutData[],
  inventoryItems: Array<{ name: string; category?: string }>,
  receipts: ReceiptData[],
  receiptItems: ReceiptItemData[]
) {
  // Total meals cooked - estimate from receipts if no cooking data
  const totalFromRecipes = recipes.reduce((sum, r) => sum + (r.times_cooked || 0), 0)
  const totalLoggedMeals = cookedMeals.length

  // Estimate meals from grocery trips (assume ~7 meals per grocery trip)
  const groceryTrips = receipts.length
  const estimatedMealsFromGroceries = groceryTrips * 7

  const totalMealsCooked = totalFromRecipes + totalLoggedMeals > 0
    ? totalFromRecipes + totalLoggedMeals
    : estimatedMealsFromGroceries
  const totalEatingOut = eatingOut.length

  // Time spent cooking (estimate: 30 min per estimated meal if no recipe data)
  const totalMinutesCooked = totalFromRecipes > 0
    ? recipes.reduce((sum, r) => {
        const timesCooked = r.times_cooked || 0
        const timePerCook = r.estimated_time_minutes || 30
        return sum + (timesCooked * timePerCook)
      }, 0)
    : estimatedMealsFromGroceries * 30
  const totalHoursCooked = Math.round(totalMinutesCooked / 60)

  // Most cooked recipes (top 5)
  const topRecipes = [...recipes]
    .filter(r => r.times_cooked > 0)
    .sort((a, b) => b.times_cooked - a.times_cooked)
    .slice(0, 5)
    .map(r => ({ name: r.name, times: r.times_cooked, cuisine: r.cuisine_type }))

  // Cuisine breakdown
  const cuisineCounts: Record<string, number> = {}
  recipes.forEach(r => {
    if (r.cuisine_type && r.times_cooked > 0) {
      cuisineCounts[r.cuisine_type] = (cuisineCounts[r.cuisine_type] || 0) + r.times_cooked
    }
  })
  cookedMeals.forEach(m => {
    if (m.cuisine_type) {
      cuisineCounts[m.cuisine_type] = (cuisineCounts[m.cuisine_type] || 0) + 1
    }
  })
  const topCuisines = Object.entries(cuisineCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cuisine, count]) => ({ cuisine, count }))

  // Top purchased items from receipts
  const itemCounts: Record<string, { count: number; spent: number }> = {}
  receiptItems.forEach(item => {
    const name = item.item_name.toLowerCase()
    if (!itemCounts[name]) {
      itemCounts[name] = { count: 0, spent: 0 }
    }
    itemCounts[name].count += item.quantity || 1
    itemCounts[name].spent += item.total_price || 0
  })
  const topPurchasedItems = Object.entries(itemCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([name, data]) => ({ name, count: data.count, spent: Math.round(data.spent * 100) / 100 }))

  // Ingredient frequency from recipes (fallback to purchased items)
  const ingredientCounts: Record<string, number> = {}
  recipes.forEach(r => {
    const timesCooked = r.times_cooked || 0
    if (timesCooked > 0 && r.ingredients) {
      r.ingredients.forEach(ing => {
        const name = ing.name.toLowerCase()
        ingredientCounts[name] = (ingredientCounts[name] || 0) + timesCooked
      })
    }
  })
  // If no recipe ingredients, use purchased items
  const topIngredients = Object.keys(ingredientCounts).length > 0
    ? Object.entries(ingredientCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ingredient, count]) => ({ ingredient, count }))
    : topPurchasedItems.slice(0, 10).map(item => ({ ingredient: item.name, count: item.count }))

  // Cooking methods from logged meals
  const methodCounts: Record<string, number> = {}
  cookedMeals.forEach(m => {
    if (m.cooking_method) {
      methodCounts[m.cooking_method] = (methodCounts[m.cooking_method] || 0) + 1
    }
  })
  const topMethods = Object.entries(methodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([method, count]) => ({ method, count }))

  // Category breakdown from receipts
  const categorySpending: Record<string, number> = {}
  receiptItems.forEach(item => {
    const category = item.category || 'other'
    categorySpending[category] = (categorySpending[category] || 0) + (item.total_price || 0)
  })
  const topCategories = Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, spent]) => ({ category, spent: Math.round(spent * 100) / 100 }))

  // Store breakdown
  const storeCounts: Record<string, { visits: number; spent: number }> = {}
  receipts.forEach(r => {
    const store = r.store_name || 'Unknown'
    if (!storeCounts[store]) {
      storeCounts[store] = { visits: 0, spent: 0 }
    }
    storeCounts[store].visits += 1
    storeCounts[store].spent += r.total || 0
  })
  const topStores = Object.entries(storeCounts)
    .sort((a, b) => b[1].visits - a[1].visits)
    .slice(0, 5)
    .map(([store, data]) => ({ store, visits: data.visits, spent: Math.round(data.spent * 100) / 100 }))

  // Tags/dietary preferences
  const tagCounts: Record<string, number> = {}
  recipes.forEach(r => {
    if (r.tags && r.times_cooked > 0) {
      r.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + r.times_cooked
      })
    }
  })
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }))

  // Favorite recipes
  const favorites = recipes.filter(r => r.is_favorite).map(r => r.name)

  // Recipe collection size
  const totalRecipesSaved = recipes.length

  // Total spending
  const totalSpent = receipts.reduce((sum, r) => sum + (r.total || 0), 0)
  const avgPerTrip = groceryTrips > 0 ? Math.round(totalSpent / groceryTrips * 100) / 100 : 0

  // Inventory diversity
  const inventoryCategories: Record<string, number> = {}
  inventoryItems.forEach(item => {
    const cat = item.category || 'other'
    inventoryCategories[cat] = (inventoryCategories[cat] || 0) + 1
  })

  // Eating habits ratio
  const homeCookedRatio = totalMealsCooked > 0 || totalEatingOut > 0
    ? Math.round((totalMealsCooked / (totalMealsCooked + totalEatingOut)) * 100)
    : (groceryTrips > 0 ? 85 : 0) // Assume 85% home cooked if they grocery shop

  // Average cooking time
  const avgCookingTime = totalFromRecipes > 0
    ? Math.round(totalMinutesCooked / totalFromRecipes)
    : 30 // Default estimate

  // Unique cuisines tried
  const uniqueCuisines = new Set([
    ...recipes.filter(r => r.cuisine_type && r.times_cooked > 0).map(r => r.cuisine_type),
    ...cookedMeals.filter(m => m.cuisine_type).map(m => m.cuisine_type),
  ])

  // Unique items purchased
  const uniqueItemsPurchased = new Set(receiptItems.map(i => i.item_name.toLowerCase())).size

  return {
    totalMealsCooked,
    totalEatingOut,
    totalHoursCooked,
    avgCookingTime,
    homeCookedRatio,
    totalRecipesSaved,
    topRecipes,
    topCuisines,
    topIngredients,
    topMethods,
    topTags,
    favorites,
    uniqueCuisineCount: uniqueCuisines.size,
    inventoryCategories,
    // New receipt-based stats
    groceryTrips,
    totalSpent,
    avgPerTrip,
    topPurchasedItems,
    topCategories,
    topStores,
    uniqueItemsPurchased,
    totalItemsPurchased: receiptItems.reduce((sum, i) => sum + (i.quantity || 1), 0),
  }
}

async function generateAIInsights(stats: ReturnType<typeof calculateStats>) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `You are a fun, insightful food personality analyst for a "Cooking Wrapped 2025" feature (like Spotify Wrapped but for cooking).

Based on this cooking and grocery data, generate personalized insights. Be specific, fun, and use the actual data. Use emojis sparingly but effectively.

COOKING & GROCERY DATA:
- Estimated meals cooked at home: ${stats.totalMealsCooked}
- Times ate out: ${stats.totalEatingOut}
- Home cooking ratio: ${stats.homeCookedRatio}%
- Total hours spent cooking (estimated): ${stats.totalHoursCooked}
- Average cooking time per meal: ${stats.avgCookingTime} minutes
- Recipes saved: ${stats.totalRecipesSaved}
- Unique cuisines tried: ${stats.uniqueCuisineCount}

GROCERY SHOPPING:
- Total grocery trips: ${stats.groceryTrips}
- Total spent on groceries: $${stats.totalSpent.toFixed(2)}
- Average per trip: $${stats.avgPerTrip.toFixed(2)}
- Unique items purchased: ${stats.uniqueItemsPurchased}
- Total items bought: ${stats.totalItemsPurchased}

Top purchased items (what they actually buy):
${stats.topPurchasedItems.slice(0, 10).map((i, idx) => `${idx + 1}. ${i.name} (${i.count}x, $${i.spent})`).join('\n')}

Favorite stores:
${stats.topStores.map(s => `- ${s.store}: ${s.visits} visits, $${s.spent} spent`).join('\n')}

Spending by category:
${stats.topCategories.map(c => `- ${c.category}: $${c.spent}`).join('\n')}

Top 5 most cooked recipes:
${stats.topRecipes.length > 0 ? stats.topRecipes.map((r, i) => `${i + 1}. ${r.name} (${r.times} times) - ${r.cuisine || 'Unknown cuisine'}`).join('\n') : 'No recipes tracked yet'}

Top cuisines:
${stats.topCuisines.length > 0 ? stats.topCuisines.map(c => `- ${c.cuisine}: ${c.count} times`).join('\n') : 'Not tracked yet'}

Most used ingredients (from recipes or purchases):
${stats.topIngredients.slice(0, 7).map(i => `- ${i.ingredient}: ${i.count} uses/purchases`).join('\n')}

Cooking methods used:
${stats.topMethods.length > 0 ? stats.topMethods.map(m => `- ${m.method}: ${m.count} times`).join('\n') : 'Not tracked yet'}

Favorite recipes: ${stats.favorites.join(', ') || 'None marked'}

Return a JSON object with these exact fields (no markdown, just JSON):
{
  "foodPersonality": {
    "title": "A fun 2-4 word title like 'The Comfort Curator' or 'Spice Explorer'",
    "description": "2-3 sentences describing their cooking personality based on actual data"
  },
  "tastePalette": {
    "primary": "Their dominant flavor profile (e.g., 'Umami-forward', 'Fresh & Herbaceous')",
    "secondary": "Secondary taste preference",
    "description": "1-2 sentences about their taste preferences based on ingredients/cuisines"
  },
  "cookingStyle": {
    "type": "Their cooking style (e.g., 'Efficient Weeknight Chef', 'Weekend Feast Maker')",
    "description": "1-2 sentences about how they cook based on time data and methods"
  },
  "signatureMoment": "A specific, fun observation about their cooking habits (reference actual recipes/ingredients)",
  "hiddenTalent": "Something positive about their cooking based on the data",
  "growth2026": {
    "challenge": "A specific cooking challenge for 2026 based on what they haven't tried",
    "newCuisine": "Suggest a specific cuisine they should explore and why",
    "skillToLearn": "A specific cooking skill or technique to master",
    "ingredientToTry": "A specific ingredient they might not have used much"
  },
  "funFacts": [
    "First fun fact with a specific number or comparison",
    "Second fun fact referencing their actual data",
    "Third fun fact with a playful observation"
  ]
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    throw new Error('Failed to parse AI response')
  } catch (error) {
    console.error('AI insights error:', error)
    // Return fallback insights
    return {
      foodPersonality: {
        title: 'Home Chef in the Making',
        description: `With ${stats.totalMealsCooked} meals cooked, you're building great cooking habits!`,
      },
      tastePalette: {
        primary: stats.topCuisines[0]?.cuisine || 'Eclectic',
        secondary: stats.topCuisines[1]?.cuisine || 'Versatile',
        description: 'Your taste palette is developing nicely.',
      },
      cookingStyle: {
        type: stats.avgCookingTime < 30 ? 'Quick & Efficient' : 'Thoughtful & Deliberate',
        description: `You spend about ${stats.avgCookingTime} minutes per meal on average.`,
      },
      signatureMoment: stats.topRecipes[0]
        ? `${stats.topRecipes[0].name} is clearly a household favorite!`
        : 'Every meal is a new adventure.',
      hiddenTalent: 'Your consistency in cooking shows real dedication.',
      growth2026: {
        challenge: 'Try cooking one completely new cuisine each month',
        newCuisine: 'Thai cuisine - it would complement your current favorites',
        skillToLearn: 'Master the art of making fresh pasta',
        ingredientToTry: 'Miso paste - adds amazing depth to any dish',
      },
      funFacts: [
        `You've spent ${stats.totalHoursCooked} hours in the kitchen - that's dedication!`,
        `${stats.homeCookedRatio}% of your meals were home-cooked`,
        `You've saved ${stats.totalRecipesSaved} recipes to your collection`,
      ],
    }
  }
}
