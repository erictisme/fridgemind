'use client'

import { useState, useEffect } from 'react'

interface MealIngredient {
  name: string
  quantity: number
  unit: string
  category: string
  reason?: string
}

interface MealSuggestionResult {
  recipe_name: string
  ingredients_needed: MealIngredient[]
  already_have: string[]
}

interface ShoppingListItem {
  id: string
  list_id: string
  user_id: string
  name: string
  category: string | null
  quantity: number
  unit: string | null
  is_checked: boolean
  source: string | null
  priority: number
  created_at: string
}

interface ShoppingList {
  id: string
  user_id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

const CATEGORIES = ['produce', 'dairy', 'protein', 'pantry', 'beverage', 'condiment', 'frozen', 'other']

// Category emojis for visual grouping
const categoryEmojis: Record<string, string> = {
  produce: '🥬',
  dairy: '🥛',
  protein: '🍖',
  pantry: '🥫',
  beverage: '🥤',
  condiment: '🧂',
  frozen: '❄️',
  other: '📦',
}

export default function ShoppingListPage() {
  const [list, setList] = useState<ShoppingList | null>(null)
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [newItemName, setNewItemName] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState(1)
  const [newItemUnit, setNewItemUnit] = useState('')
  const [newItemCategory, setNewItemCategory] = useState<string>('')

  // Meal-to-list state
  const [mealInput, setMealInput] = useState('')
  const [mealLoading, setMealLoading] = useState(false)
  const [mealResult, setMealResult] = useState<MealSuggestionResult | null>(null)

  useEffect(() => {
    fetchShoppingList()
  }, [])

  const fetchShoppingList = async () => {
    try {
      const response = await fetch('/api/shopping-list')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setList(data.list)
      setItems(data.items || [])
    } catch {
      setError('Failed to load shopping list')
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim()) return

    setSaving(true)
    try {
      const response = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newItemName.trim(),
          quantity: newItemQuantity,
          unit: newItemUnit.trim() || null,
          category: newItemCategory || null,
        }),
      })

      if (!response.ok) throw new Error('Failed to add item')

      const data = await response.json()
      setItems([...items, data.item])

      // Reset form
      setNewItemName('')
      setNewItemQuantity(1)
      setNewItemUnit('')
      setNewItemCategory('')
    } catch {
      setError('Failed to add item')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleCheck = async (item: ShoppingListItem) => {
    const updatedItem = { ...item, is_checked: !item.is_checked }

    // Optimistic update
    setItems(items.map(i => i.id === item.id ? updatedItem : i))

    try {
      const response = await fetch('/api/shopping-list', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          is_checked: !item.is_checked,
        }),
      })

      if (!response.ok) throw new Error('Failed to update')
    } catch {
      // Revert on error
      setItems(items.map(i => i.id === item.id ? item : i))
      setError('Failed to update item')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    // Optimistic update
    const previousItems = [...items]
    setItems(items.filter(i => i.id !== itemId))

    try {
      const response = await fetch('/api/shopping-list', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId }),
      })

      if (!response.ok) throw new Error('Failed to delete')
    } catch {
      // Revert on error
      setItems(previousItems)
      setError('Failed to delete item')
    }
  }

  const handleClearChecked = async () => {
    if (!list) return

    const checkedCount = items.filter(i => i.is_checked).length
    if (checkedCount === 0) return

    if (!confirm(`Remove ${checkedCount} checked item${checkedCount > 1 ? 's' : ''}?`)) return

    setSaving(true)
    try {
      const response = await fetch('/api/shopping-list', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clearChecked: true,
          listId: list.id,
        }),
      })

      if (!response.ok) throw new Error('Failed to clear')

      setItems(items.filter(i => !i.is_checked))
    } catch {
      setError('Failed to clear checked items')
    } finally {
      setSaving(false)
    }
  }

  // Generate shopping list from meal idea
  const handleGenerateFromMeal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mealInput.trim()) return

    setMealLoading(true)
    setMealResult(null)
    setError(null)

    try {
      const response = await fetch('/api/shopping-list/from-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_description: mealInput.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate list')
      }

      const data = await response.json()
      setMealResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate shopping list')
    } finally {
      setMealLoading(false)
    }
  }

  // Add meal ingredients to shopping list
  const handleAddMealItems = async () => {
    if (!mealResult || mealResult.ingredients_needed.length === 0) return

    setSaving(true)
    try {
      const response = await fetch('/api/shopping-list/from-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_description: mealInput.trim(),
          add_to_list: true,
        }),
      })

      if (!response.ok) throw new Error('Failed to add items')

      // Refresh list to show new items
      await fetchShoppingList()

      // Clear meal input and result
      setMealInput('')
      setMealResult(null)
    } catch {
      setError('Failed to add items to list')
    } finally {
      setSaving(false)
    }
  }

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const category = item.category || 'other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {} as Record<string, ShoppingListItem[]>)

  // Sort categories: uncategorized last
  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    if (a === 'other') return 1
    if (b === 'other') return -1
    return a.localeCompare(b)
  })

  const uncheckedCount = items.filter(i => !i.is_checked).length
  const checkedCount = items.filter(i => i.is_checked).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shopping List</h1>
          <p className="text-gray-500">
            {uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} to get
            {checkedCount > 0 && `, ${checkedCount} checked`}
          </p>
        </div>
        {checkedCount > 0 && (
          <button
            onClick={handleClearChecked}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
          >
            Clear Checked
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* What to Cook - AI Shopping List Generator */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <span className="text-xl">🍳</span>
          What do you want to cook?
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          Tell us what you want to make and we&apos;ll generate a shopping list based on what you already have.
        </p>

        <form onSubmit={handleGenerateFromMeal} className="space-y-3">
          <input
            type="text"
            value={mealInput}
            onChange={(e) => setMealInput(e.target.value)}
            placeholder="e.g., Roast vegetables with tofu, Chicken stir fry, Pasta carbonara..."
            className="w-full px-4 py-3 border border-purple-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
            disabled={mealLoading}
          />
          <button
            type="submit"
            disabled={!mealInput.trim() || mealLoading}
            className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {mealLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Shopping List
              </>
            )}
          </button>
        </form>

        {/* Meal Result */}
        {mealResult && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-purple-100">
            <h3 className="font-semibold text-gray-900 mb-2">{mealResult.recipe_name}</h3>

            {mealResult.already_have.length > 0 && (
              <div className="mb-3">
                <p className="text-sm text-gray-500 mb-1">You already have:</p>
                <div className="flex flex-wrap gap-1">
                  {mealResult.already_have.map((item, i) => (
                    <span key={i} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {mealResult.ingredients_needed.length > 0 ? (
              <>
                <p className="text-sm text-gray-500 mb-2">You&apos;ll need to buy:</p>
                <div className="space-y-2 mb-4">
                  {mealResult.ingredients_needed.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{categoryEmojis[item.category] || '📦'}</span>
                        <span className="font-medium text-gray-900">{item.name}</span>
                        <span className="text-gray-500">
                          ({item.quantity} {item.unit})
                        </span>
                      </div>
                      {item.reason && (
                        <span className="text-gray-400 text-xs">{item.reason}</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddMealItems}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {saving ? 'Adding...' : `Add ${mealResult.ingredients_needed.length} items to list`}
                  </button>
                  <button
                    onClick={() => setMealResult(null)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <p className="text-emerald-600 font-medium">
                You have everything you need! No shopping required.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Add Item Form */}
      <div className="bg-white rounded-xl border-2 border-emerald-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Add Item</h2>
        <form onSubmit={handleAddItem} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Item Name */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Name
              </label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g., Milk, Bread, Apples"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={saving}
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={saving}
              />
            </div>

            {/* Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit (optional)
              </label>
              <input
                type="text"
                value={newItemUnit}
                onChange={(e) => setNewItemUnit(e.target.value)}
                placeholder="e.g., lbs, oz, gallons"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={saving}
              />
            </div>

            {/* Category */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category (optional)
              </label>
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={saving}
              >
                <option value="">No category</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {categoryEmojis[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={!newItemName.trim() || saving}
            className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Adding...' : 'Add to List'}
          </button>
        </form>
      </div>

      {/* Shopping List Items */}
      {items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border-2 border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-500">Your shopping list is empty</p>
          <p className="text-sm text-gray-400 mt-1">Add items using the form above</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedCategories.map(category => (
            <div key={category} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
              {/* Category Header */}
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <span className="text-xl">{categoryEmojis[category]}</span>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                  <span className="text-sm text-gray-400 font-normal">
                    ({groupedItems[category].length})
                  </span>
                </h3>
              </div>

              {/* Items in Category */}
              <div className="divide-y divide-gray-100">
                {groupedItems[category].map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                      item.is_checked ? 'bg-gray-50/50' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleCheck(item)}
                      className="flex-shrink-0 w-6 h-6 rounded border-2 border-gray-300 flex items-center justify-center hover:border-emerald-500 transition-colors"
                      style={{
                        backgroundColor: item.is_checked ? '#059669' : 'white',
                        borderColor: item.is_checked ? '#059669' : undefined,
                      }}
                    >
                      {item.is_checked && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-medium ${
                          item.is_checked
                            ? 'line-through text-gray-400'
                            : 'text-gray-900'
                        }`}
                      >
                        {item.name}
                      </p>
                      {(item.quantity > 1 || item.unit) && (
                        <p className={`text-sm ${item.is_checked ? 'text-gray-400' : 'text-gray-500'}`}>
                          {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                        </p>
                      )}
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete item"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
