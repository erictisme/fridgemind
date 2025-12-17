import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

export interface DetectedItem {
  name: string
  storage_category: string
  nutritional_type: string
  quantity: number
  unit: string
  estimated_expiry_days: number
  confidence: number
  freshness: string
}

export interface VisionResponse {
  items: DetectedItem[]
  summary: {
    total_detected: number
    high_confidence: number
    needs_review: number
  }
}

const VISION_PROMPT = `You are a food inventory assistant. Analyze the provided image(s) of a refrigerator/freezer/pantry and identify all visible food items.

For each item you can clearly identify, provide:
1. name: Be specific (e.g., "2% milk" not just "milk", "cheddar cheese" not just "cheese")
2. storage_category: One of: produce, dairy, protein, pantry, beverage, condiment, frozen
3. nutritional_type: One of: protein, carbs, fibre, misc (use fibre for vegetables/fruits, misc for everything else)
4. quantity: Estimated number/amount (use 1 if unsure)
5. unit: One of: piece, pack, bottle, carton, lb, oz, gallon, bunch, bag, container, can, jar
6. estimated_expiry_days: Days until typical expiry based on the item type (use typical shelf life)
7. confidence: 0.0-1.0 score of how certain you are about the identification
8. freshness: One of: fresh, use_soon, expired (based on visual appearance if visible)

IMPORTANT GUIDELINES:
- Only include items you can clearly see and identify
- For partially visible items, lower the confidence score
- If you can see the same item multiple times (like multiple bottles), count them as separate if clearly distinct
- Be specific with names when brands or types are visible
- For produce, estimate freshness based on appearance if visible
- For packaged goods, use standard shelf life estimates

Output format: Return ONLY a valid JSON object with this structure:
{
  "items": [
    {
      "name": "string",
      "storage_category": "string",
      "nutritional_type": "string",
      "quantity": number,
      "unit": "string",
      "estimated_expiry_days": number,
      "confidence": number,
      "freshness": "string"
    }
  ]
}

Do not include any text before or after the JSON. Only return the JSON object.`

export async function analyzeImage(imageBase64: string): Promise<VisionResponse> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data,
      },
    },
    VISION_PROMPT,
  ])

  const response = await result.response
  const text = response.text()

  // Parse the JSON response
  try {
    // Extract JSON from the response (in case there's extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])
    const items: DetectedItem[] = parsed.items || []

    // Calculate summary
    const highConfidence = items.filter(item => item.confidence >= 0.8).length
    const needsReview = items.filter(item => item.confidence < 0.8).length

    return {
      items,
      summary: {
        total_detected: items.length,
        high_confidence: highConfidence,
        needs_review: needsReview,
      },
    }
  } catch {
    console.error('Failed to parse Gemini response:', text)
    throw new Error('Failed to parse AI response')
  }
}

export interface ExpiryEstimate {
  expiry_days: number
  expiry_date: string
  reasoning: string
}

export interface StorageEstimate {
  location: 'fridge' | 'freezer' | 'pantry'
  expiry_days: number
  expiry_date: string
  reasoning: string
}

const EXPIRY_PROMPT = `You are a food safety expert. Given a food item name, storage location, and purchase date, estimate when it will expire.

Consider:
- The specific type of food (fresh produce vs packaged goods vs dairy etc.)
- The storage location (fridge typically extends life, freezer extends significantly, pantry varies)
- General food safety guidelines

Return ONLY a valid JSON object with this structure:
{
  "expiry_days": number (days from purchase date until expiry),
  "reasoning": "brief explanation of why this estimate"
}

Do not include any text before or after the JSON. Only return the JSON object.`

export async function estimateExpiry(
  itemName: string,
  location: string,
  purchaseDate: string
): Promise<ExpiryEstimate> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `${EXPIRY_PROMPT}

Food item: ${itemName}
Storage location: ${location}
Purchase date: ${purchaseDate}`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate expiry_days is a positive number
    const expiryDays = typeof parsed.expiry_days === 'number' && parsed.expiry_days > 0
      ? parsed.expiry_days
      : 7 // Default to 7 days if invalid

    // Calculate expiry date from purchase date + days
    const purchase = new Date(purchaseDate)
    if (isNaN(purchase.getTime())) {
      throw new Error('Invalid purchase date')
    }
    const expiryDate = new Date(purchase.getTime() + expiryDays * 24 * 60 * 60 * 1000)

    return {
      expiry_days: expiryDays,
      expiry_date: expiryDate.toISOString().split('T')[0],
      reasoning: parsed.reasoning || 'Estimated based on typical shelf life',
    }
  } catch (err) {
    console.error('Failed to parse Gemini expiry response:', text, err)
    throw new Error('Failed to estimate expiry date')
  }
}

const STORAGE_PROMPT = `You are a food storage expert. Given a food item name and purchase date, recommend where to store it and estimate when it will expire.

Storage locations:
- fridge: Perishable items that need refrigeration (dairy, fresh produce, meat, eggs, opened condiments)
- freezer: Items to freeze for long-term storage (frozen foods, meat for later)
- pantry: Shelf-stable items (canned goods, dry pasta, rice, unopened sauces, snacks, bread)

Return ONLY a valid JSON object:
{
  "location": "fridge" | "freezer" | "pantry",
  "expiry_days": number (days from purchase date until expiry),
  "reasoning": "brief explanation"
}

Do not include any text before or after the JSON.`

export async function estimateStorage(
  itemName: string,
  purchaseDate: string
): Promise<StorageEstimate> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `${STORAGE_PROMPT}

Food item: ${itemName}
Purchase date: ${purchaseDate}`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate location
    const validLocations = ['fridge', 'freezer', 'pantry']
    const location = validLocations.includes(parsed.location) ? parsed.location : 'fridge'

    // Validate expiry_days
    const expiryDays = typeof parsed.expiry_days === 'number' && parsed.expiry_days > 0
      ? parsed.expiry_days
      : 7

    // Calculate expiry date
    const purchase = new Date(purchaseDate)
    if (isNaN(purchase.getTime())) {
      throw new Error('Invalid purchase date')
    }
    const expiryDate = new Date(purchase.getTime() + expiryDays * 24 * 60 * 60 * 1000)

    return {
      location,
      expiry_days: expiryDays,
      expiry_date: expiryDate.toISOString().split('T')[0],
      reasoning: parsed.reasoning || 'Estimated based on typical storage requirements',
    }
  } catch (err) {
    console.error('Failed to parse Gemini storage response:', text, err)
    // Fallback to fridge with 7 days
    const purchase = new Date(purchaseDate)
    const fallbackExpiry = new Date(purchase.getTime() + 7 * 24 * 60 * 60 * 1000)
    return {
      location: 'fridge',
      expiry_days: 7,
      expiry_date: fallbackExpiry.toISOString().split('T')[0],
      reasoning: 'Default estimate (AI parsing failed)',
    }
  }
}

// Nutrition estimation for eating out
export interface NutritionEstimate {
  meal_name: string
  detected_components: string[]
  estimated_calories: number
  protein_grams: number
  carbs_grams: number
  fat_grams: number
  fiber_grams: number
  vegetable_servings: number
  health_assessment: string
  notes: string
}

const NUTRITION_PROMPT = `You are a nutrition expert. Analyze this photo of a restaurant meal and estimate its nutritional content.

Consider typical restaurant portion sizes. Be realistic but conservative with estimates.

Return ONLY a valid JSON object with this structure:
{
  "meal_name": "Descriptive name of the dish",
  "detected_components": ["component1", "component2", ...],
  "estimated_calories": number,
  "protein_grams": number,
  "carbs_grams": number,
  "fat_grams": number,
  "fiber_grams": number,
  "vegetable_servings": number (0, 0.5, 1, 1.5, 2, etc.),
  "health_assessment": "balanced" | "protein_heavy" | "carb_heavy" | "high_fat" | "vegetable_rich" | "light",
  "notes": "Brief observation about the meal's nutrition"
}

Do not include any text before or after the JSON.`

export async function analyzeNutrition(imageBase64: string): Promise<NutritionEstimate> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data,
      },
    },
    NUTRITION_PROMPT,
  ])

  const response = await result.response
  const text = response.text()

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      meal_name: parsed.meal_name || 'Unknown meal',
      detected_components: parsed.detected_components || [],
      estimated_calories: parsed.estimated_calories || 0,
      protein_grams: parsed.protein_grams || 0,
      carbs_grams: parsed.carbs_grams || 0,
      fat_grams: parsed.fat_grams || 0,
      fiber_grams: parsed.fiber_grams || 0,
      vegetable_servings: parsed.vegetable_servings || 0,
      health_assessment: parsed.health_assessment || 'balanced',
      notes: parsed.notes || '',
    }
  } catch (err) {
    console.error('Failed to parse Gemini nutrition response:', text, err)
    throw new Error('Failed to analyze nutrition')
  }
}

// Meal suggestion interface
export interface MealSuggestionAI {
  name: string
  description: string
  recipe_steps: string[]
  recipe_summary?: string // Legacy field for backwards compatibility
  estimated_time_minutes: number
  difficulty: 'easy' | 'medium' | 'hard'
  ingredients_from_inventory: string[]
  additional_ingredients_needed: string[]
  expiring_items_used: string[]
  priority_score: number
}

export interface MealSuggestionOptions {
  recipeCount?: number // How many recipes to generate (1-5)
  mustUseItems?: string[] // Items the user specifically wants to use
  cookingMethods?: string[] // Preferred cooking methods: oven, airfry, boil, steam, pan, etc.
  remarks?: string // Custom notes/instructions from user
}

export async function generateMealSuggestions(
  inventoryItems: Array<{ name: string; expiry_date: string; quantity: number }>,
  preferences?: string,
  options?: MealSuggestionOptions
): Promise<MealSuggestionAI[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const recipeCount = Math.min(5, Math.max(1, options?.recipeCount || 3))
  const mustUseItems = options?.mustUseItems || []
  const cookingMethods = options?.cookingMethods || []
  const remarks = options?.remarks || ''

  // Format inventory for prompt - highlight must-use items
  const inventoryText = inventoryItems.map(item => {
    const daysUntil = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const urgency = daysUntil <= 0 ? ' (EXPIRED!)' : daysUntil <= 2 ? ' (USE SOON!)' : daysUntil <= 5 ? ' (expiring soon)' : ''
    const mustUse = mustUseItems.some(m => item.name.toLowerCase().includes(m.toLowerCase())) ? ' ⭐MUST USE' : ''
    return `- ${item.name} (qty: ${item.quantity})${urgency}${mustUse}`
  }).join('\n')

  const preferencesText = preferences ? `\nUser preferences: ${preferences}` : ''

  // Build cooking methods instruction
  const cookingMethodsText = cookingMethods.length > 0
    ? `\nPREFERRED COOKING METHODS: ${cookingMethods.join(', ')}. Prioritize recipes using these methods.`
    : ''

  // Build remarks instruction
  const remarksText = remarks.trim()
    ? `\nUSER'S SPECIAL INSTRUCTIONS: "${remarks}". Follow these instructions carefully when designing recipes.`
    : ''

  // Build priority instructions based on whether user selected items
  let priorityInstructions: string
  if (mustUseItems.length > 0) {
    priorityInstructions = `PRIORITIES (CRITICAL):
1. EVERY recipe MUST use at least one item marked "⭐MUST USE" - this is the user's primary goal
2. Also try to use items marked "(EXPIRED!)" or "(USE SOON!)" when possible
3. Create practical, realistic meals a home cook can make
4. Minimize additional ingredients needed

The user specifically wants to cook with: ${mustUseItems.join(', ')}
Build recipes AROUND these ingredients.`
  } else {
    priorityInstructions = `PRIORITIES:
1. USE items marked "(EXPIRED!)" or "(USE SOON!)" first - these are highest priority
2. Create practical, realistic meals a home cook can make
3. Minimize additional ingredients needed
4. Variety in meal types and cuisines`
  }

  // Distinctness rule for multiple recipes
  const distinctnessRule = recipeCount > 1
    ? `\nIMPORTANT - RECIPE DISTINCTNESS:
- Each recipe must be DISTINCT - different cooking style, cuisine, or main technique
- MINIMIZE ingredient overlap between recipes - spread selected ingredients across different dishes
- If user selected 7 ingredients for 3 recipes, each recipe should focus on 2-3 main ingredients, not all 7
- Vary the cooking methods across recipes (e.g., one stir-fry, one baked, one soup)`
    : ''

  const prompt = `You are a creative home chef assistant. Generate exactly ${recipeCount} practical meal suggestion${recipeCount > 1 ? 's' : ''} based on this inventory.

INVENTORY:
${inventoryText}
${preferencesText}${cookingMethodsText}${remarksText}

${priorityInstructions}${distinctnessRule}

Return ONLY valid JSON array with exactly ${recipeCount} recipe${recipeCount > 1 ? 's' : ''}:
[
  {
    "name": "Meal Name",
    "description": "Brief appetizing 1-sentence description",
    "recipe_steps": ["Step 1 instruction", "Step 2 instruction", "Step 3 instruction"],
    "estimated_time_minutes": number,
    "difficulty": "easy" | "medium" | "hard",
    "ingredients_from_inventory": ["item1", "item2"],
    "additional_ingredients_needed": ["item3"],
    "expiring_items_used": ["items that are expiring soon"],
    "priority_score": 0-100 (higher if uses must-use/expiring items)
  }
]

IMPORTANT: recipe_steps must be an array of strings, each step as a separate item. Do NOT use numbered prefixes like "1." in the steps.

Do not include any text before or after the JSON array.`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const rawSuggestions = JSON.parse(jsonMatch[0])

    // Normalize the response to ensure recipe_steps is always an array
    const suggestions: MealSuggestionAI[] = rawSuggestions.map((s: Record<string, unknown>) => ({
      ...s,
      // Handle various formats the AI might return
      recipe_steps: Array.isArray(s.recipe_steps)
        ? s.recipe_steps
        : typeof s.recipe_steps === 'string'
          ? [s.recipe_steps]
          : typeof s.recipe_summary === 'string'
            ? s.recipe_summary.split(/\d+\.\s*/).filter(Boolean).map((step: string) => step.trim())
            : [],
    }))

    return suggestions.sort((a, b) => b.priority_score - a.priority_score)
  } catch (err) {
    console.error('Failed to parse meal suggestions:', text, err)
    throw new Error('Failed to generate meal suggestions')
  }
}

// Nutrition estimation for home-cooked meals from inventory items
export async function estimateHomeMealNutrition(
  items: Array<{ name: string; quantity: number; unit: string }>
): Promise<NutritionEstimate> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const itemsList = items.map(item => `- ${item.name}: ${item.quantity} ${item.unit}`).join('\n')

  const prompt = `You are a nutrition expert. Estimate the combined nutritional content of this home-cooked meal made from these ingredients:

INGREDIENTS USED:
${itemsList}

Assume typical home cooking methods and portion sizes. Be realistic with estimates.

Return ONLY a valid JSON object with this structure:
{
  "meal_name": "Descriptive name for this combination (e.g., 'Stir-fried Cabbage with Tofu and Avocado')",
  "detected_components": ["ingredient1", "ingredient2", ...],
  "estimated_calories": number,
  "protein_grams": number,
  "carbs_grams": number,
  "fat_grams": number,
  "fiber_grams": number,
  "vegetable_servings": number (0, 0.5, 1, 1.5, 2, etc.),
  "health_assessment": "balanced" | "protein_heavy" | "carb_heavy" | "high_fat" | "vegetable_rich" | "light",
  "notes": "Brief observation about the meal's nutrition"
}

Do not include any text before or after the JSON.`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      meal_name: parsed.meal_name || 'Home-cooked meal',
      detected_components: parsed.detected_components || items.map(i => i.name),
      estimated_calories: parsed.estimated_calories || 0,
      protein_grams: parsed.protein_grams || 0,
      carbs_grams: parsed.carbs_grams || 0,
      fat_grams: parsed.fat_grams || 0,
      fiber_grams: parsed.fiber_grams || 0,
      vegetable_servings: parsed.vegetable_servings || 0,
      health_assessment: parsed.health_assessment || 'balanced',
      notes: parsed.notes || '',
    }
  } catch (err) {
    console.error('Failed to parse home meal nutrition response:', text, err)
    throw new Error('Failed to estimate nutrition')
  }
}

export async function analyzeMultipleImages(imagesBase64: string[]): Promise<VisionResponse> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  // Build content array with all images
  const content: Array<{ inlineData: { mimeType: string; data: string } } | string> = []

  for (const imageBase64 of imagesBase64) {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    content.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data,
      },
    })
  }

  content.push(VISION_PROMPT)

  const result = await model.generateContent(content)
  const response = await result.response
  const text = response.text()

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])
    const items: DetectedItem[] = parsed.items || []

    const highConfidence = items.filter(item => item.confidence >= 0.8).length
    const needsReview = items.filter(item => item.confidence < 0.8).length

    return {
      items,
      summary: {
        total_detected: items.length,
        high_confidence: highConfidence,
        needs_review: needsReview,
      },
    }
  } catch {
    console.error('Failed to parse Gemini response:', text)
    throw new Error('Failed to parse AI response')
  }
}
