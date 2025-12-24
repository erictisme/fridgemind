import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

// ============================================
// Types
// ============================================

export interface BrandRecommendation {
  brand: string
  product_type: string  // e.g., "Extra Virgin", "Light", "Classic"
  reason: string
  price_tier: 'budget' | 'mid' | 'premium'
  is_recommended: boolean
  where_to_buy: string  // e.g., "FairPrice", "Cold Storage"
}

export interface BrandRecommendationsResult {
  recommendations: BrandRecommendation[]
}

export interface ProductComparison {
  recommendation: string
  products_detected: string[]
  reasoning: string
}

// ============================================
// 1. Suggest Brands - Value for money recommendations
// ============================================

const BRAND_RECOMMENDATIONS_PROMPT = `You are a shopping assistant expert in the Singapore market. Help shoppers find good value-for-money brands AND product types at major Singapore supermarkets.

SINGAPORE SUPERMARKET CONTEXT:
- FairPrice (including FairPrice Finest, FairPrice Housebrand)
- Cold Storage
- Giant
- Sheng Siong
- Don Don Donki
- RedMart (online)

IMPORTANT - INCLUDE PRODUCT TYPES:
For items with variants, specify the type/variant, for example:
- Olive oil: "Extra Virgin", "Light", "Pure", "Cold-Pressed"
- Soy sauce: "Light", "Dark", "Sweet"
- Milk: "Full Cream", "Low Fat", "Skim", "Fresh", "UHT"
- Rice: "Jasmine", "Basmati", "Japanese", "Brown"
- Eggs: "Kampung", "Omega-3", "Free-range", "Regular"
- Salt: "Table", "Sea Salt", "Pink Himalayan", "Kosher"

RULES:
- Focus on brands AND product types actually available in Singapore
- Specify WHERE to buy each recommendation (which supermarket)
- Consider value for money (quality vs price)
- Recommend 3-5 options at different price tiers
- Mark ONE as "is_recommended: true" - your top pick for value
- Be practical - suggest what people can actually find in Singapore
- Consider quality differences honestly
- For local products, mention local vs imported options

Return ONLY a valid JSON object:
{
  "recommendations": [
    {
      "brand": "Brand Name",
      "product_type": "Variant/Type (e.g., Extra Virgin, Light, Fresh)",
      "reason": "Brief explanation why this is good/worth it",
      "price_tier": "budget" | "mid" | "premium",
      "is_recommended": true | false,
      "where_to_buy": "FairPrice/Cold Storage/Giant/etc"
    }
  ]
}

Do not include any text before or after the JSON.`

export async function suggestBrands(
  itemName: string,
  context?: string
): Promise<BrandRecommendation[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const contextStr = context ? `\nAdditional context: ${context}` : ''
  const prompt = `${BRAND_RECOMMENDATIONS_PROMPT}

Shopping list item: "${itemName}"${contextStr}

Suggest brands available in Singapore supermarkets for this item.`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const responseText = response.text()

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON object found in response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as BrandRecommendationsResult

    // Validate and clean up
    const recommendations = (parsed.recommendations || []).map(rec => ({
      brand: rec.brand || 'Unknown',
      product_type: rec.product_type || '',
      reason: rec.reason || 'Good option',
      price_tier: ['budget', 'mid', 'premium'].includes(rec.price_tier) ? rec.price_tier : 'mid',
      is_recommended: rec.is_recommended || false,
      where_to_buy: rec.where_to_buy || 'Most supermarkets',
    })) as BrandRecommendation[]

    // Ensure at least one is marked as recommended
    if (recommendations.length > 0 && !recommendations.some(r => r.is_recommended)) {
      recommendations[0].is_recommended = true
    }

    return recommendations
  } catch (err) {
    console.error('Failed to parse brand recommendations response:', responseText, err)
    throw new Error('Failed to suggest brands')
  }
}

// ============================================
// 2. Compare Products - Photo-based comparison
// ============================================

const PRODUCT_COMPARISON_PROMPT = `You are a shopping assistant helping someone choose between products at a Singapore supermarket.

The user has taken a photo of multiple product options and wants help deciding which to buy.

RULES:
- Identify all visible products in the image
- Consider: price (if visible), quality indicators, brand reputation, value for money
- Be practical and honest
- Consider Singapore market context
- Give a clear recommendation with reasoning

Return ONLY a valid JSON object:
{
  "recommendation": "Clear statement of which product to choose and why",
  "products_detected": ["Product 1 name/brand", "Product 2 name/brand", ...],
  "reasoning": "Detailed explanation comparing the options (price, quality, value, etc.)"
}

Do not include any text before or after the JSON.`

export async function compareProducts(
  imageBase64: string,
  question: string
): Promise<ProductComparison> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  const prompt = `${PRODUCT_COMPARISON_PROMPT}

User's question: "${question}"

Please analyze the products in the image and help the user decide.`

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
  const responseText = response.text()

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON object found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      recommendation: parsed.recommendation || 'Unable to make a clear recommendation',
      products_detected: parsed.products_detected || [],
      reasoning: parsed.reasoning || 'Could not analyze products',
    }
  } catch (err) {
    console.error('Failed to parse product comparison response:', responseText, err)
    throw new Error('Failed to compare products')
  }
}
