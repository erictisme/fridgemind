import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

// ============================================
// Types
// ============================================

export interface ParsedShoppingItem {
  name: string
  quantity: number
  unit: string
  category: string
}

export interface MealIngredient {
  name: string
  quantity: number
  unit: string
  category: string
  reason?: string
}

export interface MealToListResult {
  recipe_name: string
  ingredients_needed: MealIngredient[]
  already_have: string[]
}

export interface AlternativeItem {
  name: string
  reason: string
}

export interface AlternativesResult {
  alternatives: AlternativeItem[]
}

// ============================================
// 1. Smart Parse - Text dump → structured items
// ============================================

const SMART_PARSE_PROMPT = `You are a shopping list assistant. Parse the user's messy text input into structured shopping list items.

Rules:
- Extract item names, quantities, and units
- If quantity is not specified, default to 1
- Guess appropriate units (pc, pack, bunch, bottle, kg, g, dozen, etc.)
- Categorize items: produce, dairy, protein, pantry, beverage, frozen, bakery, snacks, household, other
- Clean up item names (capitalize properly, fix typos if obvious)
- Combine duplicates

Return ONLY a valid JSON array:
[
  { "name": "Item Name", "quantity": 1, "unit": "pc", "category": "produce" }
]

Do not include any text before or after the JSON.`

export async function parseShoppingText(text: string): Promise<ParsedShoppingItem[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `${SMART_PARSE_PROMPT}

User input: "${text}"`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const responseText = response.text()

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found in response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParsedShoppingItem[]

    // Validate and clean up
    return parsed.map(item => ({
      name: item.name || 'Unknown Item',
      quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
      unit: item.unit || 'pc',
      category: item.category || 'other',
    }))
  } catch (err) {
    console.error('Failed to parse shopping text response:', responseText, err)
    throw new Error('Failed to parse shopping list items')
  }
}

// ============================================
// 2. Meal → Shopping List (with inventory check)
// ============================================

const MEAL_TO_LIST_PROMPT = `You are a cooking assistant. Given a meal idea and the user's current inventory, generate a shopping list of ingredients they need to buy.

Rules:
- Only include ingredients they DON'T already have
- Be practical - suggest common, easy-to-find ingredients
- Include reasonable quantities for 2-4 servings
- Categorize items: produce, dairy, protein, pantry, beverage, frozen, bakery, other
- For each ingredient, briefly explain why it's needed
- If user has similar items, don't include them (e.g., if they have "yellow onion", don't add "onion")

Return ONLY a valid JSON object:
{
  "recipe_name": "Cleaned up recipe name",
  "ingredients_needed": [
    { "name": "Item", "quantity": 1, "unit": "pc", "category": "produce", "reason": "brief reason" }
  ],
  "already_have": ["item1", "item2"]
}

Do not include any text before or after the JSON.`

export async function generateListFromMeal(
  mealDescription: string,
  inventoryItems: string[]
): Promise<MealToListResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const inventoryList = inventoryItems.length > 0
    ? inventoryItems.join(', ')
    : 'empty (user has nothing)'

  const prompt = `${MEAL_TO_LIST_PROMPT}

Meal idea: "${mealDescription}"
Current inventory: ${inventoryList}`

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
      recipe_name: parsed.recipe_name || mealDescription,
      ingredients_needed: (parsed.ingredients_needed || []).map((item: MealIngredient) => ({
        name: item.name || 'Unknown Item',
        quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
        unit: item.unit || 'pc',
        category: item.category || 'other',
        reason: item.reason,
      })),
      already_have: parsed.already_have || [],
    }
  } catch (err) {
    console.error('Failed to parse meal-to-list response:', responseText, err)
    throw new Error('Failed to generate shopping list from meal idea')
  }
}

// ============================================
// 3. Suggest Alternatives (for "couldn't find")
// ============================================

const SUGGEST_ALTERNATIVES_PROMPT = `You are a cooking assistant helping someone at the grocery store. They couldn't find a specific item and need alternatives.

Rules:
- Suggest 2-3 practical alternatives that could substitute for the item
- Consider the likely use case (cooking, baking, etc.)
- Explain briefly why each alternative works
- Alternatives should be commonly available in grocery stores

Return ONLY a valid JSON object:
{
  "alternatives": [
    { "name": "Alternative Item", "reason": "Brief explanation of why it's a good substitute" }
  ]
}

Do not include any text before or after the JSON.`

export async function suggestAlternatives(
  itemName: string,
  context?: string
): Promise<AlternativesResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const contextStr = context ? `\nContext: ${context}` : ''
  const prompt = `${SUGGEST_ALTERNATIVES_PROMPT}

Item not found: "${itemName}"${contextStr}`

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
      alternatives: (parsed.alternatives || []).map((alt: AlternativeItem) => ({
        name: alt.name || 'Unknown',
        reason: alt.reason || 'Similar substitute',
      })),
    }
  } catch (err) {
    console.error('Failed to parse alternatives response:', responseText, err)
    throw new Error('Failed to suggest alternatives')
  }
}
