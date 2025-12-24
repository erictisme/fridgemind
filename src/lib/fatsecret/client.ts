import type {
  FatSecretToken,
  FatSecretSearchResult,
  FatSecretFoodResult,
  FatSecretAutocompleteResult,
  FatSecretServing,
  NormalizedNutrition,
} from './types'

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token'
const API_URL = 'https://platform.fatsecret.com/rest/server.api'

// In-memory token cache
let cachedToken: FatSecretToken | null = null

/**
 * Get OAuth 2.0 access token (with caching)
 */
async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token (with 5 min buffer)
  if (cachedToken && cachedToken.expires_at > Date.now() + 5 * 60 * 1000) {
    return cachedToken.access_token
  }

  const clientId = process.env.FATSECRET_CLIENT_ID
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('FatSecret API credentials not configured')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=basic',
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get FatSecret token: ${error}`)
  }

  const data = await response.json()

  cachedToken = {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
    expires_at: Date.now() + data.expires_in * 1000,
  }

  return cachedToken.access_token
}

/**
 * Make authenticated API request to FatSecret
 */
async function apiRequest<T>(params: Record<string, string>): Promise<T> {
  const token = await getAccessToken()

  const searchParams = new URLSearchParams({
    ...params,
    format: 'json',
  })

  const response = await fetch(`${API_URL}?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`FatSecret API error: ${error}`)
  }

  return response.json()
}

/**
 * Search for foods by name
 */
export async function searchFoods(
  query: string,
  options: {
    page?: number
    maxResults?: number
    region?: string
  } = {}
): Promise<FatSecretSearchResult> {
  const { page = 0, maxResults = 20, region = 'SG' } = options

  return apiRequest<FatSecretSearchResult>({
    method: 'foods.search',
    search_expression: query,
    page_number: page.toString(),
    max_results: maxResults.toString(),
    region,
  })
}

/**
 * Get autocomplete suggestions while typing
 */
export async function autocompleteFoods(
  query: string,
  maxResults = 10
): Promise<string[]> {
  try {
    const result = await apiRequest<FatSecretAutocompleteResult>({
      method: 'foods.autocomplete',
      expression: query,
      max_results: maxResults.toString(),
    })

    return result.suggestions?.suggestion || []
  } catch {
    return []
  }
}

/**
 * Get detailed food information by ID
 */
export async function getFood(foodId: string): Promise<FatSecretFoodResult> {
  return apiRequest<FatSecretFoodResult>({
    method: 'food.get.v4',
    food_id: foodId,
  })
}

/**
 * Parse serving nutrition data into a normalized format
 */
function parseServing(serving: FatSecretServing): Omit<NormalizedNutrition, 'food_id' | 'food_name' | 'brand_name'> {
  return {
    serving_description: serving.serving_description,
    calories: parseFloat(serving.calories || '0'),
    protein_grams: parseFloat(serving.protein || '0'),
    carbs_grams: parseFloat(serving.carbohydrate || '0'),
    fat_grams: parseFloat(serving.fat || '0'),
    fiber_grams: parseFloat(serving.fiber || '0'),
    sodium_mg: serving.sodium ? parseFloat(serving.sodium) : undefined,
    sugar_grams: serving.sugar ? parseFloat(serving.sugar) : undefined,
  }
}

/**
 * Get normalized nutrition data for a food (uses first/default serving)
 */
export async function getNutrition(foodId: string): Promise<NormalizedNutrition | null> {
  try {
    const result = await getFood(foodId)
    const food = result.food

    if (!food.servings?.serving) {
      return null
    }

    // Handle both single serving and array of servings
    const servings = Array.isArray(food.servings.serving)
      ? food.servings.serving
      : [food.servings.serving]

    // Get first serving (usually the default)
    const serving = servings[0]

    return {
      food_id: food.food_id,
      food_name: food.food_name,
      brand_name: food.brand_name,
      ...parseServing(serving),
    }
  } catch (error) {
    console.error('Failed to get nutrition:', error)
    return null
  }
}

/**
 * Search and get nutrition in one call (convenience function)
 */
export async function searchAndGetNutrition(
  query: string
): Promise<NormalizedNutrition | null> {
  try {
    const searchResult = await searchFoods(query, { maxResults: 1 })

    if (!searchResult.foods?.food?.length) {
      return null
    }

    const firstFood = searchResult.foods.food[0]
    return getNutrition(firstFood.food_id)
  } catch (error) {
    console.error('Failed to search and get nutrition:', error)
    return null
  }
}

/**
 * Check if FatSecret is configured
 */
export function isConfigured(): boolean {
  return !!(process.env.FATSECRET_CLIENT_ID && process.env.FATSECRET_CLIENT_SECRET)
}
