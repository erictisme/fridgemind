import { GoogleGenerativeAI } from '@google/generative-ai'
import { RecipeIngredient } from '@/types/database'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

// ============================================
// Types
// ============================================

export interface ParsedRecipe {
  is_recipe: boolean
  name: string
  description: string | null
  ingredients: RecipeIngredient[]
  instructions: string | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  estimated_time_minutes: number | null
  servings: number | null
  cuisine_type: string | null
  tags: string[]
  notes: string | null
  confidence: number
}

export interface InstagramExtractResult {
  success: boolean
  recipe: ParsedRecipe | null
  raw_caption: string | null
  image_url: string | null
  author: string | null
  error?: string
}

// ============================================
// 1. Parse Raw Recipe Text
// ============================================

const PARSE_RECIPE_TEXT_PROMPT = `You are a precise recipe assistant. Parse the recipe text into a structured format.

CRITICAL: Be EXACT with quantities. Copy them verbatim from the source.
- "1/4 cup" must stay "1/4 cup" (NOT "1 cup")
- "1/2 onion" must stay "1/2" (NOT "1")
- "6 heaped cups" = quantity "6", unit "heaped cups"
- NEVER round, approximate, or change quantities

Rules:
- Extract the recipe name
- Identify ALL ingredients with EXACT quantities from the source
- Include preparation details in the ingredient name (e.g., "red onion, very finely sliced", "cucumber, deseeded, half moons")
- Include "heaped", "tightly packed", "rounded" etc. in the unit
- Extract cooking instructions with technique details
- Extract prep time and cook time separately if available
- Extract the exact servings stated (e.g., "3-4 servings" → use lower number: 3)
- Identify cuisine type and add tags
- Extract storage tips, notes, substitutions if present
- If the text doesn't look like a recipe, set is_recipe: false

Return ONLY valid JSON:
{
  "is_recipe": true,
  "name": "Recipe Name",
  "description": "Brief description",
  "ingredients": [
    { "name": "red onion, very finely sliced", "quantity": "1/2", "unit": "", "optional": false },
    { "name": "cabbage, finely shredded (use top 2/3)", "quantity": "6", "unit": "heaped cups", "optional": false },
    { "name": "mint leaves, tightly packed", "quantity": "1", "unit": "cup", "optional": false },
    { "name": "fish sauce", "quantity": "1/4", "unit": "cup", "optional": false }
  ],
  "instructions": "Step by step instructions with technique details...",
  "prep_time_minutes": 15,
  "cook_time_minutes": 20,
  "estimated_time_minutes": 35,
  "servings": 3,
  "cuisine_type": "vietnamese",
  "tags": ["salad", "healthy"],
  "notes": "Don't dress ahead. Can substitute X for Y.",
  "confidence": 0.95
}

Do not include any text before or after the JSON.`

export async function parseRecipeText(text: string): Promise<ParsedRecipe> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `${PARSE_RECIPE_TEXT_PROMPT}

Recipe text:
"""
${text}
"""`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const responseText = response.text()

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON object found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      is_recipe: parsed.is_recipe ?? false,
      name: parsed.name || 'Untitled Recipe',
      description: parsed.description || null,
      ingredients: (parsed.ingredients || []).map((ing: RecipeIngredient) => ({
        name: ing.name || 'Unknown',
        quantity: ing.quantity ?? '',
        unit: ing.unit || '',
        optional: ing.optional || false,
      })),
      instructions: parsed.instructions || null,
      prep_time_minutes: typeof parsed.prep_time_minutes === 'number' ? parsed.prep_time_minutes : null,
      cook_time_minutes: typeof parsed.cook_time_minutes === 'number' ? parsed.cook_time_minutes : null,
      estimated_time_minutes: typeof parsed.estimated_time_minutes === 'number' ? parsed.estimated_time_minutes : null,
      servings: typeof parsed.servings === 'number' ? parsed.servings : null,
      cuisine_type: parsed.cuisine_type || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      notes: parsed.notes || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    }
  } catch (err) {
    console.error('Failed to parse recipe text response:', responseText, err)
    throw new Error('Failed to parse recipe')
  }
}

// ============================================
// 2. Extract Recipe from Instagram Caption + Image
// ============================================

const INSTAGRAM_RECIPE_PROMPT = `You are a precise recipe assistant analyzing an Instagram post. Extract a recipe from the caption.

CRITICAL: Be EXACT with quantities. Copy them verbatim.
- "1/4 cup" must stay "1/4 cup" (NOT "1 cup")
- "1/2 onion" must stay "1/2" (NOT "1")
- NEVER round or approximate quantities

Rules:
- Determine if this post contains a recipe (cooking instructions + ingredients)
- If it's just food photography without recipe, set is_recipe: false
- Extract ALL ingredients with EXACT quantities
- Include preparation details in ingredient names (e.g., "onion, diced")
- Piece together cooking steps from the caption
- Estimate serving size and cooking time if not stated
- Identify cuisine type and add tags

Return ONLY valid JSON:
{
  "is_recipe": true,
  "name": "Recipe Name",
  "description": "Brief description",
  "ingredients": [
    { "name": "ingredient, with prep details", "quantity": "1/4", "unit": "cup", "optional": false }
  ],
  "instructions": "Combined cooking instructions...",
  "prep_time_minutes": 10,
  "cook_time_minutes": 20,
  "estimated_time_minutes": 30,
  "servings": 2,
  "cuisine_type": "asian",
  "tags": ["quick", "healthy"],
  "notes": null,
  "confidence": 0.8
}

Do not include any text before or after the JSON.`

export async function extractRecipeFromInstagram(
  caption: string,
  imageDescription?: string
): Promise<ParsedRecipe> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  let content = `Instagram caption:
"""
${caption}
"""`

  if (imageDescription) {
    content += `

Image shows: ${imageDescription}`
  }

  const prompt = `${INSTAGRAM_RECIPE_PROMPT}

${content}`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const responseText = response.text()

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON object found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      is_recipe: parsed.is_recipe ?? false,
      name: parsed.name || 'Instagram Recipe',
      description: parsed.description || null,
      ingredients: (parsed.ingredients || []).map((ing: RecipeIngredient) => ({
        name: ing.name || 'Unknown',
        quantity: ing.quantity ?? '',
        unit: ing.unit || '',
        optional: ing.optional || false,
      })),
      instructions: parsed.instructions || null,
      prep_time_minutes: typeof parsed.prep_time_minutes === 'number' ? parsed.prep_time_minutes : null,
      cook_time_minutes: typeof parsed.cook_time_minutes === 'number' ? parsed.cook_time_minutes : null,
      estimated_time_minutes: typeof parsed.estimated_time_minutes === 'number' ? parsed.estimated_time_minutes : null,
      servings: typeof parsed.servings === 'number' ? parsed.servings : null,
      cuisine_type: parsed.cuisine_type || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      notes: parsed.notes || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    }
  } catch (err) {
    console.error('Failed to extract Instagram recipe:', responseText, err)
    throw new Error('Failed to extract recipe from Instagram post')
  }
}

// ============================================
// 3. Extract Recipe from YouTube Video Description
// ============================================

const YOUTUBE_RECIPE_PROMPT = `You are a precise recipe assistant analyzing a YouTube video description. Extract a recipe from the video description text.

CRITICAL: Be EXACT with quantities. Copy them verbatim.
- "1/4 cup" must stay "1/4 cup" (NOT "1 cup")
- "1/2 onion" must stay "1/2" (NOT "1")
- NEVER round or approximate quantities

Rules:
- Determine if this description contains a recipe (ingredients + cooking instructions)
- If it's just a video description without recipe details, set is_recipe: false
- Extract ALL ingredients with EXACT quantities
- Include preparation details in ingredient names (e.g., "onion, finely diced")
- Extract cooking instructions with technique details
- Ignore: timestamps, affiliate links, subscribe buttons, sponsor mentions
- Estimate serving size and cooking time if not stated
- Identify cuisine type and add tags

Return ONLY valid JSON:
{
  "is_recipe": true,
  "name": "Recipe Name",
  "description": "Brief description",
  "ingredients": [
    { "name": "ingredient, with prep details", "quantity": "1/4", "unit": "cup", "optional": false }
  ],
  "instructions": "Combined cooking instructions...",
  "prep_time_minutes": 10,
  "cook_time_minutes": 20,
  "estimated_time_minutes": 30,
  "servings": 2,
  "cuisine_type": "asian",
  "tags": ["quick", "healthy"],
  "notes": null,
  "confidence": 0.8
}

Do not include any text before or after the JSON.`

export async function extractRecipeFromYouTube(
  description: string,
  videoTitle?: string
): Promise<ParsedRecipe> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  let content = `YouTube video description:
"""
${description}
"""`

  if (videoTitle) {
    content = `Video title: ${videoTitle}

${content}`
  }

  const prompt = `${YOUTUBE_RECIPE_PROMPT}

${content}`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const responseText = response.text()

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON object found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      is_recipe: parsed.is_recipe ?? false,
      name: parsed.name || videoTitle || 'YouTube Recipe',
      description: parsed.description || null,
      ingredients: (parsed.ingredients || []).map((ing: RecipeIngredient) => ({
        name: ing.name || 'Unknown',
        quantity: ing.quantity ?? '',
        unit: ing.unit || '',
        optional: ing.optional || false,
      })),
      instructions: parsed.instructions || null,
      prep_time_minutes: typeof parsed.prep_time_minutes === 'number' ? parsed.prep_time_minutes : null,
      cook_time_minutes: typeof parsed.cook_time_minutes === 'number' ? parsed.cook_time_minutes : null,
      estimated_time_minutes: typeof parsed.estimated_time_minutes === 'number' ? parsed.estimated_time_minutes : null,
      servings: typeof parsed.servings === 'number' ? parsed.servings : null,
      cuisine_type: parsed.cuisine_type || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      notes: parsed.notes || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    }
  } catch (err) {
    console.error('Failed to extract YouTube recipe:', responseText, err)
    throw new Error('Failed to extract recipe from YouTube video')
  }
}

// ============================================
// 4. Generate Shopping List from Recipe
// ============================================

const RECIPE_TO_SHOPPING_PROMPT = `You are a cooking assistant. Given a recipe's ingredients and the user's current inventory, generate a shopping list of what they need to buy.

Rules:
- Only include ingredients they DON'T already have
- Match ingredient names flexibly (e.g., "garlic" matches "garlic cloves")
- For pantry staples (salt, pepper, oil), assume they have it unless the recipe needs a specific type
- Return quantities appropriate for the recipe
- Categorize items: produce, dairy, protein, pantry, beverage, frozen, bakery, other

Return ONLY valid JSON:
{
  "items_needed": [
    { "name": "Item", "quantity": 1, "unit": "pc", "category": "produce" }
  ],
  "already_have": ["item1", "item2"],
  "assumed_pantry": ["salt", "pepper"]
}

Do not include any text before or after the JSON.`

export interface RecipeShoppingResult {
  items_needed: Array<{
    name: string
    quantity: number | string
    unit: string
    category: string
  }>
  already_have: string[]
  assumed_pantry: string[]
}

// ============================================
// 4. Parse Multiple Recipes from Bulk Text/URL
// ============================================

const BULK_RECIPE_PARSE_PROMPT = `You are a precise recipe assistant. The user has provided text that may contain MULTIPLE recipes.

CRITICAL: Be EXACT with quantities. Copy them verbatim.
- "1/4 cup" must stay "1/4 cup" (NOT "1 cup")
- "1/2 onion" must stay "1/2" (NOT "1")
- NEVER round or approximate quantities

Your task: Extract ALL distinct recipes from the text.

Rules:
- Look for recipe patterns: titles followed by ingredients and instructions
- Each recipe should have: name, ingredients list, instructions
- Extract ALL ingredients with EXACT quantities
- Include preparation details in ingredient names
- Recipes may be separated by headers, blank lines, or ingredient categories
- Be thorough - don't miss any recipes
- Extract cooking time if stated
- Add relevant tags for each recipe

Return ONLY valid JSON:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "description": "Brief description",
      "ingredients": [
        { "name": "ingredient, with prep details", "quantity": "1/4", "unit": "cup", "optional": false }
      ],
      "instructions": "Step by step instructions...",
      "prep_time_minutes": 10,
      "cook_time_minutes": 20,
      "estimated_time_minutes": 30,
      "servings": 2,
      "cuisine_type": "italian",
      "tags": ["quick", "vegetarian"],
      "notes": null
    }
  ],
  "total_found": 5,
  "confidence": 0.85
}

Do not include any text before or after the JSON.`

export interface BulkParseResult {
  recipes: ParsedRecipe[]
  total_found: number
  confidence: number
}

export async function parseBulkRecipes(text: string): Promise<BulkParseResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `${BULK_RECIPE_PARSE_PROMPT}

Text containing recipes:
"""
${text.slice(0, 30000)}
"""` // Limit to 30k chars to avoid token limits

  const result = await model.generateContent(prompt)
  const response = await result.response
  const responseText = response.text()

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON object found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    const recipes: ParsedRecipe[] = (parsed.recipes || []).map((recipe: ParsedRecipe) => ({
      is_recipe: true,
      name: recipe.name || 'Untitled Recipe',
      description: recipe.description || null,
      ingredients: (recipe.ingredients || []).map((ing: RecipeIngredient) => ({
        name: ing.name || 'Unknown',
        quantity: ing.quantity ?? '',
        unit: ing.unit || '',
        optional: ing.optional || false,
      })),
      instructions: recipe.instructions || null,
      prep_time_minutes: typeof recipe.prep_time_minutes === 'number' ? recipe.prep_time_minutes : null,
      cook_time_minutes: typeof recipe.cook_time_minutes === 'number' ? recipe.cook_time_minutes : null,
      estimated_time_minutes: typeof recipe.estimated_time_minutes === 'number' ? recipe.estimated_time_minutes : null,
      servings: typeof recipe.servings === 'number' ? recipe.servings : 2,
      cuisine_type: recipe.cuisine_type || null,
      tags: Array.isArray(recipe.tags) ? recipe.tags : [],
      notes: recipe.notes || null,
      confidence: parsed.confidence || 0.7,
    }))

    return {
      recipes,
      total_found: parsed.total_found || recipes.length,
      confidence: parsed.confidence || 0.7,
    }
  } catch (err) {
    console.error('Failed to parse bulk recipes:', responseText, err)
    throw new Error('Failed to parse recipes from text')
  }
}

export async function generateShoppingFromRecipe(
  ingredients: RecipeIngredient[],
  inventoryItems: string[]
): Promise<RecipeShoppingResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const ingredientList = ingredients
    .map(i => `${i.quantity || ''} ${i.unit || ''} ${i.name}`.trim())
    .join('\n')

  const inventoryList = inventoryItems.length > 0
    ? inventoryItems.join(', ')
    : 'empty (user has nothing)'

  const prompt = `${RECIPE_TO_SHOPPING_PROMPT}

Recipe ingredients:
${ingredientList}

User's current inventory: ${inventoryList}`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const responseText = response.text()

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON object found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      items_needed: (parsed.items_needed || []).map((item: { name: string; quantity?: number | string; unit?: string; category?: string }) => ({
        name: item.name || 'Unknown',
        quantity: item.quantity ?? 1,
        unit: item.unit || 'pc',
        category: item.category || 'other',
      })),
      already_have: Array.isArray(parsed.already_have) ? parsed.already_have : [],
      assumed_pantry: Array.isArray(parsed.assumed_pantry) ? parsed.assumed_pantry : [],
    }
  } catch (err) {
    console.error('Failed to generate shopping from recipe:', responseText, err)
    throw new Error('Failed to generate shopping list from recipe')
  }
}
