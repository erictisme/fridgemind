'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
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
  recipe_steps: string[]
  recipe_summary?: string // Legacy field
  estimated_time_minutes: number
  difficulty: 'easy' | 'medium' | 'hard'
  ingredients_from_inventory: string[]
  additional_ingredients_needed: string[]
  expiring_items_used: string[]
  priority_score: number
}

interface InventoryItem {
  id: string
  name: string
  quantity: number
  expiry_date: string
}

interface PlannedRecipe {
  recipe_id: string
  recipe_name: string
  servings: number
  position: number
}

interface MealPlan {
  date: string
  meal: 'breakfast' | 'lunch' | 'dinner'
  recipes: PlannedRecipe[]
}

// Legacy format for migration
interface LegacyMealPlan {
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

const COOKING_METHODS = [
  { id: 'oven', label: 'Oven', icon: '🔥' },
  { id: 'airfry', label: 'Air Fry', icon: '🌀' },
  { id: 'boil', label: 'Boil', icon: '♨️' },
  { id: 'steam', label: 'Steam', icon: '💨' },
  { id: 'pan', label: 'Pan/Wok', icon: '🍳' },
  { id: 'grill', label: 'Grill', icon: '🥩' },
  { id: 'raw', label: 'No Cook', icon: '🥗' },
]

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
  const searchParams = useSearchParams()
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

  // Ingredient selection for recipe generation
  const [showIngredientPicker, setShowIngredientPicker] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([])
  const [recipeCount, setRecipeCount] = useState(3)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [selectedCookingMethods, setSelectedCookingMethods] = useState<string[]>([])
  const [deletingInventoryItem, setDeletingInventoryItem] = useState<string | null>(null)
  const [remarks, setRemarks] = useState('')
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState(0)
  const [savingSuggestion, setSavingSuggestion] = useState(false)
  const [savedSuggestionIndex, setSavedSuggestionIndex] = useState<number | null>(null)

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

  // Week inventory check state
  const [checkingWeekInventory, setCheckingWeekInventory] = useState(false)
  const [weekInventoryCheck, setWeekInventoryCheck] = useState<{
    total_shortages: Array<{ name: string; quantity: number; unit: string | null }>
    has_shortages: boolean
  } | null>(null)
  const [weekShortageSelections, setWeekShortageSelections] = useState<Set<number>>(new Set())
  const [addingWeekShortages, setAddingWeekShortages] = useState(false)
  const [weekShortagesAdded, setWeekShortagesAdded] = useState(false)

  useEffect(() => {
    fetchRecipes()
    loadMealPlan()

    // Check URL params for auto-opening ingredient picker
    const openPicker = searchParams.get('picker') === 'true'
    const preselectedItems = searchParams.get('items')

    if (openPicker) {
      // Pre-select items if provided in URL
      if (preselectedItems) {
        const items = preselectedItems.split(',').map(s => s.trim()).filter(Boolean)
        setSelectedIngredients(items)
      }
      // Open the ingredient picker and fetch inventory
      setShowIngredientPicker(true)
      fetchInventoryItems()
    }
  }, [searchParams])

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
        const parsed = JSON.parse(saved)
        // Migrate from old format (single recipe_id) to new format (recipes array)
        const migrated = parsed.map((plan: MealPlan | LegacyMealPlan) => {
          // Check if this is the old format (has recipe_id directly)
          if ('recipe_id' in plan && !('recipes' in plan)) {
            const legacy = plan as LegacyMealPlan
            return {
              date: legacy.date,
              meal: legacy.meal,
              recipes: [{
                recipe_id: legacy.recipe_id,
                recipe_name: legacy.recipe_name,
                servings: 2, // Default servings
                position: 0,
              }],
            } as MealPlan
          }
          return plan as MealPlan
        })
        setMealPlan(migrated)
        // Save migrated format back
        localStorage.setItem('fridgemind_meal_plan', JSON.stringify(migrated))
      } catch {
        // ignore
      }
    }
  }

  const saveMealPlan = (plan: MealPlan[]) => {
    localStorage.setItem('fridgemind_meal_plan', JSON.stringify(plan))
    setMealPlan(plan)
  }

  // Fetch inventory items for ingredient picker
  const fetchInventoryItems = async () => {
    setLoadingInventory(true)
    try {
      const response = await fetch('/api/inventory')
      if (response.ok) {
        const data = await response.json()
        setInventoryItems(data.items || [])
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err)
    } finally {
      setLoadingInventory(false)
    }
  }

  // Open ingredient picker
  const openIngredientPicker = async () => {
    setShowIngredientPicker(true)
    if (inventoryItems.length === 0) {
      await fetchInventoryItems()
    }
  }

  // Toggle ingredient selection
  const toggleIngredient = (name: string) => {
    setSelectedIngredients(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    )
  }

  // Calculate days until expiry
  const getDaysUntilExpiry = (expiryDate: string) => {
    return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  // Delete inventory item (ate it or went bad)
  const handleDeleteInventoryItem = async (itemId: string, reason: 'eaten' | 'bad') => {
    setDeletingInventoryItem(itemId)
    try {
      const response = await fetch(`/api/inventory/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (response.ok) {
        // Remove from local state
        const deletedItem = inventoryItems.find(i => i.id === itemId)
        setInventoryItems(prev => prev.filter(i => i.id !== itemId))
        // Also remove from selected if it was selected
        if (deletedItem) {
          setSelectedIngredients(prev => prev.filter(n => n !== deletedItem.name))
        }
      }
    } catch (err) {
      console.error('Failed to delete item:', err)
    } finally {
      setDeletingInventoryItem(null)
    }
  }

  // Toggle cooking method selection
  const toggleCookingMethod = (methodId: string) => {
    setSelectedCookingMethods(prev =>
      prev.includes(methodId)
        ? prev.filter(m => m !== methodId)
        : [...prev, methodId]
    )
  }

  const handleGenerateSuggestions = async (challenge = false) => {
    setShowSuggestions(true)
    setShowIngredientPicker(false)
    setSuggestionsLoading(true)
    setError(null)
    setChallengeMode(challenge)
    setCurrentRecipeIndex(0)

    try {
      // Use POST with options if we have selected ingredients
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mustUseItems: selectedIngredients,
          recipeCount,
          challenge,
          cookingMethods: selectedCookingMethods,
          remarks: remarks.trim(),
        }),
      })

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

  // Save a generated suggestion to My Recipes
  const handleSaveSuggestion = async (suggestion: MealSuggestion) => {
    setSavingSuggestion(true)
    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: suggestion.name,
          description: suggestion.description,
          source_type: 'ai_suggestion',
          ingredients: suggestion.ingredients_from_inventory.map(name => ({ name })),
          instructions: suggestion.recipe_steps.map((step, i) => `${i + 1}. ${step}`).join('\n'),
          estimated_time_minutes: suggestion.estimated_time_minutes,
          tags: [],
        }),
      })

      if (!response.ok) throw new Error('Failed to save recipe')

      setSavedSuggestionIndex(currentRecipeIndex)
      // Refresh recipes list
      await fetchRecipes()

      // Clear saved indicator after 3 seconds
      setTimeout(() => setSavedSuggestionIndex(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe')
    } finally {
      setSavingSuggestion(false)
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
      // Also remove from meal plan - filter out recipes with this ID from all slots
      const updatedMealPlan = mealPlan
        .map(slot => ({
          ...slot,
          recipes: slot.recipes.filter(r => r.recipe_id !== id),
        }))
        .filter(slot => slot.recipes.length > 0) // Remove empty slots
      saveMealPlan(updatedMealPlan)
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

    // Find existing slot or create new one
    const existingSlotIndex = mealPlan.findIndex(m => m.date === dateKey && m.meal === meal)

    if (existingSlotIndex >= 0) {
      // Add to existing slot
      const existingSlot = mealPlan[existingSlotIndex]

      // Check if recipe already in this slot
      if (existingSlot.recipes.some(r => r.recipe_id === draggedRecipe.id)) {
        setDraggedRecipe(null)
        return
      }

      const newRecipe: PlannedRecipe = {
        recipe_id: draggedRecipe.id,
        recipe_name: draggedRecipe.name,
        servings: draggedRecipe.servings || 2,
        position: existingSlot.recipes.length,
      }

      const updatedSlot: MealPlan = {
        ...existingSlot,
        recipes: [...existingSlot.recipes, newRecipe],
      }

      const newPlan = [...mealPlan]
      newPlan[existingSlotIndex] = updatedSlot
      saveMealPlan(newPlan)
    } else {
      // Create new slot
      const newSlot: MealPlan = {
        date: dateKey,
        meal,
        recipes: [{
          recipe_id: draggedRecipe.id,
          recipe_name: draggedRecipe.name,
          servings: draggedRecipe.servings || 2,
          position: 0,
        }],
      }

      saveMealPlan([...mealPlan, newSlot])
    }

    setDraggedRecipe(null)
  }

  const handleRemoveMeal = (date: string, meal: string) => {
    saveMealPlan(mealPlan.filter(m => !(m.date === date && m.meal === meal)))
  }

  // Remove a single recipe from a meal slot
  const handleRemoveMealRecipe = (date: string, meal: string, recipeId: string) => {
    const slotIndex = mealPlan.findIndex(m => m.date === date && m.meal === meal)
    if (slotIndex < 0) return

    const slot = mealPlan[slotIndex]
    const updatedRecipes = slot.recipes.filter(r => r.recipe_id !== recipeId)

    if (updatedRecipes.length === 0) {
      // Remove the entire slot if no recipes left
      saveMealPlan(mealPlan.filter(m => !(m.date === date && m.meal === meal)))
    } else {
      // Update positions and save
      const repositioned = updatedRecipes.map((r, i) => ({ ...r, position: i }))
      const newPlan = [...mealPlan]
      newPlan[slotIndex] = { ...slot, recipes: repositioned }
      saveMealPlan(newPlan)
    }
  }

  const getMealForSlot = (date: Date, meal: string) => {
    const dateKey = formatDateKey(date)
    return mealPlan.find(m => m.date === dateKey && m.meal === meal)
  }

  // Check inventory for all planned meals
  const handleCheckWeekInventory = async () => {
    if (mealPlan.length === 0) return

    setCheckingWeekInventory(true)
    setWeekInventoryCheck(null)
    setWeekShortageSelections(new Set())
    setWeekShortagesAdded(false)

    try {
      // Collect all recipes from the meal plan
      const recipesToCheck = mealPlan.flatMap(slot =>
        slot.recipes.map(r => ({
          recipe_id: r.recipe_id,
          servings: r.servings,
        }))
      )

      if (recipesToCheck.length === 0) {
        setCheckingWeekInventory(false)
        return
      }

      const response = await fetch('/api/meal-plan/check-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipes: recipesToCheck }),
      })

      if (!response.ok) throw new Error('Failed to check inventory')

      const data = await response.json()

      setWeekInventoryCheck({
        total_shortages: data.total_shortages || [],
        has_shortages: data.has_shortages || false,
      })

      // Auto-select all shortages
      if (data.total_shortages?.length > 0) {
        setWeekShortageSelections(new Set(data.total_shortages.map((_: unknown, i: number) => i)))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check inventory')
    } finally {
      setCheckingWeekInventory(false)
    }
  }

  // Toggle week shortage selection
  const toggleWeekShortage = (idx: number) => {
    setWeekShortageSelections(prev => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }

  // Add week shortages to shopping list
  const handleAddWeekShortages = async () => {
    if (!weekInventoryCheck || weekShortageSelections.size === 0) return

    setAddingWeekShortages(true)
    try {
      const itemsToAdd = Array.from(weekShortageSelections)
        .map(idx => weekInventoryCheck.total_shortages[idx])
        .map(item => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
        }))

      const response = await fetch('/api/shopping-list/bulk-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToAdd }),
      })

      if (!response.ok) throw new Error('Failed to add items')

      setWeekShortagesAdded(true)
      setWeekShortageSelections(new Set())
      setTimeout(() => setWeekShortagesAdded(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to shopping list')
    } finally {
      setAddingWeekShortages(false)
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

  // Count meals planned (total recipes across all slots)
  const mealsPlannedThisWeek = mealPlan
    .filter(m => {
      const mealDate = new Date(m.date)
      const today = new Date()
      const weekFromNow = new Date(today)
      weekFromNow.setDate(today.getDate() + 7)
      return mealDate >= today && mealDate < weekFromNow
    })
    .reduce((sum, m) => sum + m.recipes.length, 0)

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
      {inputMode === 'none' && !previewRecipe && !showSuggestions && !showIngredientPicker && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl">🤖</span>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Generate Recipe Ideas</h2>
              <p className="text-sm text-gray-600 mt-1">
                AI will suggest meals based on what&apos;s in your inventory.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={openIngredientPicker}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
                >
                  🍳 What to Cook?
                </button>
                <button
                  onClick={() => handleGenerateSuggestions(true)}
                  className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200"
                >
                  🎲 Surprise Me
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ingredient Picker */}
      {showIngredientPicker && (
        <div className="bg-white rounded-xl border-2 border-emerald-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">What do you want to cook with?</h2>
              <p className="text-sm text-gray-500">Tick = must use in recipes. Unticked items can still be suggested.</p>
            </div>
            <button
              onClick={() => setShowIngredientPicker(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>

          {/* Recipe count selector */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <label className="text-sm font-medium text-gray-700 block mb-2">
              How many recipe ideas? ({recipeCount})
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRecipeCount(n)}
                  className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                    recipeCount === n
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-emerald-400'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Ingredient list */}
          {loadingInventory ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading inventory...</p>
            </div>
          ) : inventoryItems.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-3xl mb-2 block">📦</span>
              <p className="text-gray-600">No items in inventory</p>
              <p className="text-sm text-gray-400">Add items to your inventory first</p>
            </div>
          ) : (
            <>
              {selectedIngredients.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="text-sm text-gray-500">Selected:</span>
                  {selectedIngredients.map(name => (
                    <span
                      key={name}
                      className="text-sm bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full flex items-center gap-1"
                    >
                      {name}
                      <button
                        onClick={() => toggleIngredient(name)}
                        className="text-emerald-500 hover:text-emerald-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={() => setSelectedIngredients([])}
                    className="text-sm text-gray-400 hover:text-gray-600"
                  >
                    Clear all
                  </button>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                {inventoryItems.map((item, index) => {
                  const days = getDaysUntilExpiry(item.expiry_date)
                  const isSelected = selectedIngredients.includes(item.name)
                  const isUrgent = days <= 2
                  const isExpiringSoon = days <= 5
                  const isDeleting = deletingInventoryItem === item.id

                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-3 px-3 py-2 transition-colors border-b border-gray-100 last:border-b-0 ${
                        isSelected ? 'bg-emerald-50' : 'hover:bg-gray-50'
                      } ${isDeleting ? 'opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleIngredient(item.name)}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span
                        className={`flex-1 cursor-pointer ${isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}`}
                        onClick={() => toggleIngredient(item.name)}
                      >
                        {item.name}
                      </span>
                      <span className="text-sm text-gray-400">×{item.quantity}</span>
                      {isUrgent ? (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                          {days <= 0 ? 'Expired!' : `${days}d left`}
                        </span>
                      ) : isExpiringSoon ? (
                        <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                          {days}d left
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{days}d</span>
                      )}
                      <button
                        onClick={() => handleDeleteInventoryItem(item.id, 'eaten')}
                        disabled={isDeleting}
                        className="w-6 h-6 rounded-full bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center text-xs flex-shrink-0"
                        title="Ate it"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleDeleteInventoryItem(item.id, 'bad')}
                        disabled={isDeleting}
                        className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center text-xs flex-shrink-0"
                        title="Went bad"
                      >
                        🗑
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Cooking Methods */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Cooking method (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {COOKING_METHODS.map(method => (
                <button
                  key={method.id}
                  onClick={() => toggleCookingMethod(method.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                    selectedCookingMethods.includes(method.id)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-emerald-400'
                  }`}
                >
                  <span>{method.icon}</span>
                  <span>{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Remarks/Notes */}
          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Special instructions (optional)
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g., I want something nutritious, grate the yacon not dice it, thinking to fry some noodles..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none text-sm"
            />
          </div>

          {/* Generate button */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => handleGenerateSuggestions(false)}
              disabled={inventoryItems.length === 0}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate {recipeCount} Recipe{recipeCount > 1 ? 's' : ''}
              {selectedIngredients.length > 0 && ` using ${selectedIngredients.length} item${selectedIngredients.length > 1 ? 's' : ''}`}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            {selectedIngredients.length === 0
              ? 'Will prioritize items expiring soon'
              : `Recipes will be distinct, spreading ${selectedIngredients.length} items across dishes`}
          </p>
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

      {/* Generated Suggestions - Carousel View */}
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
              <p className="text-gray-600">Generating distinct recipes...</p>
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
            <div>
              {/* Carousel Navigation */}
              {suggestions.length > 1 && (
                <div className="flex items-center justify-center gap-4 mb-4">
                  <button
                    onClick={() => setCurrentRecipeIndex(i => Math.max(0, i - 1))}
                    disabled={currentRecipeIndex === 0}
                    className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="flex items-center gap-2">
                    {suggestions.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentRecipeIndex(idx)}
                        className={`w-2.5 h-2.5 rounded-full transition-colors ${
                          idx === currentRecipeIndex ? 'bg-emerald-600' : 'bg-gray-300 hover:bg-gray-400'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentRecipeIndex(i => Math.min(suggestions.length - 1, i + 1))}
                    disabled={currentRecipeIndex === suggestions.length - 1}
                    className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Current Recipe Card */}
              {suggestions[currentRecipeIndex] && (() => {
                const suggestion = suggestions[currentRecipeIndex]
                const difficulty = DIFFICULTY_BADGES[suggestion.difficulty] || DIFFICULTY_BADGES.medium

                return (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-200">
                    {/* Recipe number indicator */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                        Dish {currentRecipeIndex + 1} of {suggestions.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${difficulty.color}`}>
                          {difficulty.label}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          ⏱️ {suggestion.estimated_time_minutes}m
                        </span>
                      </div>
                    </div>

                    {/* Recipe Title & Description */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{suggestion.name}</h3>
                    <p className="text-gray-600 mb-4">{suggestion.description}</p>

                    {/* Ingredients from inventory */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Using from your kitchen:</h4>
                      <div className="flex flex-wrap gap-1">
                        {suggestion.ingredients_from_inventory.map((ing, i) => (
                          <span key={i} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Expiring items highlight */}
                    {suggestion.expiring_items_used.length > 0 && (
                      <div className="mb-4 p-2 bg-amber-50 rounded-lg border border-amber-200">
                        <span className="text-xs text-amber-700">
                          ⚠️ Uses expiring: {suggestion.expiring_items_used.join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Recipe Steps */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">How to make it:</h4>
                      <ol className="space-y-2">
                        {(suggestion.recipe_steps || []).map((step, stepIdx) => (
                          <li key={stepIdx} className="flex gap-3 text-sm text-gray-600">
                            <span className="flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs font-medium">
                              {stepIdx + 1}
                            </span>
                            <span className="pt-0.5">{step}</span>
                          </li>
                        ))}
                        {/* Fallback for legacy recipe_summary */}
                        {(!suggestion.recipe_steps || suggestion.recipe_steps.length === 0) && suggestion.recipe_summary && (
                          <li className="text-sm text-gray-600">{suggestion.recipe_summary}</li>
                        )}
                      </ol>
                    </div>

                    {/* Additional ingredients needed */}
                    {suggestion.additional_ingredients_needed.length > 0 && (
                      <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs text-gray-500">You&apos;ll also need: </span>
                            <span className="text-sm text-gray-700">{suggestion.additional_ingredients_needed.join(', ')}</span>
                          </div>
                          {addedSuccess === currentRecipeIndex ? (
                            <span className="text-xs text-emerald-600 font-medium">✓ Added!</span>
                          ) : (
                            <button
                              onClick={() => handleAddToShoppingList(currentRecipeIndex, suggestion.additional_ingredients_needed)}
                              disabled={addingToList === currentRecipeIndex}
                              className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full hover:bg-purple-200 disabled:opacity-50"
                            >
                              {addingToList === currentRecipeIndex ? 'Adding...' : '+ Add to list'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Save to My Recipes button */}
                    <div className="pt-3 border-t border-emerald-200">
                      {savedSuggestionIndex === currentRecipeIndex ? (
                        <div className="text-center text-emerald-600 font-medium py-2">
                          ✓ Saved to My Recipes!
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSaveSuggestion(suggestion)}
                          disabled={savingSuggestion}
                          className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {savingSuggestion ? 'Saving...' : '💾 Save to My Recipes'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Quick switch buttons */}
              {suggestions.length > 1 && (
                <div className="mt-4 flex justify-center gap-2">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentRecipeIndex(idx)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        idx === currentRecipeIndex
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {s.name.length > 20 ? s.name.slice(0, 20) + '...' : s.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Regenerate button */}
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowIngredientPicker(true)}
                  className="text-sm text-gray-500 hover:text-emerald-600"
                >
                  ← Back to ingredient selection
                </button>
              </div>
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
          <div className="flex items-center gap-2">
            {mealPlan.length > 0 && (
              <>
                <button
                  onClick={handleCheckWeekInventory}
                  disabled={checkingWeekInventory}
                  className="text-sm px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-50"
                >
                  {checkingWeekInventory ? 'Checking...' : '🔍 Check Inventory'}
                </button>
                <button
                  onClick={() => { saveMealPlan([]); setWeekInventoryCheck(null) }}
                  className="text-sm text-gray-400 hover:text-red-600"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>

        {/* Week inventory check results */}
        {weekInventoryCheck && (
          <div className={`mb-4 p-4 rounded-xl border ${
            weekInventoryCheck.has_shortages
              ? 'bg-amber-50 border-amber-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <h3 className="font-semibold mb-2">
              {weekInventoryCheck.has_shortages
                ? `⚠️ Missing ${weekInventoryCheck.total_shortages.length} Ingredient${weekInventoryCheck.total_shortages.length !== 1 ? 's' : ''}`
                : '✅ All Ingredients Available'}
            </h3>

            {weekInventoryCheck.has_shortages && (
              <>
                <div className="space-y-1.5 max-h-40 overflow-y-auto mb-3">
                  {weekInventoryCheck.total_shortages.map((item, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center gap-2 p-2 bg-white rounded cursor-pointer transition-colors ${
                        weekShortageSelections.has(idx) ? 'ring-2 ring-blue-300' : ''
                      }`}
                      onClick={() => toggleWeekShortage(idx)}
                    >
                      <input
                        type="checkbox"
                        checked={weekShortageSelections.has(idx)}
                        onChange={() => toggleWeekShortage(idx)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-sm text-gray-700">
                        {item.name}
                        <span className="text-xs text-gray-400 ml-1">
                          ({item.quantity}{item.unit ? ` ${item.unit}` : ''})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>

                {weekShortagesAdded ? (
                  <div className="text-center text-emerald-600 font-medium py-2">
                    ✓ Added to shopping list!
                  </div>
                ) : (
                  <button
                    onClick={handleAddWeekShortages}
                    disabled={addingWeekShortages || weekShortageSelections.size === 0}
                    className="w-full py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 text-sm"
                  >
                    {addingWeekShortages ? 'Adding...' : `🛒 Add ${weekShortageSelections.size} to Shopping List`}
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => setWeekInventoryCheck(null)}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600"
            >
              Dismiss
            </button>
          </div>
        )}

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
                const dateKey = formatDateKey(date)

                return (
                  <div
                    key={`${meal}-${dayIndex}`}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(date, meal)}
                    className={`min-h-[60px] rounded-lg border-2 border-dashed p-1 text-xs transition-colors ${
                      plannedMeal && plannedMeal.recipes.length > 0
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    {plannedMeal && plannedMeal.recipes.length > 0 ? (
                      <div className="space-y-1">
                        {/* Meal label */}
                        <div className="text-gray-400 capitalize text-[10px] font-medium">{meal}</div>
                        {/* Stacked recipes */}
                        {plannedMeal.recipes.map((recipe) => (
                          <div
                            key={recipe.recipe_id}
                            className="relative group bg-white/70 rounded px-1.5 py-1 border border-emerald-200"
                          >
                            <div className="font-medium text-gray-900 truncate pr-4 text-[11px]">
                              {recipe.recipe_name}
                            </div>
                            <div className="text-[9px] text-gray-400">
                              {recipe.servings} srv
                            </div>
                            <button
                              onClick={() => handleRemoveMealRecipe(dateKey, meal, recipe.recipe_id)}
                              className="absolute top-0.5 right-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 text-sm leading-none"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {/* Add more indicator */}
                        <div className="text-[9px] text-emerald-500 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                          + drop to add
                        </div>
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
