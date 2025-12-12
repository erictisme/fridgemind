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
  recipe_summary: string
  estimated_time_minutes: number
  difficulty: 'easy' | 'medium' | 'hard'
  ingredients_from_inventory: string[]
  additional_ingredients_needed: string[]
  expiring_items_used: string[]
  priority_score: number
}

export async function generateMealSuggestions(
  inventoryItems: Array<{ name: string; expiry_date: string; quantity: number }>,
  preferences?: string
): Promise<MealSuggestionAI[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  // Format inventory for prompt
  const inventoryText = inventoryItems.map(item => {
    const daysUntil = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const urgency = daysUntil <= 0 ? ' (EXPIRED!)' : daysUntil <= 2 ? ' (USE SOON!)' : daysUntil <= 5 ? ' (expiring soon)' : ''
    return `- ${item.name} (qty: ${item.quantity})${urgency}`
  }).join('\n')

  const preferencesText = preferences ? `\nUser preferences: ${preferences}` : ''

  const prompt = `You are a creative home chef assistant. Generate 3-4 practical meal suggestions based on this inventory.

INVENTORY:
${inventoryText}
${preferencesText}

PRIORITIES:
1. USE items marked "(EXPIRED!)" or "(USE SOON!)" first - these are highest priority
2. Create practical, realistic meals a home cook can make
3. Minimize additional ingredients needed
4. Variety in meal types and cuisines

Return ONLY valid JSON array:
[
  {
    "name": "Meal Name",
    "description": "Brief appetizing 1-sentence description",
    "recipe_summary": "3-5 step brief instructions",
    "estimated_time_minutes": number,
    "difficulty": "easy" | "medium" | "hard",
    "ingredients_from_inventory": ["item1", "item2"],
    "additional_ingredients_needed": ["item3"],
    "expiring_items_used": ["items that are expiring soon"],
    "priority_score": 0-100 (higher if uses expiring items)
  }
]

Do not include any text before or after the JSON array.`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const suggestions: MealSuggestionAI[] = JSON.parse(jsonMatch[0])
    return suggestions.sort((a, b) => b.priority_score - a.priority_score)
  } catch (err) {
    console.error('Failed to parse meal suggestions:', text, err)
    throw new Error('Failed to generate meal suggestions')
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
