import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface SourceToggles {
  web: boolean
  youtube: boolean
  instagram: boolean
}

interface SearchRequestBody {
  query: string
  ingredients?: string[]
  limit?: number
  sources?: SourceToggles
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
  source_type: 'website' | 'youtube' | 'instagram' | 'blog'
  source_name: string
  image_url?: string
  thumbnail_url?: string // For YouTube
  prep_time_minutes?: number
  cook_time_minutes?: number
  total_time_minutes?: number
  estimated_time_minutes?: number // Fallback
  video_duration?: string // For YouTube (e.g., "15:30")
  ingredients_preview: string[]
  rating?: RecipeRating // Real rating from the source
  author?: string
  servings?: number
  confidence_score: number
  // YouTube specific
  view_count?: number
  like_count?: number
  channel_name?: string
  // Instagram specific
  likes?: number
  comments?: number
  account_handle?: string
}

// Trusted recipe sites - these typically have good schema.org markup
const TRUSTED_RECIPE_SITES = [
  // General sites with high quality recipes
  { domain: 'seriouseats.com', name: 'Serious Eats', searchUrl: 'https://www.seriouseats.com/search?q=', cuisines: ['all'] },
  { domain: 'recipetineats.com', name: 'RecipeTin Eats', searchUrl: 'https://www.recipetineats.com/?s=', cuisines: ['all'] },
  { domain: 'budgetbytes.com', name: 'Budget Bytes', searchUrl: 'https://www.budgetbytes.com/?s=', cuisines: ['all'] },
  { domain: 'simplyrecipes.com', name: 'Simply Recipes', searchUrl: 'https://www.simplyrecipes.com/?s=', cuisines: ['all'] },
  // Asian cuisine specialists
  { domain: 'woksoflife.com', name: 'Woks of Life', searchUrl: 'https://thewoksoflife.com/?s=', cuisines: ['chinese', 'asian', 'cantonese', 'hong kong'] },
  { domain: 'justonecookbook.com', name: 'Just One Cookbook', searchUrl: 'https://www.justonecookbook.com/?s=', cuisines: ['japanese', 'asian'] },
  { domain: 'maangchi.com', name: 'Maangchi', searchUrl: 'https://www.maangchi.com/search?q=', cuisines: ['korean', 'asian'] },
  { domain: 'rasamalaysia.com', name: 'Rasa Malaysia', searchUrl: 'https://rasamalaysia.com/?s=', cuisines: ['malaysian', 'asian', 'southeast asian'] },
  { domain: 'indianhealthyrecipes.com', name: 'Indian Healthy Recipes', searchUrl: 'https://www.indianhealthyrecipes.com/?s=', cuisines: ['indian', 'asian'] },
  // Other international
  { domain: 'davidlebovitz.com', name: 'David Lebovitz', searchUrl: 'https://www.davidlebovitz.com/?s=', cuisines: ['french', 'european'] },
  // Popular general sites
  { domain: 'allrecipes.com', name: 'Allrecipes', searchUrl: 'https://www.allrecipes.com/search?q=', cuisines: ['all'] },
  { domain: 'bonappetit.com', name: 'Bon Appétit', searchUrl: 'https://www.bonappetit.com/search?q=', cuisines: ['all'] },
]

// Detect cuisine from search query
function detectCuisine(query: string): string[] {
  const q = query.toLowerCase()
  const cuisines: string[] = []

  // Asian cuisines
  if (q.includes('chinese') || q.includes('cantonese') || q.includes('dim sum') || q.includes('hong kong') || q.includes('wok')) cuisines.push('chinese')
  if (q.includes('japanese') || q.includes('sushi') || q.includes('ramen') || q.includes('udon')) cuisines.push('japanese')
  if (q.includes('korean') || q.includes('kimchi') || q.includes('bibimbap') || q.includes('gochujang')) cuisines.push('korean')
  if (q.includes('thai') || q.includes('pad thai') || q.includes('tom yum')) cuisines.push('thai')
  if (q.includes('vietnamese') || q.includes('pho') || q.includes('banh mi')) cuisines.push('vietnamese')
  if (q.includes('indian') || q.includes('curry') || q.includes('masala') || q.includes('biryani')) cuisines.push('indian')
  if (q.includes('malaysian') || q.includes('laksa') || q.includes('rendang')) cuisines.push('malaysian')
  if (q.includes('asian')) cuisines.push('asian')

  // Western cuisines
  if (q.includes('french') || q.includes('croissant') || q.includes('coq au vin')) cuisines.push('french')
  if (q.includes('italian') || q.includes('pasta') || q.includes('risotto') || q.includes('pizza')) cuisines.push('italian')
  if (q.includes('mexican') || q.includes('taco') || q.includes('burrito')) cuisines.push('mexican')

  return cuisines.length > 0 ? cuisines : ['all']
}

// Get relevant sites based on detected cuisine
function getRelevantSites(query: string, maxSites: number = 4): typeof TRUSTED_RECIPE_SITES {
  const detectedCuisines = detectCuisine(query)

  // Prioritize cuisine-specific sites
  const cuisineSites = TRUSTED_RECIPE_SITES.filter(site =>
    site.cuisines.some(c => detectedCuisines.includes(c))
  )

  // If we have cuisine-specific sites, prioritize them
  if (cuisineSites.length >= 2 && !detectedCuisines.includes('all')) {
    // Take cuisine sites first, then fill with general sites
    const generalSites = TRUSTED_RECIPE_SITES.filter(site =>
      site.cuisines.includes('all') && !cuisineSites.includes(site)
    )
    const shuffledGeneral = generalSites.sort(() => Math.random() - 0.5)
    return [...cuisineSites, ...shuffledGeneral].slice(0, maxSites)
  }

  // Otherwise, randomly pick from all sites
  return [...TRUSTED_RECIPE_SITES].sort(() => Math.random() - 0.5).slice(0, maxSites)
}

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

// YouTube Data API search for cooking videos
async function searchYouTube(query: string, limit: number = 6): Promise<RecipeSearchResult[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY

  if (!apiKey) {
    console.warn('No Google API key for YouTube search')
    return []
  }

  try {
    // Search for cooking/recipe videos
    const searchQuery = `${query} recipe cooking`
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
    searchUrl.searchParams.set('part', 'snippet')
    searchUrl.searchParams.set('q', searchQuery)
    searchUrl.searchParams.set('type', 'video')
    searchUrl.searchParams.set('maxResults', String(Math.min(limit + 2, 10)))
    searchUrl.searchParams.set('videoCategoryId', '26') // Howto & Style category
    searchUrl.searchParams.set('key', apiKey)

    const searchResponse = await fetch(searchUrl.toString(), {
      headers: { 'Accept': 'application/json' },
    })

    if (!searchResponse.ok) {
      // Try without category filter
      searchUrl.searchParams.delete('videoCategoryId')
      const retryResponse = await fetch(searchUrl.toString())
      if (!retryResponse.ok) {
        console.error('YouTube search failed:', await retryResponse.text())
        return []
      }
      const data = await retryResponse.json()
      return processYouTubeResults(data, apiKey)
    }

    const data = await searchResponse.json()
    return processYouTubeResults(data, apiKey)
  } catch (error) {
    console.error('YouTube search error:', error)
    return []
  }
}

// Process YouTube search results and fetch video details
async function processYouTubeResults(
  searchData: { items?: Array<{ id: { videoId: string }, snippet: { title: string, description: string, thumbnails: { high?: { url: string }, medium?: { url: string } }, channelTitle: string, publishedAt: string } }> },
  apiKey: string
): Promise<RecipeSearchResult[]> {
  if (!searchData.items || searchData.items.length === 0) {
    return []
  }

  // Get video IDs for statistics fetch
  const videoIds = searchData.items.map(item => item.id.videoId).join(',')

  // Fetch video statistics (views, likes, duration)
  const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  statsUrl.searchParams.set('part', 'statistics,contentDetails')
  statsUrl.searchParams.set('id', videoIds)
  statsUrl.searchParams.set('key', apiKey)

  let statsMap: Record<string, { viewCount?: string, likeCount?: string, duration?: string }> = {}

  try {
    const statsResponse = await fetch(statsUrl.toString())
    if (statsResponse.ok) {
      const statsData = await statsResponse.json()
      statsData.items?.forEach((item: { id: string, statistics?: { viewCount?: string, likeCount?: string }, contentDetails?: { duration?: string } }) => {
        statsMap[item.id] = {
          viewCount: item.statistics?.viewCount,
          likeCount: item.statistics?.likeCount,
          duration: item.contentDetails?.duration,
        }
      })
    }
  } catch (e) {
    console.warn('Failed to fetch YouTube stats:', e)
  }

  return searchData.items.map(item => {
    const videoId = item.id.videoId
    const stats = statsMap[videoId] || {}
    const thumbnail = item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url

    // Parse ISO 8601 duration (PT15M30S) to human readable
    const duration = parseYouTubeDuration(stats.duration)
    const durationMinutes = parseDurationToMinutes(stats.duration)

    // Calculate confidence based on engagement
    let confidence = 60
    const views = parseInt(stats.viewCount || '0')
    const likes = parseInt(stats.likeCount || '0')
    if (views > 1000000) confidence += 20
    else if (views > 100000) confidence += 15
    else if (views > 10000) confidence += 10
    if (likes > 10000) confidence += 10

    return {
      name: cleanYouTubeTitle(item.snippet.title),
      description: item.snippet.description.slice(0, 200),
      source_url: `https://www.youtube.com/watch?v=${videoId}`,
      source_type: 'youtube' as const,
      source_name: 'YouTube',
      image_url: thumbnail,
      thumbnail_url: thumbnail,
      video_duration: duration,
      total_time_minutes: durationMinutes,
      ingredients_preview: [], // Can't easily extract from YT
      confidence_score: confidence,
      view_count: views,
      like_count: likes,
      channel_name: item.snippet.channelTitle,
      author: item.snippet.channelTitle,
    }
  })
}

// Clean YouTube title (remove common suffixes)
function cleanYouTubeTitle(title: string): string {
  return title
    .replace(/\s*[\|\-]\s*[^|\-]*$/g, '') // Remove " | Channel Name" etc
    .replace(/\s*\([^)]*recipe[^)]*\)/gi, '') // Remove "(Easy Recipe)" etc
    .replace(/\s*#\w+/g, '') // Remove hashtags
    .trim()
}

// Parse ISO 8601 duration to human readable (PT15M30S -> "15:30")
function parseYouTubeDuration(duration?: string): string | undefined {
  if (!duration) return undefined

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return undefined

  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseInt(match[3] || '0')

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Parse ISO 8601 duration to minutes
function parseDurationToMinutes(duration?: string): number | undefined {
  if (!duration) return undefined

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return undefined

  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  return hours * 60 + minutes
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as SearchRequestBody
    const { query, ingredients, limit = 6, sources } = body

    // Default sources if not provided
    const sourceToggles: SourceToggles = sources || {
      web: true,
      youtube: true,
      instagram: false,
    }

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

    // Collect all search promises based on enabled sources
    const searchPromises: Promise<RecipeSearchResult[]>[] = []
    const searchedSources: string[] = []

    // Web search (recipe sites)
    if (sourceToggles.web) {
      // Pick relevant sites based on cuisine detection (culturally sensitive)
      const relevantSites = getRelevantSites(searchQuery, 4)
      searchedSources.push(...relevantSites.map(s => s.name))

      // Create a promise that searches sites and fetches recipes
      const webSearchPromise = (async () => {
        const urlResults = await Promise.all(
          relevantSites.map(site => searchRecipeSite(site, searchQuery))
        )
        const allUrls = [...new Set(urlResults.flat())]
        const urlsToFetch = allUrls.slice(0, Math.min(limit + 2, 10))
        const recipes = await Promise.all(urlsToFetch.map(url => fetchRecipeFromUrl(url)))
        return recipes.filter((r): r is RecipeSearchResult => r !== null && r.name !== undefined)
      })()

      searchPromises.push(webSearchPromise)
    }

    // YouTube search
    if (sourceToggles.youtube) {
      searchedSources.push('YouTube')
      searchPromises.push(searchYouTube(searchQuery, limit))
    }

    // Instagram search (coming soon)
    if (sourceToggles.instagram) {
      searchedSources.push('Instagram')
      // TODO: Implement Instagram search
      searchPromises.push(Promise.resolve([]))
    }

    // Execute all searches in parallel
    const allResults = await Promise.all(searchPromises)
    const flatResults = allResults.flat()

    if (flatResults.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        message: 'No recipes found. Try different keywords or check your spelling.',
        query: searchQuery,
        searched_sources: searchedSources,
      })
    }

    // Sort by confidence and limit
    const sortedResults = flatResults
      .sort((a, b) => b.confidence_score - a.confidence_score)
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      results: sortedResults,
      query: searchQuery,
      total_found: sortedResults.length,
      searched_sources: searchedSources,
    })

  } catch (error) {
    console.error('Recipe search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search for recipes' },
      { status: 500 }
    )
  }
}
