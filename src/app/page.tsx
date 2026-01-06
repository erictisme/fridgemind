import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-sm z-50 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-emerald-600">FridgeMind</h1>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-gray-600 hover:text-emerald-600 text-sm font-medium">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-24 pb-16 px-4 bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            AI-powered food management
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-6">
            Know what&apos;s in your kitchen.
            <br />
            <span className="text-emerald-600">Cook with confidence.</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Scan your fridge, get recipe ideas, track nutrition, and never waste food again.
            FridgeMind handles the mental load so you can focus on cooking.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg hover:shadow-xl"
            >
              Start for free
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              See features
            </a>
          </div>
        </div>
      </section>

      {/* Main Features */}
      <section id="features" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Everything you need to manage food at home
            </h3>
            <p className="text-gray-600 max-w-xl mx-auto">
              From scanning your fridge to planning meals and tracking what you eat
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              emoji="📸"
              title="Scan your kitchen"
              description="Take a photo of your fridge, freezer, or pantry. AI identifies every item, estimates expiry dates, and tracks quantities."
              highlight={true}
            />
            <FeatureCard
              emoji="🥘"
              title="Get recipe ideas"
              description="Enter what you want to cook with. Get AI-generated recipes using your ingredients, or search real recipes online."
            />
            <FeatureCard
              emoji="📅"
              title="Plan your week"
              description="Drag recipes into a weekly meal planner. Check what ingredients you're missing with one click."
            />
            <FeatureCard
              emoji="🛒"
              title="Smart shopping list"
              description="Auto-generate lists from your meal plan. Check off items while shopping and get alternative suggestions."
            />
            <FeatureCard
              emoji="🍽️"
              title="Track nutrition"
              description="Log meals by photo or description. See daily, weekly, and monthly nutrition summaries with insights."
            />
            <FeatureCard
              emoji="🧾"
              title="Receipt scanning"
              description="Snap your grocery receipts. Auto-import items to inventory and track spending over time."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12">
            How it works
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <Step
              number={1}
              title="Add your food"
              description="Scan your fridge with a photo, import from receipts, or add items manually"
            />
            <Step
              number={2}
              title="Get inspired"
              description="See what's expiring soon and get recipe suggestions based on what you have"
            />
            <Step
              number={3}
              title="Plan & shop"
              description="Add recipes to your meal plan and generate a shopping list for missing items"
            />
            <Step
              number={4}
              title="Cook & track"
              description="Mark items as used, log your meals, and track your nutrition over time"
            />
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <BenefitCard
              icon="🗑️"
              title="Reduce food waste"
              description="Know what's expiring and use it before it goes bad. Get alerts for items that need attention."
            />
            <BenefitCard
              icon="🧠"
              title="Less mental load"
              description="Stop wondering what to cook or what to buy. Let AI handle the planning."
            />
            <BenefitCard
              icon="💰"
              title="Save money"
              description="Track grocery spending, avoid duplicate purchases, and use what you already have."
            />
          </div>
        </div>
      </section>

      {/* Feature Details */}
      <section className="py-16 px-4 bg-gradient-to-b from-white to-emerald-50">
        <div className="max-w-5xl mx-auto">
          <div className="space-y-16">
            <FeatureDetail
              title="AI that understands food"
              description="Take a photo of anything - your fridge, a meal, ingredients on your counter, or a recipe from a cookbook. FridgeMind's AI identifies items, estimates nutrition, and extracts recipes automatically."
              features={[
                "Photo-based inventory scanning",
                "Meal nutrition estimation from photos",
                "Recipe extraction from cookbook pages",
                "Ingredient detection for recipe search"
              ]}
              align="left"
            />
            <FeatureDetail
              title="Recipes from anywhere"
              description="Save recipes from any website, YouTube, Instagram, or just paste the text. Search for real recipes online or let AI generate ideas based on your ingredients."
              features={[
                "Import from URLs (websites, YouTube, Instagram)",
                "Snap cookbook pages to extract recipes",
                "Search recipes from trusted sites",
                "AI-generated meal ideas from your inventory"
              ]}
              align="right"
            />
            <FeatureDetail
              title="Track what matters"
              description="Log meals, track nutrition, monitor spending, and see insights about your eating habits. Get red flags for unhealthy patterns and recommendations for improvement."
              features={[
                "Daily, weekly, monthly nutrition summaries",
                "Spending analytics by store and category",
                "Food waste tracking",
                "Health insights and red flag alerts"
              ]}
              align="left"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            Ready to simplify your kitchen?
          </h3>
          <p className="text-gray-600 mb-8">
            Join and start managing your food the smart way. It&apos;s free to use.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg hover:shadow-xl"
          >
            Get started free
            <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-gray-500 text-sm">
            Built with AI to reduce food waste and mental load.
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <span>Made in Singapore</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  emoji,
  title,
  description,
  highlight = false,
}: {
  emoji: string
  title: string
  description: string
  highlight?: boolean
}) {
  return (
    <div className={`p-6 rounded-2xl border ${highlight ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}>
      <span className="text-3xl mb-4 block">{emoji}</span>
      <h4 className="text-lg font-semibold text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
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
      <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h4 className="font-semibold text-gray-900 mb-2">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="text-center p-6">
      <span className="text-4xl mb-4 block">{icon}</span>
      <h4 className="text-lg font-semibold text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  )
}

function FeatureDetail({
  title,
  description,
  features,
  align,
}: {
  title: string
  description: string
  features: string[]
  align: 'left' | 'right'
}) {
  return (
    <div className={`flex flex-col ${align === 'right' ? 'md:flex-row-reverse' : 'md:flex-row'} gap-8 items-center`}>
      <div className="flex-1">
        <h4 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">{title}</h4>
        <p className="text-gray-600 mb-4">{description}</p>
        <ul className="space-y-2">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1 w-full">
        <div className={`aspect-video rounded-2xl ${align === 'left' ? 'bg-gradient-to-br from-emerald-100 to-teal-100' : 'bg-gradient-to-br from-purple-100 to-pink-100'} flex items-center justify-center`}>
          <span className="text-6xl opacity-50">
            {align === 'left' ? '📸' : align === 'right' ? '📖' : '📊'}
          </span>
        </div>
      </div>
    </div>
  )
}
