import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

export interface ReceiptItem {
  name: string
  normalized_name: string  // Clean, human-readable name like "Cherry Tomatoes"
  food_type: string        // Generic type like "tomato", "pork", "milk"
  item_code?: string
  quantity: number
  unit: string
  unit_price?: number
  total_price: number
  discount?: number
  category: string
}

export interface ParsedReceipt {
  store_name: string
  store_branch?: string
  receipt_date: string // ISO date string
  receipt_number?: string
  subtotal?: number
  gst?: number
  total: number
  payment_method?: string
  items: ReceiptItem[]
}

const RECEIPT_PARSER_PROMPT = `You are a receipt parser specializing in Singapore supermarket receipts, especially FairPrice (NTUC FairPrice).

Analyze the provided receipt image/PDF and extract all information.

IMPORTANT FOR FAIRPRICE RECEIPTS:
- Store name is usually "NTUC FAIRPRICE" or similar
- Branch location appears near the top
- Receipt number may be labeled as "TRANS#" or similar
- Items show: description, quantity (if > 1), unit price, total
- GST (7% or 9%) is shown separately
- Payment method: NETS, VISA, MASTERCARD, CASH, etc.
- LinkPoints or FairPrice app discounts may appear

For each item:
1. CATEGORY - categorize it:
   - produce: fruits, vegetables, salads
   - dairy: milk, cheese, yogurt, butter, cream
   - protein: meat, chicken, fish, seafood, eggs, tofu
   - pantry: rice, pasta, canned goods, sauces, spices, oil
   - beverage: water, juice, soda, coffee, tea
   - frozen: frozen foods, ice cream
   - household: cleaning, paper products, toiletries
   - snacks: chips, cookies, chocolate, candy
   - bakery: bread, pastries
   - other: anything else

2. NORMALIZED_NAME - clean, human-readable name:
   - "G JAPANSE CAI XIN220" → "Japanese Cai Xin"
   - "D B.PORK SHOULDER250" → "Pork Shoulder"
   - "CHY TOM 250G" → "Cherry Tomatoes"
   - Remove brand codes, weights, store prefixes
   - Keep it simple and recognizable

3. FOOD_TYPE - generic food type for grouping:
   - "cherry_tomatoes", "tomatoes", "pork", "chicken_breast", "milk", "eggs"
   - "leafy_greens", "mushroom", "onion", "garlic", "rice", "pasta"
   - Use lowercase with underscores, be specific but not brand-specific

Output format: Return ONLY a valid JSON object:
{
  "store_name": "string",
  "store_branch": "string or null",
  "receipt_date": "YYYY-MM-DD",
  "receipt_number": "string or null",
  "subtotal": number or null,
  "gst": number or null,
  "total": number,
  "payment_method": "string or null",
  "items": [
    {
      "name": "string (original receipt text)",
      "normalized_name": "string (clean human-readable name)",
      "food_type": "string (generic type for grouping)",
      "item_code": "string or null",
      "quantity": number,
      "unit": "string (pc, kg, pack, bottle, etc)",
      "unit_price": number or null,
      "total_price": number,
      "discount": number or null,
      "category": "string"
    }
  ]
}

GUIDELINES:
- Keep original "name" as-is from receipt for reference
- "normalized_name" should be what a human would call the item
- "food_type" should be consistent across different brands/sizes of same item
- Convert all prices to numbers (no $ symbols)
- If quantity is not specified, assume 1
- If unit is not clear, use "pc" (piece)
- Date format must be YYYY-MM-DD
- If you can't determine a value, use null
- Do not include any text before or after the JSON`

export async function parseReceiptPDF(pdfBase64: string): Promise<ParsedReceipt> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  // Remove data URL prefix if present
  const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '')

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Data,
      },
    },
    RECEIPT_PARSER_PROMPT,
  ])

  const response = await result.response
  const text = response.text()

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate required fields
    if (!parsed.total || !parsed.items) {
      throw new Error('Missing required fields: total or items')
    }

    return {
      store_name: parsed.store_name || 'Unknown Store',
      store_branch: parsed.store_branch || null,
      receipt_date: parsed.receipt_date || new Date().toISOString().split('T')[0],
      receipt_number: parsed.receipt_number || null,
      subtotal: parsed.subtotal || null,
      gst: parsed.gst || null,
      total: parsed.total,
      payment_method: parsed.payment_method || null,
      items: parsed.items.map((item: ReceiptItem) => ({
        name: item.name,
        normalized_name: item.normalized_name || item.name,
        food_type: item.food_type || 'other',
        item_code: item.item_code || null,
        quantity: item.quantity || 1,
        unit: item.unit || 'pc',
        unit_price: item.unit_price || null,
        total_price: item.total_price,
        discount: item.discount || 0,
        category: item.category || 'other',
      })),
    }
  } catch (error) {
    console.error('Failed to parse PDF receipt response:', text)
    throw new Error(`Failed to parse receipt: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function parseReceiptImage(imageBase64: string): Promise<ParsedReceipt> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data,
      },
    },
    RECEIPT_PARSER_PROMPT,
  ])

  const response = await result.response
  const text = response.text()

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    if (!parsed.total || !parsed.items) {
      throw new Error('Missing required fields: total or items')
    }

    return {
      store_name: parsed.store_name || 'Unknown Store',
      store_branch: parsed.store_branch || null,
      receipt_date: parsed.receipt_date || new Date().toISOString().split('T')[0],
      receipt_number: parsed.receipt_number || null,
      subtotal: parsed.subtotal || null,
      gst: parsed.gst || null,
      total: parsed.total,
      payment_method: parsed.payment_method || null,
      items: parsed.items.map((item: ReceiptItem) => ({
        name: item.name,
        normalized_name: item.normalized_name || item.name,
        food_type: item.food_type || 'other',
        item_code: item.item_code || null,
        quantity: item.quantity || 1,
        unit: item.unit || 'pc',
        unit_price: item.unit_price || null,
        total_price: item.total_price,
        discount: item.discount || 0,
        category: item.category || 'other',
      })),
    }
  } catch (error) {
    console.error('Failed to parse image receipt response:', text)
    throw new Error(`Failed to parse receipt: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const TEXT_RECEIPT_PROMPT = `You are a receipt parser. Parse the following receipt text (could be copy-pasted from email, screenshot OCR, or typed manually).

The text may be from:
- Supermarket receipts (FairPrice, Cold Storage, Giant, etc.)
- Online grocery orders (RedMart, Amazon Fresh, etc.)
- Boutique/specialty food stores
- Restaurant receipts
- Any food purchase

For each item:
1. CATEGORY - categorize it:
   - produce: fruits, vegetables, salads
   - dairy: milk, cheese, yogurt, butter, cream
   - protein: meat, chicken, fish, seafood, eggs, tofu
   - pantry: rice, pasta, canned goods, sauces, spices, oil
   - beverage: water, juice, soda, coffee, tea
   - frozen: frozen foods, ice cream
   - household: cleaning, paper products, toiletries
   - snacks: chips, cookies, chocolate, candy
   - bakery: bread, pastries
   - other: anything else

2. NORMALIZED_NAME - clean, human-readable name:
   - Remove brand codes, weights, store prefixes
   - Keep it simple and recognizable
   - Example: "CHY TOM 250G" → "Cherry Tomatoes"

3. FOOD_TYPE - generic food type for grouping:
   - Use lowercase with underscores
   - Examples: "cherry_tomatoes", "pork", "milk", "eggs", "leafy_greens"

Output format: Return ONLY a valid JSON object:
{
  "store_name": "string (guess from context if not explicit)",
  "store_branch": "string or null",
  "receipt_date": "YYYY-MM-DD (use today if not found)",
  "receipt_number": "string or null",
  "subtotal": number or null,
  "gst": number or null,
  "total": number,
  "payment_method": "string or null",
  "items": [
    {
      "name": "string (original text from receipt)",
      "normalized_name": "string (clean human-readable name)",
      "food_type": "string (generic type for grouping)",
      "quantity": number,
      "unit": "string (pc, kg, pack, bottle, etc)",
      "unit_price": number or null,
      "total_price": number,
      "category": "string"
    }
  ]
}

GUIDELINES:
- Keep original "name" as-is from receipt
- "normalized_name" should be what a human would call the item
- "food_type" should be consistent across different brands/sizes
- If quantity not specified, assume 1
- If unit not clear, use "pc"
- If total not found, sum up items
- Be generous in extracting items - better to include than miss
- Do not include any text before or after the JSON`

export async function parseReceiptText(receiptText: string): Promise<ParsedReceipt> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const result = await model.generateContent([
    TEXT_RECEIPT_PROMPT,
    `\n\nRECEIPT TEXT:\n${receiptText}`,
  ])

  const response = await result.response
  const text = response.text()

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    if (!parsed.items || parsed.items.length === 0) {
      throw new Error('No items found in receipt')
    }

    // Calculate total if not provided
    const calculatedTotal = parsed.items.reduce(
      (sum: number, item: { total_price?: number }) => sum + (item.total_price || 0),
      0
    )

    return {
      store_name: parsed.store_name || 'Unknown Store',
      store_branch: parsed.store_branch || null,
      receipt_date: parsed.receipt_date || new Date().toISOString().split('T')[0],
      receipt_number: parsed.receipt_number || null,
      subtotal: parsed.subtotal || null,
      gst: parsed.gst || null,
      total: parsed.total || calculatedTotal,
      payment_method: parsed.payment_method || null,
      items: parsed.items.map((item: ReceiptItem) => ({
        name: item.name,
        normalized_name: item.normalized_name || item.name,
        food_type: item.food_type || 'other',
        item_code: null,
        quantity: item.quantity || 1,
        unit: item.unit || 'pc',
        unit_price: item.unit_price || null,
        total_price: item.total_price || 0,
        discount: 0,
        category: item.category || 'other',
      })),
    }
  } catch (error) {
    console.error('Failed to parse text receipt:', text)
    throw new Error(`Failed to parse receipt text: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
