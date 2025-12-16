'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface RecipeIngredient {
  name: string
  quantity?: string | number
  unit?: string
  optional?: boolean
}

interface SavedRecipe {
  id: string
  name: string
  description: string | null
  source_type: string
  source_url: string | null
  source_account: string | null
  image_url: string | null
  ingredients: RecipeIngredient[]
  instructions: string | null
  estimated_time_minutes: number | null
  servings: number
  cuisine_type: string | null
  tags: string[]
  is_favorite: boolean
  times_cooked: number
  created_at: string
}

interface ParsedRecipe {
  is_recipe: boolean
  name: string
  description: string | null
  ingredients: RecipeIngredient[]
  instructions: string | null
  estimated_time_minutes: number | null
  servings: number | null
  cuisine_type: string | null
  tags: string[]
  confidence: number
}

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

type TabType = 'cook' | 'saved'
type InputMode = 'none' | 'url' | 'text'

const DIFFICULTY_BADGES: Record<string, { label: string; color: string }> = {
  easy: { label: 'Easy', color: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  hard: { label: 'Hard', color: 'bg-red-100 text-red-700' },
}

export default function InspirePage() {
  const [activeTab, setActiveTab] = useState<TabType>('cook')
  const [recipes, setRecipes] = useState<SavedRecipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cook tab state
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null)
  const [inventoryCount, setInventoryCount] = useState(0)
  const [challengeMode, setChallengeMode] = useState(false)
  const [addingToList, setAddingToList] = useState<number | null>(null)
  const [addedSuccess, setAddedSuccess] = useState<number | null>(null)

  // Input state
  const [inputMode, setInputMode] = useState<InputMode>('none')
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [parsing, setParsing] = useState(false)

  // Preview state
  const [previewRecipe, setPreviewRecipe] = useState<ParsedRecipe | null>(null)
  const [previewSource, setPreviewSource] = useState<{
    url?: string
    author?: string
    image_url?: string
  } | null>(null)

  useEffect(() => {
    if (activeTab === 'saved') {
      fetchRecipes()
    } else {
      fetchSuggestions()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const fetchRecipes = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/recipes')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setRecipes(data.recipes || [])
    } catch {
      setError('Failed to load recipes')
    } finally {
      setLoading(false)
    }
  }

  const fetchSuggestions = async (isRefresh = false, challenge = challengeMode) => {
    if (isRefresh) {
      setSuggestionsLoading(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const url = challenge ? '/api/suggestions?challenge=true' : '/api/suggestions'
      const response = await fetch(url)
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
      setSuggestionsLoading(false)
    }
  }

  const toggleChallengeMode = () => {
    const newMode = !challengeMode
    setChallengeMode(newMode)
    fetchSuggestions(true, newMode)
  }

  const handleAddToShoppingList = async (index: number, ingredients: string[]) => {
    if (ingredients.length === 0) return

    setAddingToList(index)
    setAddedSuccess(null)

    try {
      for (const ingredient of ingredients) {
        await fetch('/api/shopping-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: ingredient,
            quantity: 1,
            source: 'suggestion',
          }),
        })
      }

      setAddedSuccess(index)
      setTimeout(() => setAddedSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to add to shopping list:', err)
      setError('Failed to add items to shopping list')
    } finally {
      setAddingToList(null)
    }
  }

  const handleParseUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return

    setParsing(true)
    setError(null)
    setPreviewRecipe(null)

    try {
      const response = await fetch('/api/recipes/parse-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.suggestion || 'Failed to parse URL')
      }

      if (!data.is_recipe) {
        setError('This post does not appear to contain a recipe. Try pasting the text directly instead.')
        return
      }

      setPreviewRecipe(data.parsed)
      setPreviewSource(data.source)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse URL')
    } finally {
      setParsing(false)
    }
  }

  const handleParseText = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!textInput.trim()) return

    setParsing(true)
    setError(null)
    setPreviewRecipe(null)

    try {
      const response = await fetch('/api/recipes/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textInput.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse recipe')
      }

      if (!data.is_recipe) {
        setError('This text does not appear to be a recipe.')
        return
      }

      setPreviewRecipe(data.parsed)
      setPreviewSource(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse recipe')
    } finally {
      setParsing(false)
    }
  }

  const handleSaveRecipe = async () => {
    if (!previewRecipe) return

    setParsing(true)
    setError(null)

    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: previewRecipe.name,
          description: previewRecipe.description,
          source_type: previewSource?.url ? 'instagram' : 'manual',
          source_url: previewSource?.url,
          source_account: previewSource?.author,
          image_url: previewSource?.image_url,
          ingredients: previewRecipe.ingredients,
          instructions: previewRecipe.instructions,
          estimated_time_minutes: previewRecipe.estimated_time_minutes,
          servings: previewRecipe.servings,
          cuisine_type: previewRecipe.cuisine_type,
          tags: previewRecipe.tags,
        }),
      })

      if (!response.ok) throw new Error('Failed to save recipe')

      // Reset and refresh
      setPreviewRecipe(null)
      setPreviewSource(null)
      setInputMode('none')
      setUrlInput('')
      setTextInput('')
      await fetchRecipes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe')
    } finally {
      setParsing(false)
    }
  }

  const handleToggleFavorite = async (recipe: SavedRecipe) => {
    try {
      await fetch('/api/recipes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: recipe.id,
          is_favorite: !recipe.is_favorite,
        }),
      })

      setRecipes(recipes.map(r =>
        r.id === recipe.id ? { ...r, is_favorite: !r.is_favorite } : r
      ))
    } catch {
      setError('Failed to update recipe')
    }
  }

  const handleDeleteRecipe = async (id: string) => {
    if (!confirm('Delete this recipe?')) return

    try {
      await fetch('/api/recipes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      setRecipes(recipes.filter(r => r.id !== id))
    } catch {
      setError('Failed to delete recipe')
    }
  }

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'instagram': return '📸'
      case 'manual': return '✍️'
      case 'ai_suggestion': return '🤖'
      default: return '🔗'
    }
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Home
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Inspire</h1>
        <p className="text-gray-500">Get meal ideas or save recipes for later</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('cook')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'cook'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          What to Cook
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'saved'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Saved Recipes {recipes.length > 0 && `(${recipes.length})`}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl flex justify-between items-start">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 ml-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* COOK TAB */}
      {activeTab === 'cook' && (
        <>
          {/* Cook Header Actions */}
          <div className="flex items-center justify-end gap-2 mb-4">
            <button
              onClick={toggleChallengeMode}
              disabled={suggestionsLoading || loading}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                challengeMode
                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Challenge mode: try new ingredients!"
            >
              {challengeMode ? '🎲 Variety Mode' : '🎲 Try New'}
            </button>
            <button
              onClick={() => fetchSuggestions(true)}
              disabled={suggestionsLoading || loading}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
              title="Refresh suggestions"
            >
              <svg
                className={`w-5 h-5 text-gray-600 ${suggestionsLoading ? 'animate-spin' : ''}`}
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

          {/* Challenge Mode Banner */}
          {challengeMode && !loading && (
            <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3">
              <span className="text-xl">🎲</span>
              <div>
                <p className="font-medium text-purple-800">Variety Mode Active</p>
                <p className="text-sm text-purple-700">Suggestions will encourage you to try new ingredients beyond your usual staples</p>
              </div>
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
                href="/dashboard/inventory"
                className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors"
              >
                Go to Store
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
                const isExpanded = expandedSuggestion === index
                const difficulty = DIFFICULTY_BADGES[suggestion.difficulty] || DIFFICULTY_BADGES.medium
                const hasExpiringItems = suggestion.expiring_items_used.length > 0

                return (
                  <div
                    key={index}
                    className={`bg-white rounded-2xl border ${hasExpiringItems ? 'border-amber-300' : 'border-gray-200'} overflow-hidden`}
                  >
                    {/* Card header */}
                    <button
                      onClick={() => setExpandedSuggestion(isExpanded ? null : index)}
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
                            <div className="flex flex-wrap gap-1 mb-3">
                              {suggestion.additional_ingredients_needed.map((item, i) => (
                                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                  {item}
                                </span>
                              ))}
                            </div>
                            {/* Add to Shopping List button */}
                            {addedSuccess === index ? (
                              <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Added to shopping list!
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAddToShoppingList(index, suggestion.additional_ingredients_needed)
                                }}
                                disabled={addingToList === index}
                                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                              >
                                {addingToList === index ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Adding...
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Add {suggestion.additional_ingredients_needed.length} to Shopping List
                                  </>
                                )}
                              </button>
                            )}
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
        </>
      )}

      {/* SAVED RECIPES TAB */}
      {activeTab === 'saved' && (
        <>
          {/* Add Recipe Section */}
          {inputMode === 'none' && !previewRecipe && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Add a Recipe</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setInputMode('url')}
                  className="p-4 bg-white rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-colors text-left"
                >
                  <span className="text-2xl mb-2 block">📸</span>
                  <span className="font-medium text-gray-900">Instagram URL</span>
                  <p className="text-sm text-gray-500 mt-1">Paste a link to an Instagram recipe post</p>
                </button>
                <button
                  onClick={() => setInputMode('text')}
                  className="p-4 bg-white rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-colors text-left"
                >
                  <span className="text-2xl mb-2 block">✍️</span>
                  <span className="font-medium text-gray-900">Paste Recipe</span>
                  <p className="text-sm text-gray-500 mt-1">Paste recipe text from anywhere</p>
                </button>
              </div>
            </div>
          )}

          {/* URL Input Mode */}
          {inputMode === 'url' && !previewRecipe && (
            <div className="bg-white rounded-xl border-2 border-purple-200 p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Paste Instagram URL</h2>
                <button
                  onClick={() => { setInputMode('none'); setUrlInput('') }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={handleParseUrl} className="space-y-4">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://www.instagram.com/p/..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  disabled={parsing}
                />
                <button
                  type="submit"
                  disabled={!urlInput.trim() || parsing}
                  className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {parsing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Extracting recipe...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Extract Recipe
                    </>
                  )}
                </button>
              </form>
              <p className="text-sm text-gray-500 mt-3">
                Works with public Instagram posts. For private posts, use &quot;Paste Recipe&quot; to copy the caption text.
              </p>
            </div>
          )}

          {/* Text Input Mode */}
          {inputMode === 'text' && !previewRecipe && (
            <div className="bg-white rounded-xl border-2 border-purple-200 p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Paste Recipe Text</h2>
                <button
                  onClick={() => { setInputMode('none'); setTextInput('') }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={handleParseText} className="space-y-4">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste your recipe here... It can be messy! Include ingredients and instructions."
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  disabled={parsing}
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || parsing}
                  className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {parsing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Parsing recipe...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Parse Recipe
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Recipe Preview */}
          {previewRecipe && (
            <div className="bg-white rounded-xl border-2 border-emerald-300 p-6 mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                    Preview
                  </span>
                  <h2 className="text-xl font-bold text-gray-900 mt-2">{previewRecipe.name}</h2>
                  {previewRecipe.description && (
                    <p className="text-gray-600 mt-1">{previewRecipe.description}</p>
                  )}
                </div>
                {previewSource?.image_url && (
                  <img
                    src={previewSource.image_url}
                    alt={previewRecipe.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                )}
              </div>

              {/* Meta info */}
              <div className="flex flex-wrap gap-2 mb-4">
                {previewRecipe.estimated_time_minutes && (
                  <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {previewRecipe.estimated_time_minutes} min
                  </span>
                )}
                {previewRecipe.servings && (
                  <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {previewRecipe.servings} servings
                  </span>
                )}
                {previewRecipe.cuisine_type && (
                  <span className="text-sm bg-purple-100 text-purple-600 px-2 py-1 rounded-full">
                    {previewRecipe.cuisine_type}
                  </span>
                )}
                {previewRecipe.tags.map((tag, i) => (
                  <span key={i} className="text-sm bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Ingredients */}
              {previewRecipe.ingredients.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-2">Ingredients</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {previewRecipe.ingredients.map((ing, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-gray-400">-</span>
                        <span>
                          {ing.quantity} {ing.unit} {ing.name}
                          {ing.optional && <span className="text-gray-400"> (optional)</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Instructions */}
              {previewRecipe.instructions && (
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-2">Instructions</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{previewRecipe.instructions}</p>
                </div>
              )}

              {/* Source info */}
              {previewSource?.author && (
                <p className="text-sm text-gray-500 mb-4">
                  From: @{previewSource.author}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleSaveRecipe}
                  disabled={parsing}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {parsing ? 'Saving...' : 'Save Recipe'}
                </button>
                <button
                  onClick={() => {
                    setPreviewRecipe(null)
                    setPreviewSource(null)
                    setInputMode('none')
                    setUrlInput('')
                    setTextInput('')
                  }}
                  className="px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Recipe Collection */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Your Recipes
            </h2>

            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
              </div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border-2 border-gray-200">
                <span className="text-4xl mb-4 block">📚</span>
                <p className="text-gray-500">No recipes saved yet</p>
                <p className="text-sm text-gray-400 mt-1">Add recipes from Instagram or paste them above</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recipes.map(recipe => (
                  <Link
                    key={recipe.id}
                    href={`/dashboard/inspire/${recipe.id}`}
                    className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-purple-300 hover:shadow-md transition-all cursor-pointer block"
                  >
                    {recipe.image_url && (
                      <div className="h-32 bg-gray-100">
                        <img
                          src={recipe.image_url}
                          alt={recipe.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span title={recipe.source_type}>{getSourceIcon(recipe.source_type)}</span>
                            <h3 className="font-semibold text-gray-900 truncate">{recipe.name}</h3>
                          </div>
                          {recipe.description && (
                            <p className="text-sm text-gray-500 line-clamp-2 mt-1">{recipe.description}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); handleToggleFavorite(recipe) }}
                          className={`text-xl ${recipe.is_favorite ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
                        >
                          {recipe.is_favorite ? '❤️' : '🤍'}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-3">
                        {recipe.estimated_time_minutes && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {recipe.estimated_time_minutes}m
                          </span>
                        )}
                        {recipe.cuisine_type && (
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                            {recipe.cuisine_type}
                          </span>
                        )}
                        {recipe.times_cooked > 0 && (
                          <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">
                            Cooked {recipe.times_cooked}x
                          </span>
                        )}
                      </div>

                      <div className="flex justify-end items-center mt-4 pt-3 border-t border-gray-100">
                        <button
                          onClick={(e) => { e.preventDefault(); handleDeleteRecipe(recipe.id) }}
                          className="text-sm text-gray-400 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
