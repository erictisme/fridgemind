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

type InputMode = 'none' | 'url' | 'text'

export default function InspirePage() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    fetchRecipes()
  }, [])

  const fetchRecipes = async () => {
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
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Recipe Inspiration</h1>
        <p className="text-gray-500">Save recipes from Instagram, paste text, or browse your collection</p>
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
                className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-purple-300 transition-colors"
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
                      onClick={() => handleToggleFavorite(recipe)}
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

                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
                    <Link
                      href={`/dashboard/inspire/${recipe.id}`}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      View Recipe
                    </Link>
                    <button
                      onClick={() => handleDeleteRecipe(recipe.id)}
                      className="text-sm text-gray-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
