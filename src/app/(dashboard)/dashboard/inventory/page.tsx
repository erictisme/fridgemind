'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface InventoryItem {
  id: string
  name: string
  storage_category: string
  nutritional_type: string
  location: string
  quantity: number
  unit: string
  expiry_date: string
  freshness: string
  confidence: number
}

type LocationFilter = 'all' | 'fridge' | 'freezer' | 'pantry'

// Color mappings for fun UI
const locationColors: Record<string, { bg: string; border: string }> = {
  fridge: { bg: 'bg-sky-50', border: 'border-sky-200' },
  freezer: { bg: 'bg-indigo-50', border: 'border-indigo-200' },
  pantry: { bg: 'bg-amber-50', border: 'border-amber-200' },
}

// Food emojis for nutritional types (with backward compatibility)
const nutritionalEmojis: Record<string, string> = {
  protein: '🍖',
  carbs: '🍞',
  fibre: '🥬',
  misc: '📦',
  // Legacy mappings for existing data
  vegetables: '🥬',
  vitamins: '🥬',
  fats: '📦',
  other: '📦',
}

const STORAGE_CATEGORIES = ['produce', 'dairy', 'protein', 'pantry', 'beverage', 'condiment', 'frozen'] as const
const NUTRITIONAL_TYPES = ['protein', 'carbs', 'fibre', 'misc'] as const
const FRESHNESS_LEVELS = ['fresh', 'good', 'use_soon', 'expiring'] as const

const LOCATIONS = ['fridge', 'freezer', 'pantry'] as const

// Default values for new item
const getDefaultNewItem = () => ({
  name: '',
  storage_category: 'produce' as string,
  nutritional_type: 'fibre' as string,
  location: 'fridge' as string,
  quantity: 1,
  unit: 'piece',
  expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  freshness: 'fresh',
  confidence: 1,
})

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newItem, setNewItem] = useState(getDefaultNewItem())

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    try {
      const response = await fetch('/api/inventory')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setItems(data.items || [])
    } catch {
      setError('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  const handleCardClick = (item: InventoryItem) => {
    if (expandedId === item.id) {
      setExpandedId(null)
      setEditingItem(null)
    } else {
      setExpandedId(item.id)
      setEditingItem({ ...item })
    }
  }

  const handleSave = async () => {
    if (!editingItem) return
    setSaving(true)

    try {
      const response = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem),
      })

      if (!response.ok) throw new Error('Failed to save')

      // Update local state
      setItems(prev => prev.map(item =>
        item.id === editingItem.id ? editingItem : item
      ))
      setExpandedId(null)
      setEditingItem(null)
    } catch {
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItem.name.trim()) {
      setError('Please enter an item name')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [newItem],
          location: newItem.location,
        }),
      })

      if (!response.ok) throw new Error('Failed to add item')

      // Refresh inventory
      await fetchInventory()
      setShowAddForm(false)
      setNewItem(getDefaultNewItem())
    } catch {
      setError('Failed to add item')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (reason: 'consumed' | 'wasted' | 'wrong_entry') => {
    if (!editingItem) return

    setSaving(true)
    setShowRemoveDialog(false)

    try {
      const response = await fetch('/api/inventory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem.id,
          reason,
          itemName: editingItem.name,
          category: editingItem.storage_category,
          quantity: editingItem.quantity,
        }),
      })

      if (!response.ok) throw new Error('Failed to remove')

      // Update local state
      setItems(prev => prev.filter(item => item.id !== editingItem.id))
      setExpandedId(null)
      setEditingItem(null)
    } catch {
      setError('Failed to remove item')
    } finally {
      setSaving(false)
    }
  }

  const updateEditingItem = (field: keyof InventoryItem, value: string | number) => {
    if (!editingItem) return
    setEditingItem({ ...editingItem, [field]: value })
  }

  const filteredItems = locationFilter === 'all'
    ? items
    : items.filter(item => item.location === locationFilter)

  const getExpiryStatus = (expiryDate: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiry = new Date(expiryDate)
    const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntil <= 0) return { label: 'Expired', color: 'bg-red-500 text-white', urgent: true }
    if (daysUntil <= 2) return { label: `${daysUntil}d left`, color: 'bg-red-400 text-white', urgent: true }
    if (daysUntil <= 5) return { label: `${daysUntil}d left`, color: 'bg-amber-400 text-white', urgent: false }
    return { label: `${daysUntil}d left`, color: 'bg-emerald-400 text-white', urgent: false }
  }

  const locationCounts = {
    all: items.length,
    fridge: items.filter(i => i.location === 'fridge').length,
    freezer: items.filter(i => i.location === 'freezer').length,
    pantry: items.filter(i => i.location === 'pantry').length,
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500">{items.length} items tracked</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            + Add Item
          </button>
          <Link
            href="/dashboard/scan"
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
            Scan
          </Link>
        </div>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg border-2 border-emerald-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Add New Item</h2>
            <button
              onClick={() => { setShowAddForm(false); setNewItem(getDefaultNewItem()) }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="e.g., Milk, Chicken breast, Apples"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select
                value={newItem.location}
                onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
              >
                {LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc.charAt(0).toUpperCase() + loc.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Servings</label>
              <input
                type="number"
                min="1"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={newItem.storage_category}
                onChange={(e) => setNewItem({ ...newItem, storage_category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
              >
                {STORAGE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Nutritional Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={newItem.nutritional_type}
                onChange={(e) => setNewItem({ ...newItem, nutritional_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
              >
                {NUTRITIONAL_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
              <input
                type="date"
                value={newItem.expiry_date}
                onChange={(e) => setNewItem({ ...newItem, expiry_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
              />
            </div>
          </div>

          {/* Add button */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAddItem}
              disabled={saving || !newItem.name.trim()}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Item'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewItem(getDefaultNewItem()) }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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

      {/* Location filter tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['all', 'fridge', 'freezer', 'pantry'] as const).map(loc => (
          <button
            key={loc}
            onClick={() => setLocationFilter(loc)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              locationFilter === loc
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {loc === 'all' ? 'All' : loc.charAt(0).toUpperCase() + loc.slice(1)}
            <span className="ml-1 text-gray-400">({locationCounts[loc]})</span>
          </button>
        ))}
      </div>

      {/* Items grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          </div>
          <p className="text-gray-500 mb-4">No items in your inventory yet</p>
          <Link
            href="/dashboard/scan"
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Scan your fridge
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map(item => {
            const expiryStatus = getExpiryStatus(item.expiry_date)
            const locColor = locationColors[item.location] || { bg: 'bg-gray-50', border: 'border-gray-200' }
            const nutritionEmoji = nutritionalEmojis[item.nutritional_type] || '📦'
            const isExpanded = expandedId === item.id

            return (
              <div
                key={item.id}
                className={`rounded-xl border-2 transition-all ${locColor.bg} ${locColor.border} ${
                  isExpanded ? 'ring-2 ring-emerald-500' : 'hover:shadow-md cursor-pointer'
                }`}
              >
                {/* Card header - clickable */}
                <div
                  onClick={() => handleCardClick(item)}
                  className="p-4 cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{nutritionEmoji}</span>
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${expiryStatus.color}`}>
                      {expiryStatus.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className="text-sm px-2 py-1 bg-white/70 rounded-lg text-gray-700 font-medium">
                      {item.quantity} {item.quantity === 1 ? 'serving' : 'servings'}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500">
                    Expires: {new Date(item.expiry_date).toLocaleDateString()}
                  </p>

                  {/* Expand hint */}
                  <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {isExpanded ? 'Collapse' : 'Tap to edit'}
                  </div>
                </div>

                {/* Edit form - expanded */}
                {isExpanded && editingItem && (
                  <div className="border-t-2 border-current/10 p-4 bg-white/50 space-y-3">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                      <input
                        type="text"
                        value={editingItem.name}
                        onChange={(e) => updateEditingItem('name', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                      />
                    </div>

                    {/* Quantity (servings) */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Servings</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editingItem.quantity}
                        onChange={(e) => updateEditingItem('quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                      />
                    </div>

                    {/* Category + Nutritional row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                        <select
                          value={editingItem.storage_category}
                          onChange={(e) => updateEditingItem('storage_category', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                        >
                          {STORAGE_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nutritional</label>
                        <select
                          value={editingItem.nutritional_type}
                          onChange={(e) => updateEditingItem('nutritional_type', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                        >
                          {NUTRITIONAL_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Expiry + Freshness row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
                        <input
                          type="date"
                          value={editingItem.expiry_date?.split('T')[0] || ''}
                          onChange={(e) => updateEditingItem('expiry_date', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Freshness</label>
                        <select
                          value={editingItem.freshness}
                          onChange={(e) => updateEditingItem('freshness', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                        >
                          {FRESHNESS_LEVELS.map(level => (
                            <option key={level} value={level}>{level.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setShowRemoveDialog(true)}
                        disabled={saving}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => { setExpandedId(null); setEditingItem(null); setShowRemoveDialog(false) }}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Remove dialog */}
                    {showRemoveDialog && (
                      <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                        <p className="text-sm text-gray-700 mb-3">Why are you removing this item?</p>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleRemove('consumed')}
                            disabled={saving}
                            className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
                          >
                            Ate it
                          </button>
                          <button
                            onClick={() => handleRemove('wasted')}
                            disabled={saving}
                            className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                          >
                            Went bad
                          </button>
                          <button
                            onClick={() => handleRemove('wrong_entry')}
                            disabled={saving}
                            className="px-3 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 disabled:opacity-50"
                          >
                            Wrong entry
                          </button>
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
    </div>
  )
}
