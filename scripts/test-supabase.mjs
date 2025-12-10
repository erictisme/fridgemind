// Test script to verify Supabase connection
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load .env.local
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Testing Supabase connection...\n')
console.log('URL:', supabaseUrl ? '✅ Found' : '❌ Missing')
console.log('Anon Key:', supabaseAnonKey ? '✅ Found' : '❌ Missing')

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('\n❌ Missing environment variables. Check your .env.local file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

try {
  // Test basic connection by checking auth service
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    console.log('\n❌ Connection failed:', error.message)
  } else {
    console.log('\n✅ Supabase connection successful!')
    console.log('Session:', data.session ? 'Active session found' : 'No active session (expected)')
  }
} catch (err) {
  console.log('\n❌ Error:', err.message)
}
