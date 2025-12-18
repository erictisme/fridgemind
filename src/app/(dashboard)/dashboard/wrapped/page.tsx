'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface WrappedData {
  year: number
  stats: {
    totalMealsCooked: number
    totalEatingOut: number
    totalHoursCooked: number
    avgCookingTime: number
    homeCookedRatio: number
    totalRecipesSaved: number
    topRecipes: Array<{ name: string; times: number; cuisine: string | null }>
    topCuisines: Array<{ cuisine: string; count: number }>
    topIngredients: Array<{ ingredient: string; count: number }>
    topMethods: Array<{ method: string; count: number }>
    topTags: Array<{ tag: string; count: number }>
    favorites: string[]
    uniqueCuisineCount: number
    // Receipt-based stats
    groceryTrips: number
    totalSpent: number
    avgPerTrip: number
    topPurchasedItems: Array<{ name: string; count: number; spent: number }>
    topCategories: Array<{ category: string; spent: number }>
    topStores: Array<{ store: string; visits: number; spent: number }>
    uniqueItemsPurchased: number
    totalItemsPurchased: number
  }
  insights: {
    foodPersonality: {
      title: string
      description: string
    }
    tastePalette: {
      primary: string
      secondary: string
      description: string
    }
    cookingStyle: {
      type: string
      description: string
    }
    signatureMoment: string
    hiddenTalent: string
    growth2026: {
      challenge: string
      newCuisine: string
      skillToLearn: string
      ingredientToTry: string
    }
    funFacts: string[]
  }
}

const CARD_GRADIENTS = [
  'from-purple-600 via-pink-500 to-orange-400',
  'from-emerald-500 via-teal-500 to-cyan-500',
  'from-blue-600 via-indigo-500 to-purple-500',
  'from-orange-500 via-red-500 to-pink-500',
  'from-green-500 via-emerald-500 to-teal-500',
  'from-yellow-400 via-orange-500 to-red-500',
  'from-pink-500 via-purple-500 to-indigo-500',
  'from-cyan-500 via-blue-500 to-indigo-500',
]

export default function CookingWrappedPage() {
  const [data, setData] = useState<WrappedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentCard, setCurrentCard] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    fetchWrappedData()
  }, [])

  const fetchWrappedData = async () => {
    try {
      const response = await fetch('/api/cooking-wrapped')
      if (!response.ok) throw new Error('Failed to load')
      const result = await response.json()
      setData(result)
    } catch {
      setError('Failed to generate your Cooking Wrapped')
    } finally {
      setLoading(false)
    }
  }

  const nextCard = () => {
    if (isAnimating) return
    setIsAnimating(true)
    setTimeout(() => {
      setCurrentCard(c => Math.min(c + 1, cards.length - 1))
      setIsAnimating(false)
    }, 300)
  }

  const prevCard = () => {
    if (isAnimating) return
    setIsAnimating(true)
    setTimeout(() => {
      setCurrentCard(c => Math.max(c - 1, 0))
      setIsAnimating(false)
    }, 300)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-black">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/80 text-lg">Analyzing your cooking journey...</p>
          <p className="text-white/50 text-sm mt-2">This may take a moment</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-black">
        <div className="text-center">
          <span className="text-6xl mb-4 block">🍳</span>
          <h1 className="text-2xl font-bold text-white mb-2">Oops!</h1>
          <p className="text-white/70 mb-4">{error || 'Something went wrong'}</p>
          <Link
            href="/dashboard"
            className="text-purple-300 hover:text-purple-200"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Check if user has enough data (including grocery trips from receipts)
  const hasEnoughData = data.stats.totalMealsCooked > 0 || data.stats.totalRecipesSaved > 2 || data.stats.groceryTrips > 0

  if (!hasEnoughData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-black p-6">
        <div className="text-center max-w-md">
          <span className="text-8xl mb-6 block">👨‍🍳</span>
          <h1 className="text-3xl font-bold text-white mb-4">Your Cooking Journey Awaits!</h1>
          <p className="text-white/70 mb-6 text-lg">
            Start cooking with FridgeMind to unlock your personalized Cooking Wrapped!
          </p>
          <div className="bg-white/10 rounded-2xl p-6 mb-6 text-left space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📚</span>
              <div>
                <p className="text-white font-medium">Save some recipes</p>
                <p className="text-white/60 text-sm">Build your recipe collection</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🍳</span>
              <div>
                <p className="text-white font-medium">Cook & track meals</p>
                <p className="text-white/60 text-sm">Click &quot;I Made This&quot; when you cook</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎁</span>
              <div>
                <p className="text-white font-medium">Come back for insights</p>
                <p className="text-white/60 text-sm">See your food personality & stats</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <Link
              href="/dashboard/inspire"
              className="block w-full py-3 bg-white text-purple-600 rounded-xl font-bold hover:bg-white/90"
            >
              Start Adding Recipes
            </Link>
            <Link
              href="/dashboard"
              className="block w-full py-3 bg-white/20 text-white rounded-xl font-medium hover:bg-white/30"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Build cards array
  const cards = [
    // Card 1: Welcome / Total meals
    {
      gradient: CARD_GRADIENTS[0],
      content: (
        <div className="text-center">
          <p className="text-white/70 text-lg mb-2">Your</p>
          <h1 className="text-5xl font-black text-white mb-2">Cooking Wrapped</h1>
          <p className="text-white/70 text-xl mb-8">2025</p>
          <div className="mt-8">
            <p className="text-white/80 text-lg">This year, you cooked</p>
            <p className="text-7xl font-black text-white my-4">{data.stats.totalMealsCooked}</p>
            <p className="text-white/80 text-xl">meals at home</p>
          </div>
        </div>
      ),
    },
    // Card 2: Time spent cooking
    {
      gradient: CARD_GRADIENTS[1],
      content: (
        <div className="text-center">
          <p className="text-white/70 text-lg mb-4">You spent</p>
          <p className="text-8xl font-black text-white mb-2">{data.stats.totalHoursCooked}</p>
          <p className="text-white/80 text-2xl mb-6">hours in the kitchen</p>
          <div className="bg-white/10 rounded-2xl p-4 mt-4">
            <p className="text-white/70">That&apos;s about</p>
            <p className="text-2xl font-bold text-white">
              {Math.round(data.stats.totalHoursCooked / 52)} hours per week
            </p>
            <p className="text-white/70">of culinary creativity!</p>
          </div>
        </div>
      ),
    },
    // Card 3: Grocery Shopping Overview
    {
      gradient: CARD_GRADIENTS[4],
      content: (
        <div className="text-center">
          <p className="text-white/70 text-lg mb-4">This year you made</p>
          <p className="text-8xl font-black text-white mb-2">{data.stats.groceryTrips}</p>
          <p className="text-white/80 text-2xl mb-6">grocery trips</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/10 rounded-2xl p-4">
              <p className="text-3xl font-bold text-white">${data.stats.totalSpent.toFixed(0)}</p>
              <p className="text-white/60 text-sm">total spent</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4">
              <p className="text-3xl font-bold text-white">${data.stats.avgPerTrip.toFixed(0)}</p>
              <p className="text-white/60 text-sm">avg per trip</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-4 mt-3">
            <p className="text-2xl font-bold text-white">{data.stats.uniqueItemsPurchased}</p>
            <p className="text-white/60 text-sm">unique items bought</p>
          </div>
        </div>
      ),
    },
    // Card 4: Top Purchases
    {
      gradient: CARD_GRADIENTS[5],
      content: (
        <div>
          <p className="text-white/70 text-lg mb-4 text-center">Your most purchased items</p>
          <div className="space-y-2">
            {data.stats.topPurchasedItems.slice(0, 8).map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2 ${
                  i === 0 ? 'bg-white/20 scale-105' : ''
                }`}
              >
                <span className="text-2xl font-black text-white/50 w-8">#{i + 1}</span>
                <div className="flex-1">
                  <p className="text-white font-medium capitalize">{item.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-white">{item.count}x</p>
                  <p className="text-white/50 text-xs">${item.spent.toFixed(0)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    // Card 5: Favorite Stores
    {
      gradient: CARD_GRADIENTS[6],
      content: (
        <div className="text-center">
          <p className="text-white/70 text-lg mb-6">Your favorite stores</p>
          <div className="space-y-3">
            {data.stats.topStores.slice(0, 4).map((store, i) => (
              <div
                key={i}
                className={`bg-white/10 rounded-xl p-4 ${i === 0 ? 'bg-white/20 border-2 border-white/30' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className={`text-white font-bold ${i === 0 ? 'text-xl' : 'text-lg'}`}>{store.store}</p>
                    <p className="text-white/60 text-sm">{store.visits} visits</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">${store.spent.toFixed(0)}</p>
                    <p className="text-white/50 text-xs">spent</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {data.stats.topStores[0] && (
            <p className="text-white/60 text-sm mt-4">
              {data.stats.topStores[0].store} is your go-to spot!
            </p>
          )}
        </div>
      ),
    },
    // Card 6: Food Personality
    {
      gradient: CARD_GRADIENTS[2],
      content: (
        <div className="text-center">
          <p className="text-white/70 text-lg mb-2">Your food personality is</p>
          <h2 className="text-4xl font-black text-white mb-6 leading-tight">
            {data.insights.foodPersonality.title}
          </h2>
          <div className="bg-white/10 rounded-2xl p-5">
            <p className="text-white/90 text-lg leading-relaxed">
              {data.insights.foodPersonality.description}
            </p>
          </div>
        </div>
      ),
    },
    // Card 4: Top Recipes
    {
      gradient: CARD_GRADIENTS[3],
      content: (
        <div>
          <p className="text-white/70 text-lg mb-4 text-center">Your most cooked recipes</p>
          <div className="space-y-3">
            {data.stats.topRecipes.slice(0, 5).map((recipe, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 bg-white/10 rounded-xl p-3 ${
                  i === 0 ? 'bg-white/20 scale-105' : ''
                }`}
              >
                <span className="text-3xl font-black text-white/50 w-10">#{i + 1}</span>
                <div className="flex-1">
                  <p className="text-white font-bold text-lg">{recipe.name}</p>
                  <p className="text-white/60 text-sm">{recipe.cuisine || 'Homestyle'}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-white">{recipe.times}x</p>
                </div>
              </div>
            ))}
          </div>
          {data.stats.topRecipes[0] && (
            <p className="text-center text-white/70 mt-4 text-sm">
              {data.stats.topRecipes[0].name} is clearly a household favorite!
            </p>
          )}
        </div>
      ),
    },
    // Card 5: Taste Palette
    {
      gradient: CARD_GRADIENTS[4],
      content: (
        <div className="text-center">
          <p className="text-white/70 text-lg mb-4">Your taste palette</p>
          <div className="space-y-4 mb-6">
            <div className="bg-white/20 rounded-2xl p-4">
              <p className="text-white/60 text-sm">Primary</p>
              <p className="text-2xl font-bold text-white">{data.insights.tastePalette.primary}</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4">
              <p className="text-white/60 text-sm">Secondary</p>
              <p className="text-xl font-bold text-white">{data.insights.tastePalette.secondary}</p>
            </div>
          </div>
          <p className="text-white/80 text-sm leading-relaxed">
            {data.insights.tastePalette.description}
          </p>
        </div>
      ),
    },
    // Card 6: Top Ingredients
    {
      gradient: CARD_GRADIENTS[5],
      content: (
        <div>
          <p className="text-white/70 text-lg mb-4 text-center">Your kitchen staples</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {data.stats.topIngredients.slice(0, 10).map((ing, i) => (
              <div
                key={i}
                className={`bg-white/10 rounded-full px-4 py-2 ${
                  i < 3 ? 'bg-white/20 text-lg font-bold' : 'text-sm'
                }`}
              >
                <span className="text-white">{ing.ingredient}</span>
                <span className="text-white/50 ml-1">×{ing.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <p className="text-white/80">{data.insights.signatureMoment}</p>
          </div>
        </div>
      ),
    },
    // Card 7: Cuisines Explored
    {
      gradient: CARD_GRADIENTS[6],
      content: (
        <div className="text-center">
          <p className="text-white/70 text-lg mb-2">You explored</p>
          <p className="text-6xl font-black text-white mb-2">{data.stats.uniqueCuisineCount}</p>
          <p className="text-white/80 text-xl mb-6">different cuisines</p>
          <div className="space-y-2">
            {data.stats.topCuisines.slice(0, 4).map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="h-3 rounded-full bg-white"
                  style={{ width: `${Math.min(100, (c.count / (data.stats.topCuisines[0]?.count || 1)) * 100)}%` }}
                ></div>
                <span className="text-white text-sm whitespace-nowrap">{c.cuisine}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    // Card 8: Cooking Style
    {
      gradient: CARD_GRADIENTS[7],
      content: (
        <div className="text-center">
          <p className="text-white/70 text-lg mb-2">Your cooking style</p>
          <h2 className="text-3xl font-black text-white mb-4">{data.insights.cookingStyle.type}</h2>
          <p className="text-white/80 text-lg mb-6">{data.insights.cookingStyle.description}</p>
          <div className="bg-white/10 rounded-2xl p-4">
            <p className="text-white/70 text-sm">Hidden talent:</p>
            <p className="text-white font-medium">{data.insights.hiddenTalent}</p>
          </div>
        </div>
      ),
    },
    // Card 9: Home vs Out ratio
    {
      gradient: CARD_GRADIENTS[0],
      content: (
        <div className="text-center">
          <p className="text-white/70 text-lg mb-4">Your eating habits</p>
          <div className="relative w-48 h-48 mx-auto mb-6">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="80"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="16"
                fill="none"
              />
              <circle
                cx="96"
                cy="96"
                r="80"
                stroke="white"
                strokeWidth="16"
                fill="none"
                strokeDasharray={`${(data.stats.homeCookedRatio / 100) * 502} 502`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div>
                <p className="text-4xl font-black text-white">{data.stats.homeCookedRatio}%</p>
                <p className="text-white/70 text-sm">home cooked</p>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 text-sm">
            <div>
              <p className="text-white font-bold">{data.stats.totalMealsCooked}</p>
              <p className="text-white/60">cooked</p>
            </div>
            <div>
              <p className="text-white font-bold">{data.stats.totalEatingOut}</p>
              <p className="text-white/60">ate out</p>
            </div>
          </div>
        </div>
      ),
    },
    // Card 10: Growth 2026
    {
      gradient: CARD_GRADIENTS[1],
      content: (
        <div>
          <p className="text-white/70 text-lg mb-4 text-center">Your 2026 Growth Plan</p>
          <div className="space-y-3">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-xs uppercase tracking-wide">Challenge</p>
              <p className="text-white font-medium">{data.insights.growth2026.challenge}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-xs uppercase tracking-wide">New Cuisine to Try</p>
              <p className="text-white font-medium">{data.insights.growth2026.newCuisine}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-xs uppercase tracking-wide">Skill to Master</p>
              <p className="text-white font-medium">{data.insights.growth2026.skillToLearn}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-xs uppercase tracking-wide">Ingredient to Explore</p>
              <p className="text-white font-medium">{data.insights.growth2026.ingredientToTry}</p>
            </div>
          </div>
        </div>
      ),
    },
    // Card 11: Fun Facts
    {
      gradient: CARD_GRADIENTS[2],
      content: (
        <div className="text-center">
          <p className="text-white/70 text-lg mb-6">Fun facts about your cooking</p>
          <div className="space-y-4">
            {data.insights.funFacts.map((fact, i) => (
              <div key={i} className="bg-white/10 rounded-xl p-4">
                <p className="text-white text-lg">{fact}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    // Card 12: Closing
    {
      gradient: CARD_GRADIENTS[3],
      content: (
        <div className="text-center">
          <p className="text-6xl mb-6">👨‍🍳👩‍🍳</p>
          <h2 className="text-3xl font-black text-white mb-4">
            Here&apos;s to more delicious meals in 2026!
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Keep cooking, keep exploring, keep growing.
          </p>
          <div className="space-y-3">
            <Link
              href="/dashboard/inspire"
              className="block w-full py-3 bg-white text-purple-600 rounded-xl font-bold hover:bg-white/90"
            >
              Find New Recipes
            </Link>
            <Link
              href="/dashboard"
              className="block w-full py-3 bg-white/20 text-white rounded-xl font-medium hover:bg-white/30"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-black">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/20 z-50">
        <div
          className="h-full bg-white transition-all duration-300"
          style={{ width: `${((currentCard + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* Back button */}
      <Link
        href="/dashboard"
        className="fixed top-4 left-4 z-50 text-white/70 hover:text-white text-sm flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Exit
      </Link>

      {/* Card indicator */}
      <div className="fixed top-4 right-4 z-50 text-white/70 text-sm">
        {currentCard + 1} / {cards.length}
      </div>

      {/* Card container */}
      <div
        className={`min-h-screen flex items-center justify-center p-6 bg-gradient-to-br ${cards[currentCard].gradient} transition-all duration-500 ${
          isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
        onClick={nextCard}
      >
        <div className="max-w-md w-full">
          {cards[currentCard].content}
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center gap-4 z-50">
        <button
          onClick={(e) => { e.stopPropagation(); prevCard() }}
          disabled={currentCard === 0}
          className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center disabled:opacity-30 hover:bg-white/30"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); nextCard() }}
          disabled={currentCard === cards.length - 1}
          className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center disabled:opacity-30 hover:bg-white/30"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Tap hint */}
      {currentCard === 0 && (
        <div className="fixed bottom-24 left-0 right-0 text-center">
          <p className="text-white/50 text-sm animate-pulse">Tap anywhere to continue</p>
        </div>
      )}
    </div>
  )
}
