import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

// Trusted recipe sites for searching
const RECIPE_SITES = [
  'seriouseats.com',
  'budgetbytes.com',
  'recipetineats.com',
  'bonappetit.com',
  'food52.com',
  'epicurious.com',
  'allrecipes.com',
  'simplyrecipes.com',
  'cookieandkate.com',
  'minimalistbaker.com',
]

interface RecipeSearchResult {
  name: string
  description: string
  source_url: string
  source_type: 'website' | 'youtube' | 'instagram' | 'blog'
  source_name: string
  ingredients_preview: string[]
}

// Identify ingredients from food photo
async function identifyIngredients(imageBase64: string): Promise<string[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  const prompt = `Look at this photo of food/ingredients and identify what food items are visible.

Return ONLY a JSON array of ingredient names, nothing else. Be specific but use common names.
Example: ["chicken breast", "broccoli", "garlic", "soy sauce"]

If this is not a food photo, return: {"error": "not_food"}

JSON response:`

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data,
      },
    },
    prompt,
  ])

  const response = await result.response
  const text = response.text().trim()

  try {
    // Check for error response
    if (text.includes('"error"')) {
      const parsed = JSON.parse(text)
      if (parsed.error) {
        throw new Error('not_food')
      }
    }

    // Parse the array
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) {
      throw new Error('No ingredients found')
    }

    const ingredients = JSON.parse(match[0])
    return ingredients.filter((i: unknown) => typeof i === 'string' && i.length > 0)
  } catch {
    console.error('Failed to parse ingredients:', text)
    throw new Error('Could not identify ingredients in photo')
  }
}

// Search for recipes using DuckDuckGo
async function searchRecipes(ingredients: string[]): Promise<RecipeSearchResult[]> {
  // Build search query
  const mainIngredients = ingredients.slice(0, 3).join(' ')
  const siteFilter = RECIPE_SITES.slice(0, 5).map(s => `site:${s}`).join(' OR ')
  const query = `${mainIngredients} recipe (${siteFilter})`

  try {
    // Use DuckDuckGo HTML search
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FridgeClue/1.0)',
      },
    })

    if (!response.ok) {
      throw new Error('Search failed')
    }

    const html = await response.text()

    // Parse results from HTML
    const results: RecipeSearchResult[] = []

    // Match result links and titles
    const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
    const snippetPattern = /<a[^>]+class="result__snippet"[^>]*>([^<]+)<\/a>/gi

    let match
    const urls: string[] = []
    const titles: string[] = []
    const snippets: string[] = []

    while ((match = resultPattern.exec(html)) !== null) {
      // DuckDuckGo redirects through their URL
      const url = decodeURIComponent(match[1].replace(/.*uddg=/, '').split('&')[0])
      urls.push(url)
      titles.push(match[2].trim())
    }

    while ((match = snippetPattern.exec(html)) !== null) {
      snippets.push(match[1].trim())
    }

    // Build results
    for (let i = 0; i < Math.min(urls.length, 6); i++) {
      const url = urls[i]
      const title = titles[i] || 'Recipe'

      // Extract domain for source
      let source = 'Recipe'
      try {
        const domain = new URL(url).hostname.replace('www.', '')
        source = domain
      } catch {
        // ignore
      }

      // Skip non-recipe sites
      const isTrustedSite = RECIPE_SITES.some(site => url.includes(site))
      if (!isTrustedSite) continue

      results.push({
        name: title.replace(/ - .*$/, '').replace(/\|.*$/, '').trim(),
        description: snippets[i] || '',
        source_url: url,
        source_type: 'website',
        source_name: source,
        ingredients_preview: ingredients.slice(0, 4),
      })
    }

    return results
  } catch (err) {
    console.error('Recipe search error:', err)
    return []
  }
}

// Generate AI recipes as fallback when no real recipes found
async function generateAIRecipes(ingredients: string[]): Promise<RecipeSearchResult[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `Given these ingredients: ${ingredients.join(', ')}

Generate 3 simple, practical recipe ideas. Use common cooking techniques and don't require unusual ingredients.

Return ONLY a JSON array with this structure:
[
  {
    "name": "Simple recipe name in lowercase",
    "description": "One sentence description",
    "ingredients_needed": ["ingredient1", "ingredient2"]
  }
]

Keep names simple and natural (e.g., "garlic butter chicken" not "Garlic Butter Chicken Delight").`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return []

    const parsed = JSON.parse(match[0])

    return parsed.map((r: { name: string; description: string; ingredients_needed: string[] }) => ({
      name: r.name,
      description: r.description,
      source_url: '',
      source_type: 'website' as const,
      source_name: 'AI suggestion',
      ingredients_preview: r.ingredients_needed?.slice(0, 4) || ingredients.slice(0, 4),
    }))
  } catch {
    return []
  }
}

// Fallback: Ask LLM for recipe name suggestions, then search
async function getRecipeSuggestions(ingredients: string[]): Promise<string[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `Given these ingredients: ${ingredients.join(', ')}

Suggest 5 REAL, COMMON recipe names that use some of these ingredients.
Only suggest well-known recipes that would be found on recipe websites.
Do NOT invent creative names - use standard recipe names.

Return ONLY a JSON array of recipe names:
["recipe name 1", "recipe name 2", ...]`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  try {
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return []
    return JSON.parse(match[0])
  } catch {
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

    const body = await request.json()
    const { image } = body

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // Step 1: Identify ingredients in the photo
    let ingredients: string[]
    try {
      ingredients = await identifyIngredients(image)
    } catch (err) {
      if (err instanceof Error && err.message === 'not_food') {
        return NextResponse.json({
          error: 'This doesn\'t appear to be a photo of food. Please take a photo of ingredients you want to cook with.',
        }, { status: 400 })
      }
      throw err
    }

    if (ingredients.length === 0) {
      return NextResponse.json({
        error: 'Could not identify any ingredients in the photo. Try a clearer photo with visible food items.',
      }, { status: 400 })
    }

    // Step 2: Search for real recipes
    let recipes = await searchRecipes(ingredients)

    // Step 3: If direct search didn't find much, get recipe suggestions and search those
    if (recipes.length < 3) {
      const suggestions = await getRecipeSuggestions(ingredients)

      for (const suggestion of suggestions.slice(0, 3)) {
        const siteFilter = RECIPE_SITES.slice(0, 3).map(s => `site:${s}`).join(' OR ')
        const query = `"${suggestion}" recipe (${siteFilter})`

        try {
          const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
          const response = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FridgeClue/1.0)' },
          })

          if (response.ok) {
            const html = await response.text()
            const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi

            let match
            while ((match = resultPattern.exec(html)) !== null) {
              const url = decodeURIComponent(match[1].replace(/.*uddg=/, '').split('&')[0])
              const title = match[2].trim()

              const isTrustedSite = RECIPE_SITES.some(site => url.includes(site))
              if (!isTrustedSite) continue

              // Avoid duplicates
              if (recipes.some(r => r.source_url === url)) continue

              let source = 'Recipe'
              try {
                source = new URL(url).hostname.replace('www.', '')
              } catch {
                // ignore
              }

              recipes.push({
                name: title.replace(/ - .*$/, '').replace(/\|.*$/, '').trim(),
                description: '',
                source_url: url,
                source_type: 'website',
                source_name: source,
                ingredients_preview: ingredients.slice(0, 4),
              })

              break // One per suggestion
            }
          }
        } catch {
          // Continue with other suggestions
        }
      }
    }

    // Step 4: If still no recipes, generate AI suggestions as last resort
    if (recipes.length === 0) {
      const aiRecipes = await generateAIRecipes(ingredients)
      return NextResponse.json({
        success: true,
        detected_ingredients: ingredients,
        recipes: aiRecipes,
        source: 'ai_generated',
        note: 'No real recipes found online. These are AI-generated suggestions based on your ingredients.',
      })
    }

    return NextResponse.json({
      success: true,
      detected_ingredients: ingredients,
      recipes: recipes.slice(0, 8),
      source: 'web_search',
    })
  } catch (error) {
    console.error('Photo to recipe error:', error)
    return NextResponse.json(
      { error: 'Failed to find recipes from photo' },
      { status: 500 }
    )
  }
}
