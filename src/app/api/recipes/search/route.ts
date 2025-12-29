import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface SearchRequestBody {
  query: string
  ingredients?: string[]
  limit?: number
}

interface RecipeRating {
  value: number // 1-5 stars
  count: number // number of ratings
  reviewCount?: number // number of reviews
}

interface RecipeSearchResult {
  name: string
  description: string
  source_url: string
  source_type: 'website' | 'youtube' | 'blog'
  source_name: string
  image_url?: string
  prep_time_minutes?: number
  cook_time_minutes?: number
  total_time_minutes?: number
  ingredients_preview: string[]
  rating?: RecipeRating // Real rating from the source
  author?: string
  servings?: number
  confidence_score: number
}

// Trusted recipe sites - these typically have good schema.org markup
const TRUSTED_RECIPE_SITES = [
  { domain: 'allrecipes.com', name: 'Allrecipes', searchUrl: 'https://www.allrecipes.com/search?q=' },
  { domain: 'seriouseats.com', name: 'Serious Eats', searchUrl: 'https://www.seriouseats.com/search?q=' },
  { domain: 'bonappetit.com', name: 'Bon Appétit', searchUrl: 'https://www.bonappetit.com/search?q=' },
  { domain: 'epicurious.com', name: 'Epicurious', searchUrl: 'https://www.epicurious.com/search/' },
  { domain: 'delish.com', name: 'Delish', searchUrl: 'https://www.delish.com/search/?q=' },
  { domain: 'simplyrecipes.com', name: 'Simply Recipes', searchUrl: 'https://www.simplyrecipes.com/?s=' },
  { domain: 'budgetbytes.com', name: 'Budget Bytes', searchUrl: 'https://www.budgetbytes.com/?s=' },
  { domain: 'recipetineats.com', name: 'RecipeTin Eats', searchUrl: 'https://www.recipetineats.com/?s=' },
  { domain: 'food.com', name: 'Food.com', searchUrl: 'https://www.food.com/search/' },
  { domain: 'foodnetwork.com', name: 'Food Network', searchUrl: 'https://www.foodnetwork.com/search/' },
  { domain: 'tasty.co', name: 'Tasty', searchUrl: 'https://tasty.co/search?q=' },
  { domain: 'thekitchn.com', name: 'The Kitchn', searchUrl: 'https://www.thekitchn.com/search?q=' },
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

// Parse ISO 8601 duration to minutes (PT30M, PT1H30M, etc.)
function parseDuration(duration: string | undefined): number | undefined {
  if (!duration) return undefined

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return undefined

  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  return hours * 60 + minutes
}

// Extract recipe data from schema.org JSON-LD
function extractRecipeSchema(html: string): {
  name?: string
  description?: string
  image?: string
  prepTime?: number
  cookTime?: number
  totalTime?: number
  ingredients?: string[]
  rating?: RecipeRating
  author?: string
  servings?: number
} | null {
  try {
    // Find JSON-LD script tags
    const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)

    for (const match of jsonLdMatches) {
      try {
        const jsonContent = match[1].trim()
        const data = JSON.parse(jsonContent)

        // Handle both single object and @graph array format
        const items = data['@graph'] || (Array.isArray(data) ? data : [data])

        for (const item of items) {
          if (item['@type'] === 'Recipe' ||
              (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))) {

            // Extract ingredients
            let ingredients: string[] = []
            if (item.recipeIngredient) {
              ingredients = Array.isArray(item.recipeIngredient)
                ? item.recipeIngredient.slice(0, 8)
                : [item.recipeIngredient]
            }

            // Extract rating
            let rating: RecipeRating | undefined
            if (item.aggregateRating) {
              const r = item.aggregateRating
              rating = {
                value: parseFloat(r.ratingValue) || 0,
                count: parseInt(r.ratingCount) || parseInt(r.reviewCount) || 0,
                reviewCount: parseInt(r.reviewCount),
              }
            }

            // Extract image
            let image: string | undefined
            if (item.image) {
              if (typeof item.image === 'string') {
                image = item.image
              } else if (Array.isArray(item.image)) {
                image = item.image[0]
              } else if (item.image.url) {
                image = item.image.url
              }
            }

            // Extract author
            let author: string | undefined
            if (item.author) {
              if (typeof item.author === 'string') {
                author = item.author
              } else if (item.author.name) {
                author = item.author.name
              } else if (Array.isArray(item.author) && item.author[0]?.name) {
                author = item.author[0].name
              }
            }

            // Extract servings
            let servings: number | undefined
            if (item.recipeYield) {
              const yieldStr = Array.isArray(item.recipeYield) ? item.recipeYield[0] : item.recipeYield
              const servingsMatch = String(yieldStr).match(/(\d+)/)
              if (servingsMatch) {
                servings = parseInt(servingsMatch[1])
              }
            }

            return {
              name: item.name,
              description: item.description,
              image,
              prepTime: parseDuration(item.prepTime),
              cookTime: parseDuration(item.cookTime),
              totalTime: parseDuration(item.totalTime),
              ingredients,
              rating,
              author,
              servings,
            }
          }
        }
      } catch (e) {
        // Continue to next JSON-LD block
        continue
      }
    }

    return null
  } catch {
    return null
  }
}

// Fallback: Extract basic info from HTML meta tags
function extractMetaTags(html: string): {
  title?: string
  description?: string
  image?: string
} {
  const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ||
                     html.match(/<title>([^<]*)<\/title>/)
  const descMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/) ||
                    html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/)
  const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/)

  return {
    title: titleMatch?.[1],
    description: descMatch?.[1],
    image: imageMatch?.[1],
  }
}

// Fetch and extract recipe from a URL
async function fetchRecipeFromUrl(url: string): Promise<RecipeSearchResult | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FridgeMind/1.0; Recipe Search)',
        'Accept': 'text/html',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const html = await response.text()

    // Try to extract schema.org recipe data first
    const schemaData = extractRecipeSchema(html)

    if (schemaData?.name) {
      const domain = extractDomain(url)
      const trustedSite = TRUSTED_RECIPE_SITES.find(s => domain.includes(s.domain))

      // Calculate confidence score
      let confidence = 50
      if (trustedSite) confidence += 20
      if (schemaData.rating && schemaData.rating.count > 10) confidence += 15
      if (schemaData.ingredients && schemaData.ingredients.length > 3) confidence += 10
      if (schemaData.totalTime) confidence += 5

      return {
        name: schemaData.name,
        description: schemaData.description || '',
        source_url: url,
        source_type: url.includes('youtube.com') ? 'youtube' : 'website',
        source_name: trustedSite?.name || domain,
        image_url: schemaData.image,
        prep_time_minutes: schemaData.prepTime,
        cook_time_minutes: schemaData.cookTime,
        total_time_minutes: schemaData.totalTime,
        ingredients_preview: schemaData.ingredients || [],
        rating: schemaData.rating,
        author: schemaData.author,
        servings: schemaData.servings,
        confidence_score: confidence,
      }
    }

    // Fallback to meta tags
    const metaData = extractMetaTags(html)
    if (metaData.title) {
      const domain = extractDomain(url)
      const trustedSite = TRUSTED_RECIPE_SITES.find(s => domain.includes(s.domain))

      return {
        name: metaData.title,
        description: metaData.description || '',
        source_url: url,
        source_type: 'website',
        source_name: trustedSite?.name || domain,
        image_url: metaData.image,
        ingredients_preview: [],
        confidence_score: 30, // Lower confidence for meta-only
      }
    }

    return null
  } catch (error) {
    console.error('Failed to fetch recipe from URL:', url, error)
    return null
  }
}

// Search a specific recipe site for recipes
async function searchRecipeSite(
  site: typeof TRUSTED_RECIPE_SITES[0],
  query: string
): Promise<string[]> {
  try {
    const searchUrl = site.searchUrl + encodeURIComponent(query)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FridgeMind/1.0; Recipe Search)',
        'Accept': 'text/html',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) return []

    const html = await response.text()

    // Extract recipe URLs from search results
    // Look for links that look like recipe pages
    const urlPattern = new RegExp(
      `https?://(?:www\\.)?${site.domain.replace('.', '\\.')}[^"'\\s]*(?:recipe|recipes)[^"'\\s]*`,
      'gi'
    )

    const matches: string[] = html.match(urlPattern) || []

    // Also try common recipe URL patterns
    const altPattern = new RegExp(
      `href="(https?://(?:www\\.)?${site.domain.replace('.', '\\.')}[^"]*)"`,
      'gi'
    )

    let altMatch
    while ((altMatch = altPattern.exec(html)) !== null) {
      const url = altMatch[1]
      // Filter for likely recipe URLs (not category pages, etc.)
      if (url.includes('/recipe') ||
          url.match(/\/[\w-]+-\d+\/?$/) || // Allrecipes style: /recipe-name-12345/
          url.match(/\/\d{4}\/\d{2}\//) || // Blog style: /2024/01/recipe-name
          url.match(/\/[\w-]{20,}\/?$/)) { // Long slug likely recipe
        matches.push(url)
      }
    }

    // Deduplicate and limit
    const uniqueUrls = [...new Set(matches)]
      .filter(url => !url.includes('/search') && !url.includes('/category'))
      .slice(0, 3)

    return uniqueUrls
  } catch (error) {
    console.error(`Failed to search ${site.name}:`, error)
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
    const { query, ingredients, limit = 6 } = body

    // Build search query
    let searchQuery = query || ''
    if (ingredients && ingredients.length > 0) {
      const ingredientStr = ingredients.join(' ')
      searchQuery = searchQuery
        ? `${searchQuery} ${ingredientStr}`
        : ingredientStr
    }

    if (!searchQuery.trim()) {
      return NextResponse.json({ error: 'Please provide a search query or ingredients' }, { status: 400 })
    }

    // Search multiple trusted recipe sites in parallel
    // Pick 4 random sites to search (to balance speed vs coverage)
    const shuffledSites = [...TRUSTED_RECIPE_SITES].sort(() => Math.random() - 0.5).slice(0, 4)

    const searchPromises = shuffledSites.map(site => searchRecipeSite(site, searchQuery))
    const searchResults = await Promise.all(searchPromises)

    // Flatten and deduplicate URLs
    const allUrls = [...new Set(searchResults.flat())]

    if (allUrls.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        message: 'No recipes found. Try different keywords or check your spelling.',
        query: searchQuery,
        searched_sites: shuffledSites.map(s => s.name),
      })
    }

    // Fetch recipe details from each URL in parallel (limit to avoid overwhelming)
    const urlsToFetch = allUrls.slice(0, Math.min(limit + 2, 10))
    const recipePromises = urlsToFetch.map(url => fetchRecipeFromUrl(url))
    const recipes = await Promise.all(recipePromises)

    // Filter out nulls and sort by confidence
    const validRecipes = recipes
      .filter((r): r is RecipeSearchResult => r !== null && r.name !== undefined)
      .sort((a, b) => b.confidence_score - a.confidence_score)
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      results: validRecipes,
      query: searchQuery,
      total_found: validRecipes.length,
      searched_sites: shuffledSites.map(s => s.name),
    })

  } catch (error) {
    console.error('Recipe search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search for recipes' },
      { status: 500 }
    )
  }
}
