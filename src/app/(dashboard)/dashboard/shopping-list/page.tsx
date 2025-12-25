'use client'

import { useState, useEffect } from 'react'

interface Alternative {
  name: string
  reason: string
}

interface ShoppingListItem {
  id: string
  list_id: string
  user_id: string
  name: string
  category: string | null
  quantity: number
  unit: string | null
  notes: string | null
  is_checked: boolean
  source: string | null
  priority: number
  recipe_group: string | null
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
  const [newItemNotes, setNewItemNotes] = useState('')

  // Edit modal state
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editQuantity, setEditQuantity] = useState(1)
  const [editUnit, setEditUnit] = useState('')
  const [editCategory, setEditCategory] = useState<string>('')
  const [editNotes, setEditNotes] = useState('')

  // Checked section collapse state
  const [checkedSectionCollapsed, setCheckedSectionCollapsed] = useState(false)

  // View mode: 'category' or 'recipe'
  const [viewMode, setViewMode] = useState<'category' | 'recipe'>('category')

  // Quick add (text dump) state
  const [quickAddText, setQuickAddText] = useState('')
  const [quickAddLoading, setQuickAddLoading] = useState(false)

  // "Couldn't find" alternatives state
  const [alternativesItem, setAlternativesItem] = useState<ShoppingListItem | null>(null)
  const [alternatives, setAlternatives] = useState<Alternative[]>([])
  const [alternativesLoading, setAlternativesLoading] = useState(false)

  useEffect(() => {
    fetchShoppingList()
  }, [])

  // Auto-switch to recipe view when items have recipe groups
  useEffect(() => {
    const hasRecipeGroups = items.some(item => item.recipe_group !== null)
    if (hasRecipeGroups) {
      setViewMode('recipe')
    }
  }, [items])

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
          notes: newItemNotes.trim() || null,
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
      setNewItemNotes('')
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

  // Quick add (text dump) handler
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickAddText.trim()) return

    setQuickAddLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/shopping-list/smart-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: quickAddText.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to parse items')
      }

      // Refresh list to show new items
      await fetchShoppingList()

      // Clear input
      setQuickAddText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add items')
    } finally {
      setQuickAddLoading(false)
    }
  }

  // "Couldn't find" - get alternatives
  const handleCouldntFind = async (item: ShoppingListItem) => {
    setAlternativesItem(item)
    setAlternatives([])
    setAlternativesLoading(true)

    try {
      const response = await fetch('/api/shopping-list/suggest-alternative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: item.name }),
      })

      if (!response.ok) {
        throw new Error('Failed to get alternatives')
      }

      const data = await response.json()
      setAlternatives(data.alternatives || [])
    } catch (err) {
      console.error('Failed to get alternatives:', err)
      setError('Failed to suggest alternatives')
      setAlternativesItem(null)
    } finally {
      setAlternativesLoading(false)
    }
  }

  // Replace item with alternative
  const handleUseAlternative = async (alternative: Alternative) => {
    if (!alternativesItem) return

    setSaving(true)
    try {
      // Update the item name to the alternative
      const response = await fetch('/api/shopping-list', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: alternativesItem.id,
          name: alternative.name,
        }),
      })

      if (!response.ok) throw new Error('Failed to update item')

      // Update local state
      setItems(items.map(i =>
        i.id === alternativesItem.id
          ? { ...i, name: alternative.name }
          : i
      ))

      // Close modal
      setAlternativesItem(null)
      setAlternatives([])
    } catch {
      setError('Failed to update item')
    } finally {
      setSaving(false)
    }
  }

  // Skip item (remove from list)
  const handleSkipItem = async () => {
    if (!alternativesItem) return
    await handleDeleteItem(alternativesItem.id)
    setAlternativesItem(null)
    setAlternatives([])
  }

  // Open edit modal
  const handleEditItem = (item: ShoppingListItem) => {
    setEditingItem(item)
    setEditName(item.name)
    setEditQuantity(item.quantity)
    setEditUnit(item.unit || '')
    setEditCategory(item.category || '')
    setEditNotes(item.notes || '')
  }

  // Save edited item
  const handleSaveEdit = async () => {
    if (!editingItem || !editName.trim()) return

    setSaving(true)
    try {
      const response = await fetch('/api/shopping-list', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem.id,
          name: editName.trim(),
          quantity: editQuantity,
          unit: editUnit.trim() || null,
          category: editCategory || null,
          notes: editNotes.trim() || null,
        }),
      })

      if (!response.ok) throw new Error('Failed to update item')

      // Update local state
      setItems(items.map(i =>
        i.id === editingItem.id
          ? {
              ...i,
              name: editName.trim(),
              quantity: editQuantity,
              unit: editUnit.trim() || null,
              category: editCategory || null,
              notes: editNotes.trim() || null,
            }
          : i
      ))

      // Close modal
      setEditingItem(null)
    } catch {
      setError('Failed to update item')
    } finally {
      setSaving(false)
    }
  }

  // Separate checked and unchecked items
  const checkedItems = items.filter(i => i.is_checked)
  const uncheckedItems = items.filter(i => !i.is_checked)

  // Group unchecked items by category
  const groupedUncheckedItems = uncheckedItems.reduce((acc, item) => {
    const category = item.category || 'other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {} as Record<string, ShoppingListItem[]>)

  // Group unchecked items by recipe
  const groupedByRecipe = uncheckedItems.reduce((acc, item) => {
    const recipe = item.recipe_group || 'Other Items'
    if (!acc[recipe]) {
      acc[recipe] = []
    }
    acc[recipe].push(item)
    return acc
  }, {} as Record<string, ShoppingListItem[]>)

  // Sort categories: uncategorized last
  const sortedCategories = Object.keys(groupedUncheckedItems).sort((a, b) => {
    if (a === 'other') return 1
    if (b === 'other') return -1
    return a.localeCompare(b)
  })

  // Sort recipes: "Other Items" (null recipe_group) last
  const sortedRecipes = Object.keys(groupedByRecipe).sort((a, b) => {
    if (a === 'Other Items') return 1
    if (b === 'Other Items') return -1
    return a.localeCompare(b)
  })

  const uncheckedCount = uncheckedItems.length
  const checkedCount = checkedItems.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
      {/* Header - Mobile optimized */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Shopping List</h1>
          <p className="text-sm sm:text-base text-gray-500">
            {uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} to get
            {checkedCount > 0 && `, ${checkedCount} checked`}
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* View Toggle - Compact on mobile */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 sm:p-1 flex-shrink-0">
            <button
              onClick={() => setViewMode('category')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                viewMode === 'category'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Category
            </button>
            <button
              onClick={() => setViewMode('recipe')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                viewMode === 'recipe'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Recipe
            </button>
          </div>
          {checkedCount > 0 && (
            <button
              onClick={handleClearChecked}
              disabled={saving}
              className="px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 flex-shrink-0 whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
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

      {/* Quick Add - Text Dump - Mobile optimized */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 p-3 sm:p-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2 flex items-center gap-2">
          <span className="text-lg sm:text-xl">📝</span>
          Quick Add
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
          Paste items. Use &quot;Recipe: item1, item2&quot; to group.
        </p>

        <form onSubmit={handleQuickAdd} className="space-y-2 sm:space-y-3">
          <textarea
            value={quickAddText}
            onChange={(e) => setQuickAddText(e.target.value)}
            placeholder="Soup: mushrooms, cream&#10;2 pumpkin, eggs x12..."
            rows={3}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-blue-200 rounded-lg text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white resize-none"
            disabled={quickAddLoading}
          />
          <button
            type="submit"
            disabled={!quickAddText.trim() || quickAddLoading}
            className="w-full px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base active:bg-blue-800"
          >
            {quickAddLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Parsing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Items
              </>
            )}
          </button>
        </form>
      </div>

      {/* Add Item Form - Collapsible on mobile */}
      <details className="bg-white rounded-xl border-2 border-emerald-200 group">
        <summary className="p-3 sm:p-4 cursor-pointer list-none flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">+ Add Single Item</h2>
          <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <form onSubmit={handleAddItem} className="p-3 sm:p-4 pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {/* Item Name */}
            <div className="col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Item Name
              </label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Milk, Bread, Apples"
                className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={saving}
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Qty
              </label>
              <input
                type="number"
                min="1"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={saving}
              />
            </div>

            {/* Unit */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Unit
              </label>
              <input
                type="text"
                value={newItemUnit}
                onChange={(e) => setNewItemUnit(e.target.value)}
                placeholder="kg, pcs"
                className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={saving}
              />
            </div>

            {/* Category */}
            <div className="col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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

            {/* Notes */}
            <div className="col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={newItemNotes}
                onChange={(e) => setNewItemNotes(e.target.value)}
                placeholder="Brand preference, type..."
                className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={saving}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!newItemName.trim() || saving}
            className="w-full px-4 py-2.5 sm:py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base active:bg-emerald-800"
          >
            {saving ? 'Adding...' : 'Add to List'}
          </button>
        </form>
      </details>

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
          {/* Checked Items Section - Mobile optimized */}
          {checkedCount > 0 && (
            <div className="bg-white rounded-xl border-2 border-emerald-200 overflow-hidden">
              <button
                onClick={() => setCheckedSectionCollapsed(!checkedSectionCollapsed)}
                className="w-full bg-emerald-50 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-emerald-200 flex items-center justify-between hover:bg-emerald-100 active:bg-emerald-100 transition-colors"
              >
                <h3 className="font-semibold text-sm sm:text-base text-emerald-700 flex items-center gap-2">
                  <span className="text-lg sm:text-xl">✅</span>
                  Checked ({checkedCount})
                </h3>
                <svg
                  className={`w-5 h-5 text-emerald-600 transition-transform ${
                    checkedSectionCollapsed ? '' : 'rotate-180'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {!checkedSectionCollapsed && (
                <div className="divide-y divide-gray-100">
                  {checkedItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 bg-gray-50/50 hover:bg-gray-100 active:bg-gray-100 transition-colors"
                    >
                      <button
                        onClick={() => handleToggleCheck(item)}
                        className="flex-shrink-0 w-7 h-7 sm:w-6 sm:h-6 rounded-lg sm:rounded border-2 flex items-center justify-center hover:border-emerald-600 active:scale-95 transition-all"
                        style={{
                          backgroundColor: '#059669',
                          borderColor: '#059669',
                        }}
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base line-through text-gray-400">{item.name}</p>
                        {(item.quantity > 1 || item.unit) && (
                          <p className="text-xs sm:text-sm text-gray-400">
                            {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-gray-400 mt-0.5 italic line-clamp-1">{item.notes}</p>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 active:text-red-700 transition-colors"
                        title="Delete item"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Unchecked Items by Category or Recipe */}
          {viewMode === 'category' ? (
            sortedCategories.map(category => (
              <div key={category} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-3 sm:px-4 py-2 border-b border-gray-200">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 flex items-center gap-2">
                    <span className="text-lg sm:text-xl">{categoryEmojis[category]}</span>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                    <span className="text-xs sm:text-sm text-gray-400 font-normal">
                      ({groupedUncheckedItems[category].length})
                    </span>
                  </h3>
                </div>

                <div className="divide-y divide-gray-100">
                  {groupedUncheckedItems[category].map(item => (
                    <div key={item.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                      {/* Larger checkbox for mobile */}
                      <button
                        onClick={() => handleToggleCheck(item)}
                        className="flex-shrink-0 w-7 h-7 sm:w-6 sm:h-6 rounded-lg sm:rounded border-2 border-gray-300 flex items-center justify-center hover:border-emerald-500 active:scale-95 transition-all"
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

                      <button
                        onClick={() => handleEditItem(item)}
                        className="flex-1 min-w-0 text-left py-1"
                        title="Click to edit"
                      >
                        <p className="font-medium text-sm sm:text-base text-gray-900">{item.name}</p>
                        {(item.quantity > 1 || item.unit) && (
                          <p className="text-xs sm:text-sm text-gray-500">
                            {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-blue-600 mt-0.5 italic line-clamp-1">{item.notes}</p>
                        )}
                      </button>

                      {/* Action buttons - stacked on mobile */}
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleCouldntFind(item)}
                          className="px-2 py-1.5 text-xs text-amber-600 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 rounded-md transition-colors whitespace-nowrap"
                          title="Couldn't find this item"
                        >
                          Alt?
                        </button>

                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 active:text-red-700 transition-colors"
                          title="Delete item"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            sortedRecipes.map(recipe => (
              <div key={recipe} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-3 sm:px-4 py-2 border-b border-gray-200">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 flex items-center gap-2">
                    <span className="text-lg sm:text-xl">🍽️</span>
                    {recipe}
                    <span className="text-xs sm:text-sm text-gray-400 font-normal">
                      ({groupedByRecipe[recipe].length})
                    </span>
                  </h3>
                </div>

                <div className="divide-y divide-gray-100">
                  {groupedByRecipe[recipe].map(item => (
                    <div key={item.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                      <button
                        onClick={() => handleToggleCheck(item)}
                        className="flex-shrink-0 w-7 h-7 sm:w-6 sm:h-6 rounded-lg sm:rounded border-2 border-gray-300 flex items-center justify-center hover:border-emerald-500 active:scale-95 transition-all"
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

                      <button
                        onClick={() => handleEditItem(item)}
                        className="flex-1 min-w-0 text-left py-1"
                        title="Click to edit"
                      >
                        <p className="font-medium text-sm sm:text-base text-gray-900">{item.name}</p>
                        {(item.quantity > 1 || item.unit) && (
                          <p className="text-xs sm:text-sm text-gray-500">
                            {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-blue-600 mt-0.5 italic line-clamp-1">{item.notes}</p>
                        )}
                      </button>

                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleCouldntFind(item)}
                          className="px-2 py-1.5 text-xs text-amber-600 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 rounded-md transition-colors whitespace-nowrap"
                          title="Couldn't find this item"
                        >
                          Alt?
                        </button>

                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 active:text-red-700 transition-colors"
                          title="Delete item"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit Item Modal - Mobile optimized full screen */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:w-96 sm:rounded-xl rounded-t-2xl max-h-[85vh] overflow-y-auto safe-area-inset-bottom">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-base sm:text-lg text-gray-900">Edit Item</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-600 active:bg-gray-100 rounded-full"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Item Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit</label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="kg, pcs"
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">No category</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>
                      {categoryEmojis[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Brand, type preference..."
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-2 pb-4">
                <button
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editName.trim() || saving}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alternatives Modal - Mobile optimized */}
      {alternativesItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:w-96 sm:rounded-xl rounded-t-2xl max-h-[85vh] overflow-y-auto safe-area-inset-bottom">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-base sm:text-lg text-gray-900">
                Can&apos;t find {alternativesItem.name}?
              </h3>
              <button
                onClick={() => {
                  setAlternativesItem(null)
                  setAlternatives([])
                }}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-600 active:bg-gray-100 rounded-full"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4">
              {alternativesLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm sm:text-base text-gray-500">Finding alternatives...</p>
                </div>
              ) : alternatives.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
                    Here are some substitutes you could use instead:
                  </p>

                  {alternatives.map((alt, index) => (
                    <button
                      key={index}
                      onClick={() => handleUseAlternative(alt)}
                      disabled={saving}
                      className="w-full p-3 sm:p-4 text-left bg-gray-50 hover:bg-emerald-50 active:bg-emerald-100 rounded-xl border border-gray-200 hover:border-emerald-300 transition-colors disabled:opacity-50"
                    >
                      <p className="font-medium text-sm sm:text-base text-gray-900">{alt.name}</p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{alt.reason}</p>
                    </button>
                  ))}

                  <div className="border-t border-gray-200 pt-3 mt-4 pb-4">
                    <button
                      onClick={handleSkipItem}
                      disabled={saving}
                      className="w-full p-3 text-center text-red-600 hover:bg-red-50 active:bg-red-100 rounded-xl transition-colors disabled:opacity-50 text-sm sm:text-base"
                    >
                      Skip this ingredient
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 pb-12">
                  <p className="text-sm sm:text-base text-gray-500">No alternatives found.</p>
                  <button
                    onClick={handleSkipItem}
                    className="mt-4 px-4 py-3 text-red-600 hover:bg-red-50 active:bg-red-100 rounded-xl transition-colors text-sm sm:text-base"
                  >
                    Skip this ingredient
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
