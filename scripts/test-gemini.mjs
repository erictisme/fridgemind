// Test script to verify Google AI (Gemini) connection
import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from 'dotenv'

// Load .env.local
config({ path: '.env.local' })

const apiKey = process.env.GOOGLE_AI_API_KEY

console.log('Testing Google AI (Gemini) connection...\n')
console.log('API Key:', apiKey ? '✅ Found' : '❌ Missing')

if (!apiKey) {
  console.log('\n❌ Missing GOOGLE_AI_API_KEY in .env.local')
  process.exit(1)
}

const genAI = new GoogleGenerativeAI(apiKey)

try {
  // Use a simple text model to test the connection
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent('Say "Hello FridgeMind!" in exactly 3 words.')
  const response = await result.response
  const text = response.text()

  console.log('\n✅ Gemini connection successful!')
  console.log('Response:', text.trim())
} catch (err) {
  console.log('\n❌ Error:', err.message)
  if (err.message.includes('API key')) {
    console.log('Hint: Your API key might be invalid or not enabled for Gemini.')
    console.log('Get a key from: https://aistudio.google.com/app/apikey')
  }
}
