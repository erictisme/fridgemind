'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface InventoryItem {
  id: string
  name: string
  storage_category: string // kept for backward compatibility
  nutritional_type: string
  location: string
  quantity: number
  unit: string
  purchase_date: string | null
  expiry_date: string
  freshness: string
  confidence: number
  added_date?: string
}

type LocationFilter = 'all' | 'fridge' | 'freezer' | 'pantry'

// Food emojis for types
const typeEmojis: Record<string, string> = {
  protein: '🍖',
  carbs: '🍞',
  fibre: '🥬',
  misc: '📦',
  // Legacy
  vegetables: '🥬',
  vitamins: '🥬',
  fats: '📦',
  other: '📦',
}

const TYPES = ['protein', 'carbs', 'fibre', 'misc'] as const
const LOCATIONS = ['fridge', 'freezer', 'pantry'] as const
const FRESHNESS_LEVELS = ['fresh', 'use_soon', 'expired'] as const

// Default shelf life in days based on type + location
const getDefaultExpiryDays = (type: string, location: string): number => {
  if (location === 'freezer') return 30
  if (location === 'pantry') {
    if (type === 'carbs') return 14
    return 30
  }
  // Fridge
  switch (type) {
    case 'protein': return 4
    case 'fibre': return 7
    case 'carbs': return 7
    case 'misc': return 14
    default: return 7
  }
}

// Calculate expiry date from added date
const calcExpiryDate = (addedDate: string, type: string, location: string): string => {
  const days = getDefaultExpiryDays(type, location)
  const date = new Date(addedDate)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

// Get freshness status from expiry date
const getFreshnessStatus = (expiryDate: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntil <= 0) return {
    label: 'Expired',
    color: 'bg-gray-800 text-white',
    cardBorder: 'border-gray-600',
    cardBg: 'bg-gray-100',
    days: daysUntil
  }
  if (daysUntil <= 2) return {
    label: `${daysUntil}d`,
    color: 'bg-red-600 text-white',
    cardBorder: 'border-red-400',
    cardBg: 'bg-red-50',
    days: daysUntil
  }
  if (daysUntil <= 5) return {
    label: `${daysUntil}d`,
    color: 'bg-orange-500 text-white',
    cardBorder: 'border-orange-300',
    cardBg: 'bg-orange-50',
    days: daysUntil
  }
  return {
    label: `${daysUntil}d`,
    color: 'bg-emerald-500 text-white',
    cardBorder: 'border-emerald-300',
    cardBg: 'bg-emerald-50',
    days: daysUntil
  }
}

// Default values for new item
const getDefaultNewItem = () => {
  const today = new Date().toISOString().split('T')[0]
  return {
    name: '',
    nutritional_type: 'misc' as string,
    location: 'fridge' as string,
    quantity: 1,
    added_date: today,
    expiry_date: calcExpiryDate(today, 'misc', 'fridge'),
  }
}

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
  const [showLegend, setShowLegend] = useState(false)
  const [estimatingExpiry, setEstimatingExpiry] = useState(false)
  const estimateAbortRef = useRef<AbortController | null>(null)

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
          items: [{
            name: newItem.name,
            storage_category: newItem.nutritional_type, // use type as category for simplicity
            nutritional_type: newItem.nutritional_type,
            location: newItem.location,
            quantity: newItem.quantity,
            unit: 'serving',
            expiry_date: newItem.expiry_date,
            freshness: 'fresh',
            confidence: 1,
          }],
          location: newItem.location,
        }),
      })

      if (!response.ok) throw new Error('Failed to add item')

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
          category: editingItem.nutritional_type,
          quantity: editingItem.quantity,
        }),
      })

      if (!response.ok) throw new Error('Failed to remove')

      setItems(prev => prev.filter(item => item.id !== editingItem.id))
      setExpandedId(null)
      setEditingItem(null)
    } catch {
      setError('Failed to remove item')
    } finally {
      setSaving(false)
    }
  }

  // Auto-update expiry when type or location changes in add form
  const updateNewItem = (field: string, value: string | number) => {
    const updated = { ...newItem, [field]: value }

    // Auto-recalculate expiry when type or location changes
    if (field === 'nutritional_type' || field === 'location') {
      updated.expiry_date = calcExpiryDate(
        updated.added_date,
        field === 'nutritional_type' ? value as string : updated.nutritional_type,
        field === 'location' ? value as string : updated.location
      )
    }
    // Recalc expiry when added_date changes
    if (field === 'added_date') {
      updated.expiry_date = calcExpiryDate(value as string, updated.nutritional_type, updated.location)
    }

    setNewItem(updated)
  }

  const updateEditingItem = (field: keyof InventoryItem, value: string | number | null) => {
    if (!editingItem) return
    setEditingItem({ ...editingItem, [field]: value })
  }

  const handlePurchaseDateChange = async (purchaseDate: string) => {
    if (!editingItem) return

    // Update purchase date immediately
    setEditingItem(prev => prev ? { ...prev, purchase_date: purchaseDate || null } : null)

    // If clearing the date, don't estimate
    if (!purchaseDate) return

    // Cancel any pending estimation request
    if (estimateAbortRef.current) {
      estimateAbortRef.current.abort()
    }

    // Auto-estimate expiry using Gemini
    const abortController = new AbortController()
    estimateAbortRef.current = abortController

    setEstimatingExpiry(true)
    try {
      const response = await fetch('/api/estimate-expiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: editingItem.name,
          location: editingItem.location,
          purchaseDate,
        }),
        signal: abortController.signal,
      })

      if (response.ok) {
        const estimate = await response.json()
        setEditingItem(prev => prev ? {
          ...prev,
          expiry_date: estimate.expiry_date,
        } : null)
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Failed to estimate expiry:', err)
      }
    } finally {
      setEstimatingExpiry(false)
    }
  }

  const filteredItems = locationFilter === 'all'
    ? items
    : items.filter(item => item.location === locationFilter)

  // Sort by expiry date (soonest first)
  const sortedItems = [...filteredItems].sort((a, b) =>
    new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
  )

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500">{items.length} items</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            + Add
          </button>
          <Link
            href="/dashboard/scan"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Scan
          </Link>
        </div>
      </div>

      {/* Freshness Legend */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <span className="text-lg">🚦</span>
          {showLegend ? 'Hide legend' : 'Freshness guide'}
        </button>
        {showLegend && (
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              Fresh (5+d)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-orange-500"></span>
              Use soon (3-5d)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-600"></span>
              Expiring (1-2d)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-gray-800"></span>
              Expired
            </span>
          </div>
        )}
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg border-2 border-emerald-300 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Add Item</h2>
            <button
              onClick={() => { setShowAddForm(false); setNewItem(getDefaultNewItem()) }}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Name - full width */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => updateNewItem('name', e.target.value)}
                placeholder="e.g., Chicken, Milk, Apples"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                autoFocus
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={newItem.nutritional_type}
                onChange={(e) => updateNewItem('nutritional_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
              >
                {TYPES.map(type => (
                  <option key={type} value={type}>
                    {typeEmojis[type]} {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select
                value={newItem.location}
                onChange={(e) => updateNewItem('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
              >
                {LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc.charAt(0).toUpperCase() + loc.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Servings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Servings</label>
              <input
                type="number"
                min="1"
                value={newItem.quantity}
                onChange={(e) => updateNewItem('quantity', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
              />
            </div>

            {/* Added Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Added</label>
              <input
                type="date"
                value={newItem.added_date}
                onChange={(e) => updateNewItem('added_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
              />
            </div>

            {/* Expiry - auto calculated but editable */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry <span className="text-gray-400 font-normal">(auto-calculated, adjust if needed)</span>
              </label>
              <input
                type="date"
                value={newItem.expiry_date}
                onChange={(e) => setNewItem({ ...newItem, expiry_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
              />
            </div>
          </div>

          {/* Add button */}
          <div className="flex gap-2">
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
        <div className="p-3 bg-red-50 text-red-700 rounded-lg flex justify-between items-center text-sm">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Location filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['all', 'fridge', 'freezer', 'pantry'] as const).map(loc => (
          <button
            key={loc}
            onClick={() => setLocationFilter(loc)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
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
      {sortedItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🧊</div>
          <p className="text-gray-500 mb-4">No items yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Add your first item
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedItems.map(item => {
            const status = getFreshnessStatus(item.expiry_date)
            const emoji = typeEmojis[item.nutritional_type] || '📦'
            const isExpanded = expandedId === item.id

            return (
              <div
                key={item.id}
                className={`rounded-xl border-2 transition-all ${status.cardBg} ${status.cardBorder} ${
                  isExpanded ? 'ring-2 ring-emerald-500' : 'hover:shadow-md cursor-pointer'
                }`}
              >
                {/* Card header */}
                <div onClick={() => handleCardClick(item)} className="p-3 cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl flex-shrink-0">{emoji}</span>
                      <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${status.color} flex-shrink-0`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <span>{item.quantity} serving{item.quantity !== 1 ? 's' : ''}</span>
                    <span className="text-gray-300">•</span>
                    <span className="capitalize">{item.location}</span>
                  </div>

                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    {item.purchase_date && (
                      <p>Bought: {new Date(item.purchase_date).toLocaleDateString()}</p>
                    )}
                    <p>Expires: {new Date(item.expiry_date).toLocaleDateString()}</p>
                  </div>

                  {/* Expand hint */}
                  <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {isExpanded ? 'Collapse' : 'Tap to edit'}
                  </div>
                </div>

                {/* Edit form */}
                {isExpanded && editingItem && (
                  <div className="border-t border-gray-200 p-3 bg-white/80 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                      <input
                        type="text"
                        value={editingItem.name}
                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Servings</label>
                        <input
                          type="number"
                          min="0"
                          value={editingItem.quantity}
                          onChange={(e) => setEditingItem({ ...editingItem, quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                        <select
                          value={editingItem.nutritional_type}
                          onChange={(e) => setEditingItem({ ...editingItem, nutritional_type: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                        >
                          {TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Purchase Date + Auto-estimate expiry */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Purchase Date
                        <span className="text-gray-400 font-normal ml-1">(auto-estimates expiry)</span>
                      </label>
                      <input
                        type="date"
                        value={editingItem.purchase_date?.split('T')[0] || ''}
                        onChange={(e) => handlePurchaseDateChange(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                      />
                    </div>

                    {/* Expiry + Freshness row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Expiry Date
                          {estimatingExpiry && (
                            <span className="ml-2 text-emerald-600 animate-pulse">estimating...</span>
                          )}
                        </label>
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
                    <div className="flex gap-2 pt-1">
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
                        className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => { setExpandedId(null); setEditingItem(null); setShowRemoveDialog(false) }}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                      >
                        ×
                      </button>
                    </div>

                    {/* Remove dialog */}
                    {showRemoveDialog && (
                      <div className="mt-2 p-3 bg-gray-100 rounded-lg">
                        <p className="text-sm text-gray-700 mb-2">Why removing?</p>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleRemove('consumed')}
                            disabled={saving}
                            className="px-2 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 disabled:opacity-50"
                          >
                            Ate it
                          </button>
                          <button
                            onClick={() => handleRemove('wasted')}
                            disabled={saving}
                            className="px-2 py-2 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-50"
                          >
                            Went bad
                          </button>
                          <button
                            onClick={() => handleRemove('wrong_entry')}
                            disabled={saving}
                            className="px-2 py-2 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 disabled:opacity-50"
                          >
                            Wrong
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
