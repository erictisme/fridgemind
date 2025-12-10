import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If user is logged in, redirect to dashboard
  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-emerald-600">FridgeMind</h1>
          <div className="space-x-4">
            <Link
              href="/login"
              className="text-gray-600 hover:text-emerald-600 font-medium"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center">
          <h2 className="text-4xl sm:text-6xl font-bold text-gray-900 leading-tight">
            Take photos.
            <br />
            <span className="text-emerald-600">Get clarity.</span>
            <br />
            Eat smart.
          </h2>
          <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
            FridgeMind uses AI to track your food inventory, predict what you need,
            and eliminate the mental load of grocery planning.
          </p>
          <div className="mt-10">
            <Link
              href="/signup"
              className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-emerald-600 rounded-full hover:bg-emerald-700 transition-colors shadow-lg hover:shadow-xl"
            >
              Start for free
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            title="Photo-Based Inventory"
            description="Just take a photo of your fridge. Our AI identifies everything and tracks expiry dates automatically."
          />
          <FeatureCard
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            title="Smart Predictions"
            description="FridgeMind learns your eating patterns and predicts when you'll need to restock before you run out."
          />
          <FeatureCard
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
            title="Auto Shopping Lists"
            description="Tell us your meals for the week, and we'll generate a perfect shopping list based on what you already have."
          />
        </div>

        {/* How it works */}
        <div className="mt-24">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-12">
            How it works
          </h3>
          <div className="grid md:grid-cols-4 gap-8">
            <Step number={1} title="Take Photos" description="Snap your fridge, freezer, and pantry" />
            <Step number={2} title="AI Detection" description="We identify all items and their freshness" />
            <Step number={3} title="Plan Meals" description="Tell us how many meals you'll eat at home" />
            <Step number={4} title="Shop Smart" description="Get a precise list of what you need" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-24 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500">
          <p>Built with AI to reduce food waste and mental load.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

function Step({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-4">
        {number}
      </div>
      <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}
