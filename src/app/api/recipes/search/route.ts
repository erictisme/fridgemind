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

// Use Gemini to search for recipes
async function searchForRecipes(query: string, limit: number = 5): Promise<string[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `You are a recipe search assistant. Given this search query, generate ${limit} likely URLs of recipe pages that would match.

Search query: "${query}"

Generate URLs from:
- Popular recipe websites (allrecipes, food network, epicurious, etc.)
- YouTube cooking channels
- Food blogs

Return ONLY a JSON array of URL strings:
["url1", "url2", ...]

Make the URLs realistic and specific to the query. Do not include any text before or after the JSON.`

  try {
    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const urls = JSON.parse(jsonMatch[0])
    return Array.isArray(urls) ? urls.filter((u: unknown) => typeof u === 'string') : []
  } catch (error) {
    console.error('Failed to generate recipe URLs:', error)
    return []
  }
}

// Alternative: Use real web search if available
async function webSearchForRecipes(query: string): Promise<string[]> {
  // This would integrate with a real search API (Google, Bing, etc.)
  // For now, fall back to Gemini-generated URLs
  return searchForRecipes(query)
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

    // Add "recipe" to query if not present
    if (!searchQuery.toLowerCase().includes('recipe')) {
      searchQuery = `${searchQuery} recipe`
    }

    // Get URLs to search
    const urls = await webSearchForRecipes(searchQuery)

    if (urls.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        message: 'No recipes found for this search',
        query: searchQuery,
      })
    }

    // Fetch and parse each URL in parallel (with timeout)
    const recipePromises = urls.slice(0, limit).map(async (url: string) => {
      const extracted = await extractRecipeFromUrl(url)
      if (!extracted) return null

      const score = scoreRecipeSource(url, extracted.ingredients.length > 0, extracted.hasInstructions)

      // Determine source type
      let sourceType: 'website' | 'youtube' | 'blog' = 'website'
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        sourceType = 'youtube'
      }

      const domain = extractDomain(url)

      return {
        name: extracted.name,
        description: extracted.description,
        source_url: url,
        source_type: sourceType,
        source_name: domain,
        image_url: extracted.imageUrl,
        estimated_time_minutes: extracted.estimatedTime,
        ingredients_preview: extracted.ingredients,
        confidence_score: score,
      } as RecipeSearchResult
    })

    const results = (await Promise.all(recipePromises))
      .filter((r): r is RecipeSearchResult => r !== null)
      .sort((a, b) => b.confidence_score - a.confidence_score)

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
