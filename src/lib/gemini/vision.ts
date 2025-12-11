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
