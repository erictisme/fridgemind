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

interface MealPlan {
  date: string
  meal: 'breakfast' | 'lunch' | 'dinner'
  recipe_id: string
  recipe_name: string
}

type InputMode = 'none' | 'url' | 'text' | 'bulk'

const DIFFICULTY_BADGES: Record<string, { label: string; color: string }> = {
  easy: { label: 'Easy', color: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  hard: { label: 'Hard', color: 'bg-red-100 text-red-700' },
}

const MEALS = ['breakfast', 'lunch', 'dinner'] as const

// Get week dates starting from today
const getWeekDates = () => {
  const dates = []
  const today = new Date()
  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    dates.push(date)
  }
  return dates
}

const formatDateKey = (date: Date) => date.toISOString().split('T')[0]
const formatDayName = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'short' })
const formatDateNum = (date: Date) => date.getDate()

export default function InspirePage() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Generate suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false)
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

  // Bulk import state
  const [bulkInput, setBulkInput] = useState('')
  const [bulkUrl, setBulkUrl] = useState('')
  const [bulkRecipes, setBulkRecipes] = useState<Array<ParsedRecipe & { selected: boolean }>>([])
  const [bulkStep, setBulkStep] = useState<'input' | 'review'>('input')
  const [savingBulk, setSavingBulk] = useState(false)

  // Preview state
  const [previewRecipe, setPreviewRecipe] = useState<ParsedRecipe | null>(null)
  const [previewSource, setPreviewSource] = useState<{
    url?: string
    author?: string
    image_url?: string
  } | null>(null)

  // Meal planning state
  const [mealPlan, setMealPlan] = useState<MealPlan[]>([])
  const [draggedRecipe, setDraggedRecipe] = useState<SavedRecipe | null>(null)
  const weekDates = getWeekDates()

  useEffect(() => {
    fetchRecipes()
    loadMealPlan()
  }, [])

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

  const loadMealPlan = () => {
    // Load from localStorage for now
    const saved = localStorage.getItem('fridgemind_meal_plan')
    if (saved) {
      try {
        setMealPlan(JSON.parse(saved))
      } catch {
        // ignore
      }
    }
  }

  const saveMealPlan = (plan: MealPlan[]) => {
    localStorage.setItem('fridgemind_meal_plan', JSON.stringify(plan))
    setMealPlan(plan)
  }

  const handleGenerateSuggestions = async (challenge = false) => {
    setShowSuggestions(true)
    setSuggestionsLoading(true)
    setError(null)
    setChallengeMode(challenge)

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
      setError('Failed to generate meal suggestions')
    } finally {
      setSuggestionsLoading(false)
    }
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
      // Also remove from meal plan
      saveMealPlan(mealPlan.filter(m => m.recipe_id !== id))
    } catch {
      setError('Failed to delete recipe')
    }
  }

  // Bulk import handlers
  const handleBulkParse = async () => {
    if (!bulkInput.trim() && !bulkUrl.trim()) return

    setParsing(true)
    setError(null)

    try {
      const response = await fetch('/api/recipes/parse-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: bulkInput.trim() || undefined,
          url: bulkUrl.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse recipes')
      }

      if (data.recipes && data.recipes.length > 0) {
        setBulkRecipes(data.recipes.map((r: ParsedRecipe) => ({ ...r, selected: true })))
        setBulkStep('review')
      } else {
        setError('No recipes found in the content')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse recipes')
    } finally {
      setParsing(false)
    }
  }

  const handleSaveBulkRecipes = async () => {
    const selectedRecipes = bulkRecipes.filter(r => r.selected)
    if (selectedRecipes.length === 0) return

    setSavingBulk(true)
    setError(null)

    try {
      for (const recipe of selectedRecipes) {
        await fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: recipe.name,
            description: recipe.description,
            source_type: bulkUrl ? 'url' : 'manual',
            source_url: bulkUrl || null,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            estimated_time_minutes: recipe.estimated_time_minutes,
            servings: recipe.servings || 2,
            cuisine_type: recipe.cuisine_type,
            tags: recipe.tags,
          }),
        })
      }

      // Reset and refresh
      closeBulkImport()
      await fetchRecipes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipes')
    } finally {
      setSavingBulk(false)
    }
  }

  const closeBulkImport = () => {
    setInputMode('none')
    setBulkInput('')
    setBulkUrl('')
    setBulkRecipes([])
    setBulkStep('input')
  }

  const toggleBulkRecipe = (index: number) => {
    setBulkRecipes(prev => prev.map((r, i) =>
      i === index ? { ...r, selected: !r.selected } : r
    ))
  }

  // Drag and drop handlers
  const handleDragStart = (recipe: SavedRecipe) => {
    setDraggedRecipe(recipe)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (date: Date, meal: typeof MEALS[number]) => {
    if (!draggedRecipe) return

    const dateKey = formatDateKey(date)

    // Remove existing meal at this slot if any
    const filtered = mealPlan.filter(m => !(m.date === dateKey && m.meal === meal))

    // Add new meal
    const newPlan: MealPlan = {
      date: dateKey,
      meal,
      recipe_id: draggedRecipe.id,
      recipe_name: draggedRecipe.name,
    }

    saveMealPlan([...filtered, newPlan])
    setDraggedRecipe(null)
  }

  const handleRemoveMeal = (date: string, meal: string) => {
    saveMealPlan(mealPlan.filter(m => !(m.date === date && m.meal === meal)))
  }

  const getMealForSlot = (date: Date, meal: string) => {
    const dateKey = formatDateKey(date)
    return mealPlan.find(m => m.date === dateKey && m.meal === meal)
  }

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'instagram': return '📸'
      case 'manual': return '✍️'
      case 'ai_suggestion': return '🤖'
      default: return '🔗'
    }
  }

  // Count meals planned
  const mealsPlannedThisWeek = mealPlan.filter(m => {
    const mealDate = new Date(m.date)
    const today = new Date()
    const weekFromNow = new Date(today)
    weekFromNow.setDate(today.getDate() + 7)
    return mealDate >= today && mealDate < weekFromNow
  }).length

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Home
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Inspire</h1>
        <p className="text-gray-500">Save recipes and plan your meals</p>
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

      {/* Add Recipe Section */}
      {inputMode === 'none' && !previewRecipe && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add a Recipe</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setInputMode('url')}
              className="p-4 bg-white rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-colors text-left"
            >
              <span className="text-2xl mb-2 block">📸</span>
              <span className="font-medium text-gray-900">Instagram URL</span>
              <p className="text-sm text-gray-500 mt-1">Single recipe from Instagram</p>
            </button>
            <button
              onClick={() => setInputMode('text')}
              className="p-4 bg-white rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-colors text-left"
            >
              <span className="text-2xl mb-2 block">✍️</span>
              <span className="font-medium text-gray-900">Paste Recipe</span>
              <p className="text-sm text-gray-500 mt-1">Paste a single recipe</p>
            </button>
            <button
              onClick={() => setInputMode('bulk')}
              className="p-4 bg-white rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-colors text-left"
            >
              <span className="text-2xl mb-2 block">📚</span>
              <span className="font-medium text-gray-900">Bulk Import</span>
              <p className="text-sm text-gray-500 mt-1">Multiple recipes from URL or text</p>
            </button>
          </div>
        </div>
      )}

      {/* Generate Recipes Section */}
      {inputMode === 'none' && !previewRecipe && !showSuggestions && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl">🤖</span>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Generate Recipe Ideas</h2>
              <p className="text-sm text-gray-600 mt-1">
                AI will suggest meals based on what&apos;s in your inventory, prioritizing items expiring soon.
              </p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleGenerateSuggestions(false)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
                >
                  Generate Ideas
                </button>
                <button
                  onClick={() => handleGenerateSuggestions(true)}
                  className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200"
                >
                  🎲 Try Something New
                </button>
              </div>
            </div>
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
                'Extract Recipe'
              )}
            </button>
          </form>
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
                'Parse Recipe'
              )}
            </button>
          </form>
        </div>
      )}

      {/* Bulk Import Mode */}
      {inputMode === 'bulk' && (
        <div className="bg-white rounded-xl border-2 border-purple-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {bulkStep === 'input' ? 'Bulk Import Recipes' : `Found ${bulkRecipes.length} Recipes`}
            </h2>
            <button
              onClick={closeBulkImport}
              className="text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>

          {bulkStep === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Page URL</label>
                <input
                  type="url"
                  value={bulkUrl}
                  onChange={(e) => setBulkUrl(e.target.value)}
                  placeholder="https://www.talulafarms.com/pages/recipes"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  disabled={parsing}
                />
              </div>
              <div className="text-center text-gray-400 text-sm">— or —</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paste Multiple Recipes</label>
                <textarea
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="Paste text containing multiple recipes..."
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  disabled={parsing}
                />
              </div>
              <button
                onClick={handleBulkParse}
                disabled={(!bulkInput.trim() && !bulkUrl.trim()) || parsing}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {parsing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Finding recipes...
                  </>
                ) : (
                  'Find Recipes'
                )}
              </button>
            </div>
          )}

          {bulkStep === 'review' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select recipes to import ({bulkRecipes.filter(r => r.selected).length} selected)
              </p>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {bulkRecipes.map((recipe, index) => (
                  <label
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      recipe.selected
                        ? 'border-purple-300 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={recipe.selected}
                      onChange={() => toggleBulkRecipe(index)}
                      className="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900">{recipe.name}</h3>
                      {recipe.description && (
                        <p className="text-sm text-gray-500 line-clamp-1">{recipe.description}</p>
                      )}
                      <div className="flex gap-2 mt-1">
                        {recipe.estimated_time_minutes && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {recipe.estimated_time_minutes}m
                          </span>
                        )}
                        {recipe.ingredients.length > 0 && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {recipe.ingredients.length} ingredients
                          </span>
                        )}
                        {recipe.cuisine_type && (
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                            {recipe.cuisine_type}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveBulkRecipes}
                  disabled={bulkRecipes.filter(r => r.selected).length === 0 || savingBulk}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingBulk ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    `Import ${bulkRecipes.filter(r => r.selected).length} Recipes`
                  )}
                </button>
                <button
                  onClick={() => setBulkStep('input')}
                  className="px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Back
                </button>
              </div>
            </div>
          )}
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
          </div>

          {previewRecipe.ingredients.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium text-gray-900 mb-2">Ingredients</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                {previewRecipe.ingredients.slice(0, 5).map((ing, i) => (
                  <li key={i}>• {ing.quantity} {ing.unit} {ing.name}</li>
                ))}
                {previewRecipe.ingredients.length > 5 && (
                  <li className="text-gray-400">...and {previewRecipe.ingredients.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

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

      {/* Generated Suggestions */}
      {showSuggestions && (
        <div className="bg-white rounded-xl border-2 border-emerald-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {challengeMode ? '🎲 Try Something New' : '🤖 Generated Ideas'}
            </h2>
            <button
              onClick={() => { setShowSuggestions(false); setSuggestions([]) }}
              className="text-gray-400 hover:text-gray-600"
            >
              Close
            </button>
          </div>

          {suggestionsLoading ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Generating ideas from your inventory...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-3xl mb-2 block">🍳</span>
              <p className="text-gray-600">
                {inventoryCount === 0
                  ? 'Add items to your inventory first to get suggestions!'
                  : 'No suggestions available. Try again later!'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => {
                const isExpanded = expandedSuggestion === index
                const difficulty = DIFFICULTY_BADGES[suggestion.difficulty] || DIFFICULTY_BADGES.medium

                return (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedSuggestion(isExpanded ? null : index)}
                      className="w-full p-3 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{suggestion.name}</h3>
                          <p className="text-sm text-gray-500 line-clamp-1">{suggestion.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${difficulty.color}`}>
                            {suggestion.estimated_time_minutes}m
                          </span>
                          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-gray-100 pt-3">
                        <p className="text-sm text-gray-600 mb-3">{suggestion.recipe_summary}</p>

                        {suggestion.expiring_items_used.length > 0 && (
                          <div className="mb-2">
                            <span className="text-xs text-amber-600 font-medium">Uses expiring: </span>
                            <span className="text-xs text-amber-700">{suggestion.expiring_items_used.join(', ')}</span>
                          </div>
                        )}

                        {suggestion.additional_ingredients_needed.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-500">Need: {suggestion.additional_ingredients_needed.join(', ')}</span>
                            {addedSuccess === index ? (
                              <span className="ml-2 text-xs text-emerald-600">✓ Added to list!</span>
                            ) : (
                              <button
                                onClick={() => handleAddToShoppingList(index, suggestion.additional_ingredients_needed)}
                                disabled={addingToList === index}
                                className="ml-2 text-xs text-purple-600 hover:text-purple-700"
                              >
                                {addingToList === index ? 'Adding...' : '+ Add to list'}
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
        </div>
      )}

      {/* Weekly Meal Planner */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Weekly Meal Plan</h2>
            <p className="text-sm text-gray-500">
              {mealsPlannedThisWeek} meal{mealsPlannedThisWeek !== 1 ? 's' : ''} planned
              {mealsPlannedThisWeek >= 14 && (
                <span className="ml-2 text-amber-600">⚠️ That&apos;s a lot of food!</span>
              )}
            </p>
          </div>
          {mealPlan.length > 0 && (
            <button
              onClick={() => saveMealPlan([])}
              className="text-sm text-gray-400 hover:text-red-600"
            >
              Clear all
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 mb-3">Drag recipes from below into meal slots</p>

        <div className="overflow-x-auto -mx-2 px-2">
          <div className="grid grid-cols-7 gap-2 min-w-[600px]">
            {/* Day headers */}
            {weekDates.map((date, i) => (
              <div key={i} className="text-center">
                <div className={`text-xs font-medium ${i === 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {formatDayName(date)}
                </div>
                <div className={`text-lg font-bold ${i === 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                  {formatDateNum(date)}
                </div>
              </div>
            ))}

            {/* Meal rows */}
            {MEALS.map(meal => (
              weekDates.map((date, dayIndex) => {
                const plannedMeal = getMealForSlot(date, meal)

                return (
                  <div
                    key={`${meal}-${dayIndex}`}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(date, meal)}
                    className={`min-h-[60px] rounded-lg border-2 border-dashed p-1 text-xs transition-colors ${
                      plannedMeal
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    {plannedMeal ? (
                      <div className="relative group">
                        <div className="font-medium text-gray-900 truncate pr-4">
                          {plannedMeal.recipe_name}
                        </div>
                        <div className="text-gray-400 capitalize">{meal}</div>
                        <button
                          onClick={() => handleRemoveMeal(plannedMeal.date, plannedMeal.meal)}
                          className="absolute top-0 right-0 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="text-gray-300 capitalize h-full flex items-center justify-center">
                        {meal.charAt(0)}
                      </div>
                    )}
                  </div>
                )
              })
            ))}
          </div>
        </div>
      </div>

      {/* Saved Recipes */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Your Recipes {recipes.length > 0 && `(${recipes.length})`}
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
              <div
                key={recipe.id}
                draggable
                onDragStart={() => handleDragStart(recipe)}
                className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-purple-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
              >
                <Link href={`/dashboard/inspire/${recipe.id}`} className="block">
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
                  </div>
                </Link>
                <div className="px-4 pb-3 flex justify-end border-t border-gray-100 pt-2">
                  <button
                    onClick={() => handleDeleteRecipe(recipe.id)}
                    className="text-sm text-gray-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
