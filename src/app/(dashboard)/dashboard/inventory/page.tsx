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

// Smart food emoji based on item name
const getFoodEmoji = (name: string, type: string): string => {
  const lowerName = name.toLowerCase()

  // Fruits
  if (/apple|apples/.test(lowerName)) return '🍎'
  if (/banana|bananas/.test(lowerName)) return '🍌'
  if (/orange|oranges|mandarin/.test(lowerName)) return '🍊'
  if (/lemon|lemons/.test(lowerName)) return '🍋'
  if (/grape|grapes/.test(lowerName)) return '🍇'
  if (/strawberr/.test(lowerName)) return '🍓'
  if (/blueberr|berry|berries/.test(lowerName)) return '🫐'
  if (/cherry|cherries/.test(lowerName)) return '🍒'
  if (/peach/.test(lowerName)) return '🍑'
  if (/pear/.test(lowerName)) return '🍐'
  if (/watermelon/.test(lowerName)) return '🍉'
  if (/melon/.test(lowerName)) return '🍈'
  if (/pineapple/.test(lowerName)) return '🍍'
  if (/mango/.test(lowerName)) return '🥭'
  if (/coconut/.test(lowerName)) return '🥥'
  if (/kiwi/.test(lowerName)) return '🥝'
  if (/avocado/.test(lowerName)) return '🥑'
  if (/tomato|tomatoes/.test(lowerName)) return '🍅'

  // Vegetables
  if (/broccoli/.test(lowerName)) return '🥦'
  if (/carrot|carrots/.test(lowerName)) return '🥕'
  if (/corn/.test(lowerName)) return '🌽'
  if (/potato|potatoes/.test(lowerName)) return '🥔'
  if (/sweet potato/.test(lowerName)) return '🍠'
  if (/onion/.test(lowerName)) return '🧅'
  if (/garlic/.test(lowerName)) return '🧄'
  if (/pepper|capsicum|bell pepper/.test(lowerName)) return '🫑'
  if (/chili|chilli/.test(lowerName)) return '🌶️'
  if (/cucumber/.test(lowerName)) return '🥒'
  if (/lettuce|salad|greens|spinach|kale/.test(lowerName)) return '🥬'
  if (/cabbage/.test(lowerName)) return '🥬'
  if (/eggplant|aubergine/.test(lowerName)) return '🍆'
  if (/mushroom/.test(lowerName)) return '🍄'
  if (/pea|peas/.test(lowerName)) return '🫛'
  if (/bean|beans|edamame/.test(lowerName)) return '🫘'
  if (/ginger/.test(lowerName)) return '🫚'

  // Proteins
  if (/chicken/.test(lowerName)) return '🍗'
  if (/beef|steak/.test(lowerName)) return '🥩'
  if (/pork|bacon/.test(lowerName)) return '🥓'
  if (/fish|salmon|tuna|cod/.test(lowerName)) return '🐟'
  if (/shrimp|prawn/.test(lowerName)) return '🦐'
  if (/crab/.test(lowerName)) return '🦀'
  if (/lobster/.test(lowerName)) return '🦞'
  if (/egg/.test(lowerName)) return '🥚'
  if (/tofu/.test(lowerName)) return '🧈'

  // Dairy
  if (/milk/.test(lowerName)) return '🥛'
  if (/cheese/.test(lowerName)) return '🧀'
  if (/butter/.test(lowerName)) return '🧈'
  if (/yogurt|yoghurt/.test(lowerName)) return '🥛'

  // Carbs
  if (/bread|toast/.test(lowerName)) return '🍞'
  if (/rice/.test(lowerName)) return '🍚'
  if (/pasta|noodle|spaghetti/.test(lowerName)) return '🍝'
  if (/cereal|oat/.test(lowerName)) return '🥣'
  if (/croissant/.test(lowerName)) return '🥐'
  if (/bagel/.test(lowerName)) return '🥯'
  if (/pancake|waffle/.test(lowerName)) return '🥞'

  // Misc foods
  if (/honey/.test(lowerName)) return '🍯'
  if (/chocolate/.test(lowerName)) return '🍫'
  if (/cookie|biscuit/.test(lowerName)) return '🍪'
  if (/cake/.test(lowerName)) return '🍰'
  if (/ice cream/.test(lowerName)) return '🍨'
  if (/candy|sweet/.test(lowerName)) return '🍬'
  if (/pizza/.test(lowerName)) return '🍕'
  if (/burger/.test(lowerName)) return '🍔'
  if (/sandwich/.test(lowerName)) return '🥪'
  if (/taco/.test(lowerName)) return '🌮'
  if (/burrito/.test(lowerName)) return '🌯'
  if (/sushi/.test(lowerName)) return '🍣'
  if (/soup/.test(lowerName)) return '🍲'
  if (/salad/.test(lowerName)) return '🥗'
  if (/sauce/.test(lowerName)) return '🫙'
  if (/oil/.test(lowerName)) return '🫒'
  if (/juice/.test(lowerName)) return '🧃'
  if (/coffee/.test(lowerName)) return '☕'
  if (/tea/.test(lowerName)) return '🍵'
  if (/wine/.test(lowerName)) return '🍷'
  if (/beer/.test(lowerName)) return '🍺'

  // Default by type
  const typeDefaults: Record<string, string> = {
    protein: '🍖',
    carbs: '🍞',
    fibre: '🥬',
    misc: '📦',
    vegetables: '🥬',
    vitamins: '🥬',
    fats: '📦',
    other: '📦',
  }
  return typeDefaults[type] || '📦'
}

// Simple type emojis for dropdowns
const typeEmojis: Record<string, string> = {
  protein: '🍖',
  carbs: '🍞',
  fibre: '🥬',
  misc: '📦',
}

const TYPES = ['protein', 'carbs', 'fibre', 'misc'] as const
const LOCATIONS = ['fridge', 'freezer', 'pantry'] as const
const FRESHNESS_LEVELS = ['fresh', 'use_soon', 'expired'] as const
const UNITS = ['serving', 'pc', 'g', 'kg', 'ml', 'L', 'pack', 'bunch', 'bag', 'bottle', 'carton', 'can', 'jar'] as const

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
    unit: 'serving' as string,
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

  // Paste list state
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteLocation, setPasteLocation] = useState<'fridge' | 'freezer' | 'pantry'>('fridge')
  const [parsedItems, setParsedItems] = useState<Array<{
    name: string
    quantity: number
    unit: string
    type: string
    selected: boolean
  }>>([])
  const [parsing, setParsing] = useState(false)
  const [pasteStep, setPasteStep] = useState<'input' | 'review'>('input')
  const [pasteMode, setPasteMode] = useState<'add' | 'replace'>('add')

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
            unit: newItem.unit,
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

  // Paste list functions
  const handleParseText = async () => {
    if (!pasteText.trim()) return

    setParsing(true)
    try {
      const res = await fetch('/api/inventory/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to parse text')
        setParsing(false)
        return
      }

      if (data.items && data.items.length > 0) {
        setParsedItems(data.items.map((item: { name: string; quantity: number; unit: string; type: string }) => ({
          ...item,
          selected: true,
        })))
        setPasteStep('review')
      } else {
        setError('No items found in the text')
      }
    } catch {
      setError('Failed to parse text')
    }
    setParsing(false)
  }

  const handleAddParsedItems = async () => {
    const selectedItems = parsedItems.filter(item => item.selected)
    if (selectedItems.length === 0) return

    // Double-confirm for replace mode
    if (pasteMode === 'replace') {
      const locationCount = items.filter(i => i.location === pasteLocation).length
      if (locationCount > 0) {
        const confirmed = window.confirm(
          `WARNING: This will permanently delete ALL ${locationCount} items in your ${pasteLocation} and replace them with ${selectedItems.length} new items.\n\nThis action CANNOT be undone.\n\nAre you absolutely sure?`
        )
        if (!confirmed) return
      }
    }

    setSaving(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const itemsToAdd = selectedItems.map(item => ({
        name: item.name,
        storage_category: item.type,
        nutritional_type: item.type,
        location: pasteLocation,
        quantity: item.quantity,
        unit: item.unit,
        expiry_date: calcExpiryDate(today, item.type, pasteLocation),
        freshness: 'fresh',
        confidence: 0.9,
      }))

      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToAdd,
          location: pasteLocation,
          syncMode: pasteMode === 'replace', // true = replace all in location
        }),
      })

      if (!res.ok) throw new Error('Failed to add items')

      await fetchInventory()
      closePasteModal()
    } catch {
      setError('Failed to add items')
    }
    setSaving(false)
  }

  const closePasteModal = () => {
    setShowPasteModal(false)
    setPasteText('')
    setParsedItems([])
    setPasteStep('input')
    setPasteLocation('fridge')
    setPasteMode('add')
  }

  const toggleParsedItem = (index: number) => {
    setParsedItems(prev => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    ))
  }

  const updateParsedItem = (index: number, field: string, value: string | number) => {
    setParsedItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ))
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
    <div className="space-y-3 pb-20">
      {/* Mobile-optimized Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500">{items.length} items</p>
        </div>
        {/* Action buttons - 2x2 grid on mobile */}
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 font-medium text-xs sm:text-sm"
          >
            + Add
          </button>
          <button
            onClick={() => setShowPasteModal(true)}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 font-medium text-xs sm:text-sm"
          >
            📋 Paste
          </button>
          <Link
            href="/dashboard/groceries?tab=upload"
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 font-medium text-xs sm:text-sm text-center"
          >
            🧾 Receipt
          </Link>
          <Link
            href="/dashboard/scan"
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:bg-emerald-800 text-xs sm:text-sm text-center"
          >
            📸 Scan
          </Link>
        </div>
      </div>

      {/* Freshness Legend - Collapsible */}
      <button
        onClick={() => setShowLegend(!showLegend)}
        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        <span>🚦</span>
        <span>{showLegend ? 'Hide' : 'Freshness guide'}</span>
        <svg className={`w-3 h-3 transition-transform ${showLegend ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {showLegend && (
        <div className="flex flex-wrap gap-2 text-xs bg-gray-50 p-2 rounded-lg">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Fresh (5+d)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            Soon (3-5d)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            Expiring (1-2d)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-800"></span>
            Expired
          </span>
        </div>
      )}

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

            {/* Quantity + Unit */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={newItem.quantity}
                  onChange={(e) => updateNewItem('quantity', parseInt(e.target.value) || 1)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                />
                <select
                  value={newItem.unit}
                  onChange={(e) => updateNewItem('unit', e.target.value)}
                  className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                >
                  {UNITS.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
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

      {/* Location filter tabs - horizontal scroll on mobile */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-gray-200 -mx-1 px-1">
        {(['all', 'fridge', 'freezer', 'pantry'] as const).map(loc => (
          <button
            key={loc}
            onClick={() => setLocationFilter(loc)}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              locationFilter === loc
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {loc === 'all' ? 'All' : loc.charAt(0).toUpperCase() + loc.slice(1)}
            <span className="ml-1 text-xs text-gray-400">({locationCounts[loc]})</span>
          </button>
        ))}
      </div>

      {/* Items List - Mobile-first simple list */}
      {sortedItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🧊</div>
          <p className="text-gray-500 mb-4">No items yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:bg-emerald-800"
          >
            Add your first item
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {sortedItems.map(item => {
            const status = getFreshnessStatus(item.expiry_date)
            const emoji = getFoodEmoji(item.name, item.nutritional_type)
            const isExpanded = expandedId === item.id

            return (
              <div key={item.id} className={isExpanded ? 'bg-gray-50' : ''}>
                {/* List item row */}
                <div
                  onClick={() => handleCardClick(item)}
                  className={`flex items-center gap-3 px-3 py-3 cursor-pointer active:bg-gray-50 transition-colors ${
                    status.days <= 0 ? 'opacity-60' : ''
                  }`}
                >
                  {/* Freshness indicator dot */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    status.days <= 0 ? 'bg-gray-600' :
                    status.days <= 2 ? 'bg-red-500' :
                    status.days <= 5 ? 'bg-orange-500' : 'bg-emerald-500'
                  }`} />

                  {/* Emoji */}
                  <span className="text-lg flex-shrink-0">{emoji}</span>

                  {/* Name and details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <h3 className={`font-medium text-gray-900 truncate ${status.days <= 0 ? 'line-through' : ''}`}>
                        {item.name}
                      </h3>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {item.quantity}{item.unit && item.unit !== 'serving' ? ` ${item.unit}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="capitalize">{item.location}</span>
                      <span>•</span>
                      <span>{new Date(item.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${status.color}`}>
                    {status.label}
                  </span>

                  {/* Chevron */}
                  <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded edit form */}
                {isExpanded && editingItem && (
                  <div className="px-3 pb-3 space-y-2 bg-gray-50 border-t border-gray-200">
                    {/* Primary quick actions */}
                    <div className="flex gap-2 pt-3">
                      <button
                        onClick={() => handleRemove('consumed')}
                        disabled={saving}
                        className="flex-1 px-3 py-3 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50"
                      >
                        ✓ Ate it
                      </button>
                      <button
                        onClick={() => handleRemove('wasted')}
                        disabled={saving}
                        className="flex-1 px-3 py-3 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50"
                      >
                        🗑 Went bad
                      </button>
                    </div>

                    {/* Secondary actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRemove('wrong_entry')}
                        disabled={saving}
                        className="flex-1 px-3 py-2 bg-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-300 active:bg-gray-400 disabled:opacity-50"
                      >
                        Wrong entry
                      </button>
                      <button
                        onClick={() => { setExpandedId(null); setEditingItem(null); setShowRemoveDialog(false) }}
                        className="flex-1 px-3 py-2 bg-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-300 active:bg-gray-400"
                      >
                        Still OK
                      </button>
                    </div>

                    {/* Edit fields - collapsible */}
                    <details className="group pt-1">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 list-none flex items-center gap-1 py-1">
                        <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Edit details
                      </summary>

                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                          <input
                            type="text"
                            value={editingItem.name}
                            onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base text-gray-900 bg-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={editingItem.quantity}
                              onChange={(e) => setEditingItem({ ...editingItem, quantity: parseFloat(e.target.value) || 0 })}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base text-gray-900 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                            <select
                              value={editingItem.location}
                              onChange={(e) => setEditingItem({ ...editingItem, location: e.target.value })}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base text-gray-900 bg-white"
                            >
                              {LOCATIONS.map(loc => (
                                <option key={loc} value={loc}>{loc.charAt(0).toUpperCase() + loc.slice(1)}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Purchase Date
                            <span className="text-gray-400 font-normal ml-1">(auto-estimates expiry)</span>
                          </label>
                          <input
                            type="date"
                            value={editingItem.purchase_date?.split('T')[0] || ''}
                            onChange={(e) => handlePurchaseDateChange(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base text-gray-900 bg-white appearance-none"
                            style={{ minHeight: '44px' }}
                          />
                        </div>

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
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base text-gray-900 bg-white appearance-none"
                            style={{ minHeight: '44px' }}
                          />
                        </div>

                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="w-full px-3 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Paste List Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {pasteStep === 'input' ? '📋 Paste Grocery List' : '✅ Review Items'}
              </h2>
              <button
                onClick={closePasteModal}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">
              {pasteStep === 'input' ? (
                <>
                  <p className="text-sm text-gray-600">
                    Paste any text with grocery items - delivery confirmations, shopping lists, recipes, etc.
                    AI will extract the items for you.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Storage Location
                    </label>
                    <select
                      value={pasteLocation}
                      onChange={(e) => setPasteLocation(e.target.value as 'fridge' | 'freezer' | 'pantry')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                    >
                      <option value="fridge">🧊 Fridge</option>
                      <option value="freezer">❄️ Freezer</option>
                      <option value="pantry">🗄️ Pantry</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Paste your list here
                    </label>
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder={`Example:
Avocado (1pc) x 1
Tomato (Cherry) (500g) x 1
Broccoli (350g) x 1
2 chicken breasts
1L milk`}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white resize-none"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleParseText}
                      disabled={parsing || !pasteText.trim()}
                      className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {parsing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Processing...
                        </>
                      ) : (
                        '✨ Extract Items'
                      )}
                    </button>
                    <button
                      onClick={closePasteModal}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      {parsedItems.filter(i => i.selected).length} of {parsedItems.length} items selected
                    </p>
                    <button
                      onClick={() => setPasteStep('input')}
                      className="text-sm text-emerald-600 hover:text-emerald-700"
                    >
                      ← Back to edit
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {parsedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          item.selected ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleParsedItem(idx)}
                          className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-lg">{getFoodEmoji(item.name, item.type)}</span>
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateParsedItem(idx, 'name', e.target.value)}
                            className="w-full font-medium text-gray-900 bg-transparent border-none p-0 focus:ring-0"
                          />
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateParsedItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-16 bg-white border border-gray-200 rounded px-1 py-0.5 text-gray-900"
                              min="1"
                            />
                            <span>{item.unit}</span>
                          </div>
                        </div>
                        <select
                          value={item.type}
                          onChange={(e) => updateParsedItem(idx, 'type', e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700"
                        >
                          {TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Mode Toggle */}
                  <div className="pt-2 border-t border-gray-200 space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">
                        Adding to: <span className="font-medium">{pasteLocation}</span>
                        {items.filter(i => i.location === pasteLocation).length > 0 && (
                          <span className="text-gray-400"> ({items.filter(i => i.location === pasteLocation).length} existing items)</span>
                        )}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setPasteMode('add')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          pasteMode === 'add'
                            ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-500'
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                        }`}
                      >
                        + Add to existing
                      </button>
                      <button
                        onClick={() => setPasteMode('replace')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          pasteMode === 'replace'
                            ? 'bg-red-100 text-red-700 border-2 border-red-500'
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                        }`}
                      >
                        Replace all
                      </button>
                    </div>

                    {/* Warning for replace mode */}
                    {pasteMode === 'replace' && (
                      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <span className="text-red-600 text-lg">⚠️</span>
                          <div>
                            <p className="text-red-800 font-semibold text-sm">Danger: Replace Mode</p>
                            <p className="text-red-700 text-xs mt-1">
                              This will <span className="font-bold">permanently delete ALL {items.filter(i => i.location === pasteLocation).length} items</span> currently
                              in your {pasteLocation} and replace them with the {parsedItems.filter(i => i.selected).length} selected items.
                            </p>
                            <p className="text-red-600 text-xs mt-1 font-semibold">
                              This action CANNOT be undone!
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAddParsedItems}
                      disabled={saving || parsedItems.filter(i => i.selected).length === 0}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${
                        pasteMode === 'replace'
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          {pasteMode === 'replace' ? 'Replacing...' : 'Adding...'}
                        </>
                      ) : pasteMode === 'replace' ? (
                        `⚠️ Replace with ${parsedItems.filter(i => i.selected).length} Items`
                      ) : (
                        `Add ${parsedItems.filter(i => i.selected).length} Items`
                      )}
                    </button>
                    <button
                      onClick={closePasteModal}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
