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
  estimated_time_minutes: number | null
  servings: number | null
  cuisine_type: string | null
  tags: string[]
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

const PARSE_RECIPE_TEXT_PROMPT = `You are a recipe assistant. Parse the user's recipe text (which may be messy, copied from social media, or informal) into a structured recipe.

Key principle: Recipes are GUIDES, not strict rules. Be flexible in interpretation.

Rules:
- Extract the recipe name (guess if not explicit)
- Identify ingredients with quantities and units (be flexible - "some garlic" is fine)
- Extract cooking instructions (keep them simple and conversational)
- Estimate cooking time if not stated
- Guess cuisine type if obvious
- Add relevant tags (vegetarian, quick, one-pot, etc.)
- If the text doesn't look like a recipe at all, set is_recipe: false

Return ONLY valid JSON:
{
  "is_recipe": true,
  "name": "Recipe Name",
  "description": "Brief description",
  "ingredients": [
    { "name": "garlic", "quantity": "2", "unit": "cloves", "optional": false },
    { "name": "olive oil", "quantity": "some", "unit": "", "optional": false }
  ],
  "instructions": "Step by step instructions as free text...",
  "estimated_time_minutes": 30,
  "servings": 2,
  "cuisine_type": "italian",
  "tags": ["quick", "vegetarian"],
  "confidence": 0.85
}

Do not include any text before or after the JSON.`

export async function parseRecipeText(text: string): Promise<ParsedRecipe> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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
      estimated_time_minutes: typeof parsed.estimated_time_minutes === 'number' ? parsed.estimated_time_minutes : null,
      servings: typeof parsed.servings === 'number' ? parsed.servings : null,
      cuisine_type: parsed.cuisine_type || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
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

const INSTAGRAM_RECIPE_PROMPT = `You are a recipe assistant analyzing an Instagram post. Extract a recipe from the caption (and image description if provided).

Key principle: Instagram recipes are often informal. Be flexible - "recipes are guides, not gods."

Rules:
- Determine if this post contains a recipe (cooking instructions + ingredients)
- If it's just food photography without recipe, set is_recipe: false
- Extract ingredients mentioned (may be scattered in caption)
- Piece together cooking steps from the caption
- Guess serving size and cooking time if not stated
- Identify cuisine type and add tags
- Be generous - even a loose "throw these together" description counts as a recipe

Return ONLY valid JSON:
{
  "is_recipe": true,
  "name": "Recipe Name",
  "description": "Brief description",
  "ingredients": [
    { "name": "ingredient", "quantity": "amount", "unit": "unit", "optional": false }
  ],
  "instructions": "Combined cooking instructions...",
  "estimated_time_minutes": 30,
  "servings": 2,
  "cuisine_type": "asian",
  "tags": ["quick", "healthy"],
  "confidence": 0.8
}

Do not include any text before or after the JSON.`

export async function extractRecipeFromInstagram(
  caption: string,
  imageDescription?: string
): Promise<ParsedRecipe> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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
      estimated_time_minutes: typeof parsed.estimated_time_minutes === 'number' ? parsed.estimated_time_minutes : null,
      servings: typeof parsed.servings === 'number' ? parsed.servings : null,
      cuisine_type: parsed.cuisine_type || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    }
  } catch (err) {
    console.error('Failed to extract Instagram recipe:', responseText, err)
    throw new Error('Failed to extract recipe from Instagram post')
  }
}

// ============================================
// 3. Generate Shopping List from Recipe
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

const BULK_RECIPE_PARSE_PROMPT = `You are a recipe assistant. The user has provided text that may contain MULTIPLE recipes (from a recipe website, cookbook page, or collection).

Your task: Extract ALL distinct recipes from the text.

Rules:
- Look for recipe patterns: titles followed by ingredients and instructions
- Each recipe should have: name, ingredients list, instructions
- Recipes may be separated by headers, blank lines, or ingredient categories
- Be thorough - don't miss any recipes
- If text is organized by ingredient (e.g., "Asparagus Recipes", "Avocado Recipes"), extract each individual recipe
- Estimate cooking time if not stated
- Add relevant tags for each recipe

Return ONLY valid JSON:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "description": "Brief description",
      "ingredients": [
        { "name": "ingredient", "quantity": "2", "unit": "cups", "optional": false }
      ],
      "instructions": "Step by step instructions...",
      "estimated_time_minutes": 30,
      "servings": 2,
      "cuisine_type": "italian",
      "tags": ["quick", "vegetarian"]
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
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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
      estimated_time_minutes: typeof recipe.estimated_time_minutes === 'number' ? recipe.estimated_time_minutes : null,
      servings: typeof recipe.servings === 'number' ? recipe.servings : 2,
      cuisine_type: recipe.cuisine_type || null,
      tags: Array.isArray(recipe.tags) ? recipe.tags : [],
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
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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
