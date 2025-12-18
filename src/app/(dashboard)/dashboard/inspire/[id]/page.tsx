'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  notes: string | null
  created_at: string
}

export default function RecipeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [recipe, setRecipe] = useState<SavedRecipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Shopping list state
  const [selectedIngredients, setSelectedIngredients] = useState<Set<number>>(new Set())
  const [addingToList, setAddingToList] = useState(false)
  const [addedToList, setAddedToList] = useState(false)

  // Meal planning state
  const [plannedServings, setPlannedServings] = useState<number>(2)
  const [showMealPlanPicker, setShowMealPlanPicker] = useState(false)
  const [addedToPlan, setAddedToPlan] = useState(false)

  // Inventory check state
  const [checkingInventory, setCheckingInventory] = useState(false)
  const [inventoryCheck, setInventoryCheck] = useState<{
    ingredients: Array<{
      name: string
      required_qty: number
      available_qty: number
      unit: string | null
      status: 'available' | 'partial' | 'missing'
      shortage: number
    }>
    has_shortages: boolean
  } | null>(null)
  const [shortageSelections, setShortageSelections] = useState<Set<number>>(new Set())
  const [addingShortages, setAddingShortages] = useState(false)
  const [shortagesAdded, setShortagesAdded] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchRecipe(params.id as string)
    }
  }, [params.id])

  const fetchRecipe = async (id: string) => {
    try {
      const response = await fetch(`/api/recipes/${id}`)
      if (!response.ok) {
        if (response.status === 404) {
          setError('Recipe not found')
        } else {
          throw new Error('Failed to fetch recipe')
        }
        return
      }
      const data = await response.json()
      setRecipe(data.recipe)
      setPlannedServings(data.recipe.servings || 2)
    } catch {
      setError('Failed to load recipe')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (!recipe) return

    try {
      await fetch('/api/recipes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: recipe.id,
          is_favorite: !recipe.is_favorite,
        }),
      })
      setRecipe({ ...recipe, is_favorite: !recipe.is_favorite })
    } catch {
      setError('Failed to update recipe')
    }
  }

  const handleDelete = async () => {
    if (!recipe || !confirm('Delete this recipe?')) return

    setDeleting(true)
    try {
      await fetch('/api/recipes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recipe.id }),
      })
      router.push('/dashboard/inspire')
    } catch {
      setError('Failed to delete recipe')
      setDeleting(false)
    }
  }

  const [cooking, setCooking] = useState(false)
  const [cookResult, setCookResult] = useState<{
    deducted: string[]
    not_found: string[]
  } | null>(null)

  // Toggle ingredient selection
  const toggleIngredient = (index: number) => {
    setSelectedIngredients(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // Select all ingredients
  const selectAllIngredients = () => {
    if (!recipe) return
    setSelectedIngredients(new Set(recipe.ingredients.map((_, i) => i)))
  }

  // Clear selection
  const clearSelection = () => {
    setSelectedIngredients(new Set())
  }

  // Add selected ingredients to shopping list
  const handleAddToShoppingList = async () => {
    if (!recipe || selectedIngredients.size === 0) return

    setAddingToList(true)
    try {
      const itemsToAdd = Array.from(selectedIngredients).map(idx => {
        const ing = recipe.ingredients[idx]
        return {
          name: ing.name,
          quantity: typeof ing.quantity === 'number' ? ing.quantity : 1,
          unit: ing.unit || null,
        }
      })

      const response = await fetch('/api/shopping-list/bulk-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToAdd }),
      })

      if (!response.ok) throw new Error('Failed to add items')

      setAddedToList(true)
      setSelectedIngredients(new Set())
      setTimeout(() => setAddedToList(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to shopping list')
    } finally {
      setAddingToList(false)
    }
  }

  const handleMarkCooked = async () => {
    if (!recipe) return

    setCooking(true)
    setCookResult(null)

    try {
      const response = await fetch(`/api/recipes/${recipe.id}/cook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servings_cooked: recipe.servings || 1 }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark as cooked')
      }

      setRecipe({ ...recipe, times_cooked: data.times_cooked })
      setCookResult(data.inventory_updated)

      // Clear result after 5 seconds
      setTimeout(() => setCookResult(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update recipe')
    } finally {
      setCooking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !recipe) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <span className="text-4xl mb-4 block">😕</span>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">{error || 'Recipe not found'}</h1>
        <Link
          href="/dashboard/inspire"
          className="text-emerald-600 hover:text-emerald-700 font-medium"
        >
          ← Back to Inspire
        </Link>
      </div>
    )
  }

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'instagram': return '📸'
      case 'manual': return '✍️'
      case 'ai_suggestion': return '🤖'
      default: return '🔗'
    }
  }

  // Scale ingredient quantity based on servings
  const scaleQuantity = (quantity: string | number | undefined, originalServings: number, targetServings: number) => {
    if (!quantity) return undefined
    const num = typeof quantity === 'number' ? quantity : parseFloat(quantity)
    if (isNaN(num)) return quantity // Return original if not a number
    const scaled = (num / originalServings) * targetServings
    // Round to reasonable precision
    return scaled % 1 === 0 ? scaled : Math.round(scaled * 10) / 10
  }

  // Get week dates for meal plan picker
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
  const formatDayDisplay = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  // Add recipe to meal plan
  const handleAddToMealPlan = (date: Date, meal: 'breakfast' | 'lunch' | 'dinner') => {
    if (!recipe) return

    // Load existing meal plan
    const saved = localStorage.getItem('fridgemind_meal_plan')
    let mealPlan: Array<{ date: string; meal: string; recipes: Array<{ recipe_id: string; recipe_name: string; servings: number; position: number }> }> = []

    if (saved) {
      try {
        mealPlan = JSON.parse(saved)
      } catch {
        // ignore
      }
    }

    const dateKey = formatDateKey(date)
    const existingSlotIndex = mealPlan.findIndex(m => m.date === dateKey && m.meal === meal)

    if (existingSlotIndex >= 0) {
      // Add to existing slot
      const existingSlot = mealPlan[existingSlotIndex]
      // Check if recipe already in slot
      if (existingSlot.recipes.some(r => r.recipe_id === recipe.id)) {
        setShowMealPlanPicker(false)
        return
      }

      existingSlot.recipes.push({
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        servings: plannedServings,
        position: existingSlot.recipes.length,
      })
    } else {
      // Create new slot
      mealPlan.push({
        date: dateKey,
        meal,
        recipes: [{
          recipe_id: recipe.id,
          recipe_name: recipe.name,
          servings: plannedServings,
          position: 0,
        }],
      })
    }

    localStorage.setItem('fridgemind_meal_plan', JSON.stringify(mealPlan))
    setShowMealPlanPicker(false)
    setAddedToPlan(true)
    setTimeout(() => setAddedToPlan(false), 3000)
  }

  // Check inventory for this recipe
  const handleCheckInventory = async () => {
    if (!recipe) return

    setCheckingInventory(true)
    setInventoryCheck(null)
    setShortageSelections(new Set())
    setShortagesAdded(false)

    try {
      const response = await fetch('/api/meal-plan/check-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipes: [{
            recipe_id: recipe.id,
            servings: plannedServings,
          }],
        }),
      })

      if (!response.ok) throw new Error('Failed to check inventory')

      const data = await response.json()
      const recipeResult = data.recipes?.[0]

      if (recipeResult) {
        setInventoryCheck({
          ingredients: recipeResult.ingredients,
          has_shortages: data.has_shortages,
        })

        // Auto-select all missing/partial items
        const missingIndices = new Set<number>()
        recipeResult.ingredients.forEach((ing: { status: string }, idx: number) => {
          if (ing.status === 'missing' || ing.status === 'partial') {
            missingIndices.add(idx)
          }
        })
        setShortageSelections(missingIndices)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check inventory')
    } finally {
      setCheckingInventory(false)
    }
  }

  // Toggle shortage selection
  const toggleShortageSelection = (idx: number) => {
    setShortageSelections(prev => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }

  // Add shortages to shopping list
  const handleAddShortages = async () => {
    if (!inventoryCheck || shortageSelections.size === 0) return

    setAddingShortages(true)
    try {
      const itemsToAdd = Array.from(shortageSelections)
        .map(idx => inventoryCheck.ingredients[idx])
        .filter(ing => ing.shortage > 0)
        .map(ing => ({
          name: ing.name,
          quantity: ing.shortage,
          unit: ing.unit,
        }))

      const response = await fetch('/api/shopping-list/bulk-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToAdd }),
      })

      if (!response.ok) throw new Error('Failed to add items')

      setShortagesAdded(true)
      setShortageSelections(new Set())
      setTimeout(() => setShortagesAdded(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to shopping list')
    } finally {
      setAddingShortages(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-20">
      {/* Back link */}
      <Link
        href="/dashboard/inspire"
        className="text-gray-500 hover:text-gray-700 text-sm mb-4 inline-block"
      >
        ← Back to Inspire
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {recipe.image_url && (
          <div className="h-48 bg-gray-100">
            <img
              src={recipe.image_url}
              alt={recipe.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-6">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span title={recipe.source_type}>{getSourceIcon(recipe.source_type)}</span>
                <h1 className="text-2xl font-bold text-gray-900">{recipe.name}</h1>
              </div>
              {recipe.description && (
                <p className="text-gray-600">{recipe.description}</p>
              )}
            </div>
            <button
              onClick={handleToggleFavorite}
              className={`text-2xl ${recipe.is_favorite ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
            >
              {recipe.is_favorite ? '❤️' : '🤍'}
            </button>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-2 mb-6">
            {recipe.estimated_time_minutes && (
              <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                ⏱️ {recipe.estimated_time_minutes} min
              </span>
            )}
            {recipe.servings && (
              <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                🍽️ {recipe.servings} servings
              </span>
            )}
            {recipe.cuisine_type && (
              <span className="text-sm bg-purple-100 text-purple-600 px-3 py-1 rounded-full">
                {recipe.cuisine_type}
              </span>
            )}
            {recipe.times_cooked > 0 && (
              <span className="text-sm bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full">
                Cooked {recipe.times_cooked}x
              </span>
            )}
          </div>

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-6">
              {recipe.tags.map((tag, i) => (
                <span key={i} className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Source info */}
          {recipe.source_account && (
            <p className="text-sm text-gray-500 mb-6">
              From: @{recipe.source_account}
              {recipe.source_url && (
                <a
                  href={recipe.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-purple-600 hover:text-purple-700"
                >
                  View original →
                </a>
              )}
            </p>
          )}

          {/* Servings Selector for Meal Planning */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">Plan This Recipe</h3>
                <p className="text-xs text-gray-500">Adjust servings and add to your meal plan</p>
              </div>
            </div>

            {/* Servings adjuster */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm text-gray-600">Servings:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPlannedServings(s => Math.max(1, s - 1))}
                  className="w-8 h-8 rounded-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center font-bold"
                >
                  -
                </button>
                <span className="w-12 text-center font-bold text-lg text-gray-900">{plannedServings}</span>
                <button
                  onClick={() => setPlannedServings(s => Math.min(20, s + 1))}
                  className="w-8 h-8 rounded-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center font-bold"
                >
                  +
                </button>
              </div>
              {plannedServings !== recipe.servings && (
                <span className="text-xs text-gray-400">
                  (Recipe: {recipe.servings})
                </span>
              )}
            </div>

            {/* Add to Meal Plan button */}
            {addedToPlan ? (
              <div className="text-center text-emerald-600 font-medium py-2">
                ✓ Added to meal plan!
              </div>
            ) : showMealPlanPicker ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-600 mb-2">Select day and meal:</div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {getWeekDates().map((date, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-24">{formatDayDisplay(date)}</span>
                      <div className="flex gap-1">
                        {(['breakfast', 'lunch', 'dinner'] as const).map(meal => (
                          <button
                            key={meal}
                            onClick={() => handleAddToMealPlan(date, meal)}
                            className="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 capitalize"
                          >
                            {meal.charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setShowMealPlanPicker(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowMealPlanPicker(true)}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  📅 Add to Plan
                </button>
                <button
                  onClick={handleCheckInventory}
                  disabled={checkingInventory}
                  className="flex-1 py-2.5 bg-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-200 disabled:opacity-50"
                >
                  {checkingInventory ? 'Checking...' : '🔍 Check Inventory'}
                </button>
              </div>
            )}

            {/* Inventory Check Results */}
            {inventoryCheck && (
              <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">
                  {inventoryCheck.has_shortages ? '⚠️ Missing Ingredients' : '✅ All Ingredients Available'}
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {inventoryCheck.ingredients.map((ing, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                        ing.status === 'available'
                          ? 'bg-green-50'
                          : ing.status === 'partial'
                            ? 'bg-amber-50'
                            : 'bg-red-50'
                      } ${shortageSelections.has(idx) ? 'ring-2 ring-blue-300' : ''}`}
                      onClick={() => ing.shortage > 0 && toggleShortageSelection(idx)}
                    >
                      {ing.shortage > 0 && (
                        <input
                          type="checkbox"
                          checked={shortageSelections.has(idx)}
                          onChange={() => toggleShortageSelection(idx)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <span className={`text-sm flex-1 ${
                        ing.status === 'available'
                          ? 'text-green-700'
                          : ing.status === 'partial'
                            ? 'text-amber-700'
                            : 'text-red-700'
                      }`}>
                        {ing.status === 'available' ? '✓' : ing.status === 'partial' ? '△' : '✗'}{' '}
                        {ing.name}
                        {ing.status !== 'available' && (
                          <span className="text-xs ml-1">
                            (need {ing.required_qty}{ing.unit ? ` ${ing.unit}` : ''}, have {ing.available_qty})
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Add to Shopping List button */}
                {inventoryCheck.has_shortages && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {shortagesAdded ? (
                      <div className="text-center text-emerald-600 font-medium py-1">
                        ✓ Added to shopping list!
                      </div>
                    ) : (
                      <button
                        onClick={handleAddShortages}
                        disabled={addingShortages || shortageSelections.size === 0}
                        className="w-full py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 text-sm"
                      >
                        {addingShortages ? 'Adding...' : `🛒 Add ${shortageSelections.size} Missing to Shopping List`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ingredients */}
          {recipe.ingredients.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold text-gray-900">Ingredients</h2>
                  {plannedServings !== recipe.servings && (
                    <p className="text-xs text-blue-600">Scaled for {plannedServings} servings</p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={selectAllIngredients}
                    className="text-emerald-600 hover:text-emerald-700"
                  >
                    Select all
                  </button>
                  {selectedIngredients.size > 0 && (
                    <>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={clearSelection}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>
              <ul className="space-y-2">
                {recipe.ingredients.map((ing, i) => {
                  const scaledQty = scaleQuantity(ing.quantity, recipe.servings, plannedServings)
                  const isScaled = plannedServings !== recipe.servings && scaledQty !== ing.quantity

                  return (
                    <li
                      key={i}
                      className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedIngredients.has(i) ? 'bg-emerald-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => toggleIngredient(i)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIngredients.has(i)}
                        onChange={() => toggleIngredient(i)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-gray-700">
                        {scaledQty !== undefined && (
                          <span className={`font-medium ${isScaled ? 'text-blue-600' : ''}`}>
                            {scaledQty}{' '}
                          </span>
                        )}
                        {ing.unit && <span>{ing.unit} </span>}
                        {ing.name}
                        {ing.optional && <span className="text-gray-400 text-sm"> (optional)</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>

              {/* Add to Shopping List button */}
              {selectedIngredients.size > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {addedToList ? (
                    <div className="text-center text-emerald-600 font-medium py-2">
                      ✓ Added to shopping list!
                    </div>
                  ) : (
                    <button
                      onClick={handleAddToShoppingList}
                      disabled={addingToList}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {addingToList ? 'Adding...' : `🛒 Add ${selectedIngredients.size} to Shopping List`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {recipe.instructions && (
            <div className="mb-6">
              <h2 className="font-semibold text-gray-900 mb-3">Instructions</h2>
              <div className="text-gray-700 whitespace-pre-line">{recipe.instructions}</div>
            </div>
          )}

          {/* Notes */}
          {recipe.notes && (
            <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h2 className="font-semibold text-amber-800 mb-2">Notes</h2>
              <p className="text-amber-700 text-sm">{recipe.notes}</p>
            </div>
          )}

          {/* Cook Result */}
          {cookResult && (
            <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <h3 className="font-semibold text-emerald-800 mb-2">✓ Marked as cooked!</h3>
              {cookResult.deducted.length > 0 && (
                <div className="text-sm text-emerald-700 mb-2">
                  <span className="font-medium">Deducted from inventory:</span>
                  <ul className="mt-1 space-y-0.5">
                    {cookResult.deducted.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {cookResult.not_found.length > 0 && (
                <div className="text-sm text-amber-700">
                  <span className="font-medium">Not in inventory:</span> {cookResult.not_found.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={handleMarkCooked}
              disabled={cooking}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {cooking ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Updating inventory...
                </>
              ) : (
                <>
                  <span>🍳</span>
                  I Made This
                </>
              )}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg font-medium disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Clicking &quot;I Made This&quot; will deduct ingredients from your inventory
          </p>
        </div>
      </div>
    </div>
  )
}
