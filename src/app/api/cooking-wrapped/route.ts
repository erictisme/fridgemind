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

// GET - Generate Cooking Wrapped insights
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all cooking data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [recipesResult, cookedMealsResult, eatingOutResult, inventoryResult] = await Promise.all([
      (supabase as any).from('saved_recipes').select('*').eq('user_id', user.id),
      (supabase as any).from('cooked_meals').select('*').eq('user_id', user.id),
      (supabase as any).from('eating_out_logs').select('*').eq('user_id', user.id),
      (supabase as any).from('inventory_items').select('*').eq('user_id', user.id),
    ])

    const recipes: RecipeData[] = recipesResult.data || []
    const cookedMeals: CookedMealData[] = cookedMealsResult.data || []
    const eatingOut: EatingOutData[] = eatingOutResult.data || []
    const inventoryItems = inventoryResult.data || []

    // Calculate statistics
    const stats = calculateStats(recipes, cookedMeals, eatingOut, inventoryItems)

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
  inventoryItems: Array<{ name: string; category?: string }>
) {
  // Total meals cooked (from recipes + logged meals)
  const totalFromRecipes = recipes.reduce((sum, r) => sum + (r.times_cooked || 0), 0)
  const totalLoggedMeals = cookedMeals.length
  const totalMealsCooked = totalFromRecipes + totalLoggedMeals
  const totalEatingOut = eatingOut.length

  // Time spent cooking (estimate based on recipe times)
  const totalMinutesCooked = recipes.reduce((sum, r) => {
    const timesCooked = r.times_cooked || 0
    const timePerCook = r.estimated_time_minutes || 30 // default 30 min
    return sum + (timesCooked * timePerCook)
  }, 0)
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

  // Ingredient frequency
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
  const topIngredients = Object.entries(ingredientCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ingredient, count]) => ({ ingredient, count }))

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

  // Inventory diversity
  const inventoryCategories: Record<string, number> = {}
  inventoryItems.forEach(item => {
    const cat = item.category || 'other'
    inventoryCategories[cat] = (inventoryCategories[cat] || 0) + 1
  })

  // Eating habits ratio
  const homeCookedRatio = totalMealsCooked > 0 || totalEatingOut > 0
    ? Math.round((totalMealsCooked / (totalMealsCooked + totalEatingOut)) * 100)
    : 0

  // Average cooking time
  const avgCookingTime = totalFromRecipes > 0
    ? Math.round(totalMinutesCooked / totalFromRecipes)
    : 0

  // Unique cuisines tried
  const uniqueCuisines = new Set([
    ...recipes.filter(r => r.cuisine_type && r.times_cooked > 0).map(r => r.cuisine_type),
    ...cookedMeals.filter(m => m.cuisine_type).map(m => m.cuisine_type),
  ])

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
  }
}

async function generateAIInsights(stats: ReturnType<typeof calculateStats>) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `You are a fun, insightful food personality analyst for a "Cooking Wrapped 2025" feature (like Spotify Wrapped but for cooking).

Based on this cooking data, generate personalized insights. Be specific, fun, and use the actual data. Use emojis sparingly but effectively.

COOKING DATA:
- Total meals cooked at home: ${stats.totalMealsCooked}
- Times ate out: ${stats.totalEatingOut}
- Home cooking ratio: ${stats.homeCookedRatio}%
- Total hours spent cooking: ${stats.totalHoursCooked}
- Average cooking time per meal: ${stats.avgCookingTime} minutes
- Recipes saved: ${stats.totalRecipesSaved}
- Unique cuisines tried: ${stats.uniqueCuisineCount}

Top 5 most cooked recipes:
${stats.topRecipes.map((r, i) => `${i + 1}. ${r.name} (${r.times} times) - ${r.cuisine || 'Unknown cuisine'}`).join('\n')}

Top cuisines:
${stats.topCuisines.map(c => `- ${c.cuisine}: ${c.count} times`).join('\n')}

Most used ingredients:
${stats.topIngredients.slice(0, 7).map(i => `- ${i.ingredient}: ${i.count} uses`).join('\n')}

Cooking methods used:
${stats.topMethods.map(m => `- ${m.method}: ${m.count} times`).join('\n')}

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
