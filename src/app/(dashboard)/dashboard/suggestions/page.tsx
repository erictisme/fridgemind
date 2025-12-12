'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface MealSuggestion {
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

const DIFFICULTY_BADGES: Record<string, { label: string; color: string }> = {
  easy: { label: 'Easy', color: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  hard: { label: 'Hard', color: 'bg-red-100 text-red-700' },
}

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [inventoryCount, setInventoryCount] = useState(0)

  useEffect(() => {
    fetchSuggestions()
  }, [])

  const fetchSuggestions = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const response = await fetch('/api/suggestions')
      if (!response.ok) {
        throw new Error('Failed to fetch suggestions')
      }

      const data = await response.json()
      setSuggestions(data.suggestions || [])
      setInventoryCount(data.inventory_count || 0)
    } catch (err) {
      console.error('Suggestions error:', err)
      setError('Failed to load meal suggestions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

  return (
    <div className="max-w-2xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
            &larr; Home
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">What to Cook</h1>
          <p className="text-gray-500">AI meal ideas from your inventory</p>
        </div>
        <button
          onClick={() => fetchSuggestions(true)}
          disabled={refreshing || loading}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
          title="Refresh suggestions"
        >
          <svg
            className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-16">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-900">Generating meal ideas...</p>
          <p className="text-gray-500">Looking at your inventory and expiring items</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && inventoryCount === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🍳</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No items in inventory</h2>
          <p className="text-gray-500 mb-6">Scan your kitchen first to get personalized meal suggestions</p>
          <Link
            href="/dashboard/scan"
            className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Scan Your Kitchen
          </Link>
        </div>
      )}

      {/* Suggestions list */}
      {!loading && suggestions.length > 0 && (
        <div className="space-y-4">
          {/* Priority notice */}
          {suggestions.some(s => s.expiring_items_used.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-medium text-amber-800">Use expiring items first</p>
                <p className="text-sm text-amber-700">These suggestions prioritize ingredients that need to be used soon</p>
              </div>
            </div>
          )}

          {suggestions.map((suggestion, index) => {
            const isExpanded = expandedIndex === index
            const difficulty = DIFFICULTY_BADGES[suggestion.difficulty] || DIFFICULTY_BADGES.medium
            const hasExpiringItems = suggestion.expiring_items_used.length > 0

            return (
              <div
                key={index}
                className={`bg-white rounded-2xl border ${hasExpiringItems ? 'border-amber-300' : 'border-gray-200'} overflow-hidden`}
              >
                {/* Card header */}
                <button
                  onClick={() => toggleExpand(index)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {hasExpiringItems && (
                          <span className="text-amber-500 text-sm">🔥</span>
                        )}
                        <h3 className="font-semibold text-gray-900">{suggestion.name}</h3>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{suggestion.description}</p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-3 mt-3 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${difficulty.color}`}>
                      {difficulty.label}
                    </span>
                    <span className="text-gray-500 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {suggestion.estimated_time_minutes} min
                    </span>
                    {suggestion.additional_ingredients_needed.length === 0 && (
                      <span className="text-emerald-600 font-medium">✓ Have all ingredients</span>
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                    {/* Recipe summary */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Recipe</h4>
                      <p className="text-sm text-gray-600 whitespace-pre-line">{suggestion.recipe_summary}</p>
                    </div>

                    {/* Expiring items used */}
                    {hasExpiringItems && (
                      <div className="bg-amber-50 rounded-xl p-3">
                        <h4 className="font-medium text-amber-800 mb-1 text-sm">Uses expiring items:</h4>
                        <div className="flex flex-wrap gap-1">
                          {suggestion.expiring_items_used.map((item, i) => (
                            <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ingredients from inventory */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2 text-sm">From your kitchen:</h4>
                      <div className="flex flex-wrap gap-1">
                        {suggestion.ingredients_from_inventory.map((item, i) => (
                          <span key={i} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Additional ingredients needed */}
                    {suggestion.additional_ingredients_needed.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2 text-sm">You'll also need:</h4>
                        <div className="flex flex-wrap gap-1">
                          {suggestion.additional_ingredients_needed.map((item, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* No suggestions but has inventory */}
      {!loading && suggestions.length === 0 && inventoryCount > 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🤔</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No suggestions available</h2>
          <p className="text-gray-500 mb-6">Try refreshing or adding more items to your inventory</p>
          <button
            onClick={() => fetchSuggestions(true)}
            className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
