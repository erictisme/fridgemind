import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

interface SearchRequestBody {
  query: string
  ingredients?: string[]
  limit?: number
}

interface RecipeSearchResult {
  name: string
  description: string
  source_url: string
  source_type: 'website' | 'youtube' | 'blog'
  source_name: string
  image_url?: string
  estimated_time_minutes?: number
  ingredients_preview: string[]
  confidence_score: number
}

// Known recipe websites for scoring
const TRUSTED_RECIPE_SITES = [
  'allrecipes.com',
  'foodnetwork.com',
  'bonappetit.com',
  'seriouseats.com',
  'epicurious.com',
  'delish.com',
  'tasty.co',
  'simplyrecipes.com',
  'budgetbytes.com',
  'recipetineats.com',
  'cookieandkate.com',
  'minimalistbaker.com',
  'smittenkitchen.com',
  'thekitchn.com',
  'food52.com',
]

// Extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return ''
  }
}

// Score a recipe result based on source quality
function scoreRecipeSource(url: string, hasIngredients: boolean, hasInstructions: boolean): number {
  let score = 0
  const domain = extractDomain(url)

  // Trusted recipe site bonus
  if (TRUSTED_RECIPE_SITES.some(site => domain.includes(site))) {
    score += 25
  }

  // YouTube video bonus (often has good visuals)
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    score += 15
  }

  // Has ingredients
  if (hasIngredients) {
    score += 30
  }

  // Has instructions
  if (hasInstructions) {
    score += 30
  }

  return score
}

// Fetch and extract recipe data from a URL using Gemini
async function extractRecipeFromUrl(url: string): Promise<{
  name: string
  description: string
  ingredients: string[]
  hasInstructions: boolean
  estimatedTime?: number
  imageUrl?: string
} | null> {
  try {
    // Fetch the page content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FridgeMind/1.0)',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    if (!response.ok) {
      return null
    }

    const html = await response.text()

    // Basic HTML cleaning
    const cleanedHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 15000) // Limit content size

    // Extract image from meta tags
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/)
    const imageUrl = ogImageMatch ? ogImageMatch[1] : undefined

    // Use Gemini to extract recipe info
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `Extract recipe information from this webpage content. Return ONLY valid JSON:

{
  "is_recipe": true/false,
  "name": "Recipe name",
  "description": "Brief 1-sentence description",
  "ingredients": ["ingredient 1", "ingredient 2", ...] (just names, max 8 items),
  "has_instructions": true/false,
  "estimated_time_minutes": number or null
}

Webpage content:
"""
${cleanedHtml}
"""`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])

    if (!parsed.is_recipe) return null

    return {
      name: parsed.name || 'Untitled Recipe',
      description: parsed.description || '',
      ingredients: (parsed.ingredients || []).slice(0, 8),
      hasInstructions: parsed.has_instructions || false,
      estimatedTime: parsed.estimated_time_minutes,
      imageUrl,
    }
  } catch (error) {
    console.error('Failed to extract recipe from URL:', url, error)
    return null
  }
}

// Generate recipe suggestions directly with Gemini
async function generateRecipeSuggestions(query: string, limit: number = 5): Promise<RecipeSearchResult[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `You are a recipe expert. Generate ${limit} real, authentic recipes for this search query: "${query}"

These should be REAL recipes that exist - popular, well-known dishes. Include a mix of:
- Classic recipes (e.g., from famous cookbooks, traditional cuisines)
- Popular restaurant-style dishes
- Home cooking favorites

For each recipe, provide:
1. Exact recipe name (use the actual common name)
2. Brief 1-sentence description
3. Estimated cooking time in minutes
4. 4-6 main ingredients (just names, no quantities)
5. Source type: "website" for blog recipes, "youtube" for video recipes, "blog" for personal blogs
6. Source name: A realistic website/channel name (e.g., "Serious Eats", "Joshua Weissman", "RecipeTin Eats")
7. A realistic URL where this recipe might be found (must be a REAL, working URL from a known recipe site)

IMPORTANT: Use REAL URLs from these trusted sites:
- https://www.seriouseats.com/
- https://www.allrecipes.com/
- https://www.bonappetit.com/
- https://www.delish.com/
- https://www.budgetbytes.com/
- https://www.simplyrecipes.com/
- https://www.recipetineats.com/
- https://www.youtube.com/@joshuaweissman
- https://www.youtube.com/@BingingwithBabish

Return ONLY valid JSON array:
[
  {
    "name": "Recipe Name",
    "description": "Brief description",
    "source_url": "https://real-url.com/recipe",
    "source_type": "website",
    "source_name": "Site Name",
    "estimated_time_minutes": 30,
    "ingredients_preview": ["ingredient1", "ingredient2", "ingredient3", "ingredient4"]
  }
]`

  try {
    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const recipes = JSON.parse(jsonMatch[0])
    return recipes.map((r: {
      name: string
      description: string
      source_url: string
      source_type: 'website' | 'youtube' | 'blog'
      source_name: string
      estimated_time_minutes?: number
      ingredients_preview: string[]
    }) => ({
      name: r.name,
      description: r.description,
      source_url: r.source_url,
      source_type: r.source_type || 'website',
      source_name: r.source_name,
      estimated_time_minutes: r.estimated_time_minutes,
      ingredients_preview: r.ingredients_preview || [],
      confidence_score: scoreRecipeSource(r.source_url, r.ingredients_preview?.length > 0, true),
    }))
  } catch (error) {
    console.error('Failed to generate recipe suggestions:', error)
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as SearchRequestBody
    const { query, ingredients, limit = 5 } = body

    // Build search query
    let searchQuery = query || ''
    if (ingredients && ingredients.length > 0) {
      const ingredientStr = ingredients.join(', ')
      searchQuery = searchQuery
        ? `${searchQuery} with ${ingredientStr}`
        : `recipe using ${ingredientStr}`
    }

    if (!searchQuery.trim()) {
      return NextResponse.json({ error: 'Please provide a search query or ingredients' }, { status: 400 })
    }

    // Generate recipe suggestions directly
    const results = await generateRecipeSuggestions(searchQuery, limit)

    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        message: 'No recipes found for this search. Try different keywords!',
        query: searchQuery,
      })
    }

    // Sort by confidence score
    results.sort((a, b) => b.confidence_score - a.confidence_score)

    return NextResponse.json({
      success: true,
      results,
      query: searchQuery,
      total_found: results.length,
    })

  } catch (error) {
    console.error('Recipe search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search for recipes' },
      { status: 500 }
    )
  }
}
