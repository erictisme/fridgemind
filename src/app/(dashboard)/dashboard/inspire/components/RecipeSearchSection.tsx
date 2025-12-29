'use client'

import { useState, useRef, useCallback } from 'react'
import RecipeSearchCard from './RecipeSearchCard'

export interface RecipeSearchResult {
  name: string
  description: string
  source_url: string
  source_type: 'website' | 'youtube' | 'blog'
  source_name: string
  image_url?: string
  estimated_time_minutes?: number
  ingredients_preview: string[]
  confidence_score: number
}

interface RecipeSearchSectionProps {
  onSaveRecipe: (result: RecipeSearchResult) => Promise<void>
}

const QUICK_SEARCHES = [
  'chicken dinner',
  'quick pasta',
  'healthy lunch',
  'easy soup',
  'vegetarian',
]

export default function RecipeSearchSection({ onSaveRecipe }: RecipeSearchSectionProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RecipeSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingUrl, setSavingUrl] = useState<string | null>(null)
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set())
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/recipes/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 6 }),
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setResults(data.results || [])

      if (data.results?.length === 0) {
        setError('No recipes found. Try different keywords!')
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('Failed to search. Please try again.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Debounce search - wait for user to stop typing
    if (value.length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(value)
      }, 800)
    } else {
      setResults([])
      setError(null)
    }
  }

  const handleQuickSearch = (term: string) => {
    setQuery(term)
    handleSearch(term)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    handleSearch(query)
  }

  const handleSave = async (result: RecipeSearchResult) => {
    setSavingUrl(result.source_url)
    try {
      await onSaveRecipe(result)
      setSavedUrls(prev => new Set(prev).add(result.source_url))
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSavingUrl(null)
    }
  }

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200 p-4 sm:p-6 mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">🔍</span>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Find Recipes</h2>
          <p className="text-sm text-gray-500">Search real recipes from across the web</p>
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="What do you want to cook?"
            className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-indigo-200 focus:border-indigo-400 focus:outline-none text-gray-900 placeholder-gray-400 bg-white"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {/* Quick Search Chips */}
      {results.length === 0 && !loading && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-gray-500">Quick:</span>
          {QUICK_SEARCHES.map(term => (
            <button
              key={term}
              onClick={() => handleQuickSearch(term)}
              className="px-3 py-1 text-sm bg-white rounded-full border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
            >
              {term}
            </button>
          ))}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-shrink-0 w-64 animate-pulse">
              <div className="bg-white rounded-xl overflow-hidden border border-gray-200">
                <div className="h-36 bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-8 bg-gray-200 rounded mt-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-6">
          <p className="text-gray-500">{error}</p>
        </div>
      )}

      {/* Results Carousel */}
      {results.length > 0 && !loading && (
        <div>
          <p className="text-sm text-gray-500 mb-3">{results.length} recipes found</p>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory">
            {results.map((result, index) => (
              <RecipeSearchCard
                key={`${result.source_url}-${index}`}
                result={result}
                onSave={() => handleSave(result)}
                isSaving={savingUrl === result.source_url}
                isSaved={savedUrls.has(result.source_url)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
