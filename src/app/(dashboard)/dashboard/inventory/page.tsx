'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { trackItemAdded, trackItemConsumed, trackBulkItemsConsumed, trackExpiryExtended, trackFoodWasteEvent } from '@/lib/analytics'

interface InventoryItem {
  id: string
  name: string
  storage_category: string
  nutritional_type: string
  location: string
  quantity: number
  unit: string
  purchase_date: string | null
  expiry_date: string
  freshness: string
  confidence: number
}

type LocationFilter = 'all' | 'fridge' | 'freezer' | 'pantry'
type SortOption = 'expiry' | 'name' | 'location'

// Smart food emoji
const getFoodEmoji = (name: string, type: string): string => {
  const n = name.toLowerCase()
  if (/apple/.test(n)) return '🍎'
  if (/banana/.test(n)) return '🍌'
  if (/orange|mandarin/.test(n)) return '🍊'
  if (/lemon/.test(n)) return '🍋'
  if (/grape/.test(n)) return '🍇'
  if (/strawberr/.test(n)) return '🍓'
  if (/blueberr|berry/.test(n)) return '🫐'
  if (/avocado/.test(n)) return '🥑'
  if (/tomato/.test(n)) return '🍅'
  if (/broccoli/.test(n)) return '🥦'
  if (/carrot/.test(n)) return '🥕'
  if (/potato/.test(n)) return '🥔'
  if (/onion/.test(n)) return '🧅'
  if (/garlic/.test(n)) return '🧄'
  if (/pepper|capsicum/.test(n)) return '🫑'
  if (/cucumber/.test(n)) return '🥒'
  if (/lettuce|salad|spinach|kale/.test(n)) return '🥬'
  if (/cabbage/.test(n)) return '🥬'
  if (/mushroom|shitake/.test(n)) return '🍄'
  if (/chicken/.test(n)) return '🍗'
  if (/beef|steak/.test(n)) return '🥩'
  if (/pork|bacon/.test(n)) return '🥓'
  if (/fish|salmon|tuna/.test(n)) return '🐟'
  if (/shrimp|prawn/.test(n)) return '🦐'
  if (/egg/.test(n)) return '🥚'
  if (/milk/.test(n)) return '🥛'
  if (/cheese/.test(n)) return '🧀'
  if (/yogurt|yoghurt/.test(n)) return '🥛'
  if (/bread/.test(n)) return '🍞'
  if (/rice/.test(n)) return '🍚'
  if (/pasta|noodle/.test(n)) return '🍝'
  if (/drink|juice/.test(n)) return '🥤'
  const defaults: Record<string, string> = { protein: '🍖', carbs: '🍞', fibre: '🥬', misc: '📦' }
  return defaults[type] || '📦'
}

const LOCATIONS = ['fridge', 'freezer', 'pantry'] as const
const UNITS = ['pc', 'pack', 'serving', 'bunch', 'bottle', 'g', 'kg'] as const
const TYPES = ['protein', 'carbs', 'fibre', 'misc'] as const

const getDefaultExpiryDays = (type: string, location: string): number => {
  if (location === 'freezer') return 30
  if (location === 'pantry') return type === 'carbs' ? 14 : 30
  return type === 'protein' ? 4 : type === 'fibre' ? 7 : 7
}

const calcExpiryDate = (type: string, location: string): string => {
  const date = new Date()
  date.setDate(date.getDate() + getDefaultExpiryDays(type, location))
  return date.toISOString().split('T')[0]
}

const getFreshnessStatus = (expiryDate: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  const days = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (days <= 0) return { label: 'Expired', color: 'bg-gray-500', dot: 'bg-gray-500', days }
  if (days <= 2) return { label: `${days}d`, color: 'bg-red-500', dot: 'bg-red-500', days }
  if (days <= 5) return { label: `${days}d`, color: 'bg-orange-500', dot: 'bg-orange-500', days }
  return { label: `${days}d`, color: 'bg-emerald-500', dot: 'bg-emerald-500', days }
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('expiry')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [extendingId, setExtendingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null) // Mobile: tap to expand actions

  // Add form state
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<string>('misc')
  const [newLocation, setNewLocation] = useState<string>('fridge')
  const [newQty, setNewQty] = useState(1)
  const [newUnit, setNewUnit] = useState('pc')

  // Paste state
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteLocation, setPasteLocation] = useState<'fridge' | 'freezer' | 'pantry'>('fridge')
  const [parsedItems, setParsedItems] = useState<Array<{ name: string; quantity: number; unit: string; type: string; selected: boolean }>>([])
  const [parsing, setParsing] = useState(false)
  const [pasteStep, setPasteStep] = useState<'input' | 'review'>('input')

  useEffect(() => { fetchInventory() }, [])

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setItems(data.items || [])
    } catch { setError('Failed to load inventory') }
    finally { setLoading(false) }
  }

  const handleRemove = async (id: string, reason: 'consumed' | 'wasted' | 'wrong_entry') => {
    const item = items.find(i => i.id === id)
    if (!item) return
    setSaving(id)

    // Calculate days until expiry for analytics
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiry = new Date(item.expiry_date)
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    try {
      const res = await fetch('/api/inventory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reason, itemName: item.name, category: item.nutritional_type, quantity: item.quantity }),
      })
      if (!res.ok) throw new Error('Failed')
      setItems(prev => prev.filter(i => i.id !== id))
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })

      // Track item consumption with expiry context
      trackItemConsumed({
        itemName: item.name,
        reason,
        daysUntilExpiry,
        wasExpiringSoon: daysUntilExpiry <= 3 && daysUntilExpiry > 0,
        wasExpired: daysUntilExpiry <= 0,
      })

      // Also track for food waste metrics
      if (reason === 'consumed' || reason === 'wasted') {
        trackFoodWasteEvent({
          eventType: reason,
          itemName: item.name,
          daysUntilExpiry,
          quantity: item.quantity,
        })
      }
    } catch { setError('Failed to remove item') }
    finally { setSaving(null) }
  }

  const handleExtend = async (id: string, days: number) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    setSaving(id)
    setExtendingId(null)

    // Calculate previous days until expiry
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const oldExpiry = new Date(item.expiry_date)
    const previousDaysUntilExpiry = Math.ceil((oldExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    try {
      const newDate = new Date()
      newDate.setDate(newDate.getDate() + days)
      const newExpiry = newDate.toISOString().split('T')[0]
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, expiry_date: newExpiry }),
      })
      if (!res.ok) throw new Error('Failed')
      setItems(prev => prev.map(i => i.id === id ? { ...i, expiry_date: newExpiry } : i))

      // Track expiry extension
      trackExpiryExtended({
        itemName: item.name,
        daysExtended: days,
        previousDaysUntilExpiry,
      })
    } catch { setError('Failed to extend') }
    finally { setSaving(null) }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving('new')
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            name: newName, storage_category: newType, nutritional_type: newType,
            location: newLocation, quantity: newQty, unit: newUnit,
            expiry_date: calcExpiryDate(newType, newLocation), freshness: 'fresh', confidence: 1,
          }],
          location: newLocation,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      await fetchInventory()
      setShowAddForm(false)

      // Track manual item addition
      trackItemAdded({
        method: 'manual',
        itemName: newName,
        location: newLocation,
        quantity: newQty,
      })

      setNewName('')
      setNewQty(1)
    } catch { setError('Failed to add') }
    finally { setSaving(null) }
  }

  const handleSaveEdit = async () => {
    if (!editingItem) return
    setSaving(editingItem.id)
    try {
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem),
      })
      if (!res.ok) throw new Error('Failed')
      setItems(prev => prev.map(i => i.id === editingItem.id ? editingItem : i))
      setEditingId(null)
      setEditingItem(null)
    } catch { setError('Failed to save') }
    finally { setSaving(null) }
  }

  const handleBulkDelete = async (reason: 'consumed' | 'wasted') => {
    if (selectedIds.size === 0) return

    // Calculate expiry stats before deletion for bulk tracking
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const selectedItems = items.filter(i => selectedIds.has(i.id))
    let expiringSoonCount = 0
    let expiredCount = 0

    for (const item of selectedItems) {
      const expiry = new Date(item.expiry_date)
      const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilExpiry <= 0) expiredCount++
      else if (daysUntilExpiry <= 3) expiringSoonCount++
    }

    for (const id of selectedIds) {
      await handleRemove(id, reason)
    }

    // Track bulk action summary
    trackBulkItemsConsumed({
      count: selectedIds.size,
      reason,
      expiringSoonCount,
      expiredCount,
    })

    setSelectedIds(new Set())
  }

  // Paste handlers
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
      if (data.items?.length > 0) {
        setParsedItems(data.items.map((i: { name: string; quantity: number; unit: string; type: string }) => ({ ...i, selected: true })))
        setPasteStep('review')
      } else { setError('No items found') }
    } catch { setError('Failed to parse') }
    setParsing(false)
  }

  const handleAddParsed = async () => {
    const selected = parsedItems.filter(i => i.selected)
    if (selected.length === 0) return
    setSaving('paste')
    try {
      const itemsToAdd = selected.map(item => ({
        name: item.name, storage_category: item.type, nutritional_type: item.type,
        location: pasteLocation, quantity: item.quantity, unit: item.unit,
        expiry_date: calcExpiryDate(item.type, pasteLocation), freshness: 'fresh', confidence: 0.9,
      }))
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToAdd, location: pasteLocation }),
      })
      if (!res.ok) throw new Error('Failed')
      await fetchInventory()

      // Track paste additions
      for (const item of selected) {
        trackItemAdded({
          method: 'paste',
          itemName: item.name,
          location: pasteLocation,
          quantity: item.quantity,
        })
      }

      setShowPasteModal(false)
      setPasteText('')
      setParsedItems([])
      setPasteStep('input')
    } catch { setError('Failed to add') }
    setSaving(null)
  }

  // Filter & sort
  const filtered = locationFilter === 'all' ? items : items.filter(i => i.location === locationFilter)
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'expiry') return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'location') return a.location.localeCompare(b.location)
    return 0
  })

  const counts = {
    all: items.length,
    fridge: items.filter(i => i.location === 'fridge').length,
    freezer: items.filter(i => i.location === 'freezer').length,
    pantry: items.filter(i => i.location === 'pantry').length,
  }

  const allSelected = sorted.length > 0 && sorted.every(i => selectedIds.has(i.id))
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(sorted.map(i => i.id)))
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAddForm(true)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">+ Add</button>
          <button onClick={() => setShowPasteModal(true)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">📋 Paste</button>
          <Link href="/dashboard/scan" className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">📸 Scan</Link>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-500">×</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['all', 'fridge', 'freezer', 'pantry'] as const).map(loc => (
          <button
            key={loc}
            onClick={() => setLocationFilter(loc)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${locationFilter === loc ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {loc === 'all' ? 'All' : loc.charAt(0).toUpperCase() + loc.slice(1)} ({counts[loc]})
          </button>
        ))}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-900">Add Item</span>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">×</button>
          </div>
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Item name..." className="w-full px-3 py-2 border rounded-lg text-gray-900" autoFocus />
          <div className="grid grid-cols-4 gap-2">
            <select value={newType} onChange={e => setNewType(e.target.value)} className="px-2 py-2 border rounded-lg text-gray-900 text-sm">
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={newLocation} onChange={e => setNewLocation(e.target.value)} className="px-2 py-2 border rounded-lg text-gray-900 text-sm">
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <input type="number" min={1} value={newQty} onChange={e => setNewQty(parseInt(e.target.value) || 1)} className="px-2 py-2 border rounded-lg text-gray-900 text-sm" />
            <select value={newUnit} onChange={e => setNewUnit(e.target.value)} className="px-2 py-2 border rounded-lg text-gray-900 text-sm">
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <button onClick={handleAdd} disabled={saving === 'new' || !newName.trim()} className="w-full py-2 bg-emerald-600 text-white rounded-lg font-medium disabled:opacity-50">
            {saving === 'new' ? 'Adding...' : 'Add Item'}
          </button>
        </div>
      )}

      {/* List Header */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap bg-gray-50">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 rounded border-gray-300 text-emerald-600" />
              Select all
            </label>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
                <button onClick={() => handleBulkDelete('consumed')} className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200">✓ Ate</button>
                <button onClick={() => handleBulkDelete('wasted')} className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200">🗑 Bad</button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)} className="text-sm border border-gray-200 rounded px-2 py-1 bg-white text-gray-700">
              <option value="expiry">Sort: Expiry</option>
              <option value="name">Sort: A-Z</option>
              <option value="location">Sort: Location</option>
            </select>
            {/* Legend - mobile hint vs desktop legend */}
            <span className="sm:hidden text-xs text-gray-400">Tap item for actions</span>
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="text-emerald-600">✓</span> Ate it</span>
              <span className="flex items-center gap-1"><span className="text-orange-600">🗑</span> Went bad</span>
              <span className="flex items-center gap-1"><span className="text-blue-600">+</span> Extend</span>
              <span className="flex items-center gap-1"><span className="text-gray-400">✕</span> Wrong</span>
            </div>
          </div>
        </div>

        {/* Items */}
        {sorted.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <div className="text-3xl mb-2">🧊</div>
            No items. <button onClick={() => setShowAddForm(true)} className="text-emerald-600 hover:underline">Add one?</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sorted.map(item => {
              const status = getFreshnessStatus(item.expiry_date)
              const emoji = getFoodEmoji(item.name, item.nutritional_type)
              const isExpired = status.days <= 0
              const isExtending = extendingId === item.id
              const isEditing = editingId === item.id
              const isExpanded = expandedId === item.id

              return (
                <div key={item.id} className={`${isExpired ? 'opacity-60' : ''}`}>
                  {/* Main row */}
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer sm:cursor-default"
                    onClick={() => {
                      // Mobile: toggle expand (only if not editing)
                      if (window.innerWidth < 640 && !isEditing) {
                        setExpandedId(isExpanded ? null : item.id)
                      }
                    }}
                  >
                    {/* Checkbox - hidden on mobile when not expanded */}
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={(e) => {
                        e.stopPropagation()
                        setSelectedIds(prev => {
                          const next = new Set(prev)
                          if (next.has(item.id)) next.delete(item.id)
                          else next.add(item.id)
                          return next
                        })
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 hidden sm:block"
                    />

                    {/* Status dot */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} />

                    {/* Emoji */}
                    <span className="text-lg flex-shrink-0">{emoji}</span>

                    {/* Name & details */}
                    <div className="flex-1 min-w-0">
                      {isEditing && editingItem ? (
                        <div className="flex gap-2 items-center flex-wrap">
                          <input type="text" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} onClick={e => e.stopPropagation()} className="px-2 py-1 border rounded text-sm flex-1 min-w-0" />
                          <input type="number" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: parseFloat(e.target.value) || 0})} onClick={e => e.stopPropagation()} className="px-2 py-1 border rounded text-sm w-16" />
                          <select value={editingItem.location} onChange={e => setEditingItem({...editingItem, location: e.target.value})} onClick={e => e.stopPropagation()} className="px-2 py-1 border rounded text-sm">
                            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                          <button onClick={(e) => { e.stopPropagation(); handleSaveEdit() }} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Save</button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingId(null); setEditingItem(null) }} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">Cancel</button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span
                              className={`font-medium text-gray-900 ${isExpired ? 'line-through' : ''} hidden sm:inline cursor-pointer hover:text-emerald-600`}
                              onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditingItem({...item}) }}
                              title={item.name}
                            >
                              {item.name}
                            </span>
                            <span className={`font-medium text-gray-900 ${isExpired ? 'line-through' : ''} sm:hidden`}>
                              {item.name}
                            </span>
                            <span className="text-sm text-gray-400 flex-shrink-0">{item.quantity} {item.unit}</span>
                          </div>
                          <div className="text-xs text-gray-500">{item.location.charAt(0).toUpperCase() + item.location.slice(1)} · {new Date(item.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                        </>
                      )}
                    </div>

                    {/* Badge */}
                    <span className={`text-xs px-2 py-0.5 rounded-full text-white font-medium flex-shrink-0 ${status.color}`}>{status.label}</span>

                    {/* Mobile: Chevron indicator */}
                    <span className="sm:hidden text-gray-400 text-sm flex-shrink-0">{isExpanded ? '▼' : '›'}</span>

                    {/* Desktop: Actions inline */}
                    <div className="hidden sm:flex items-center gap-1">
                      {isExtending ? (
                        <>
                          {[3, 5, 7].map(d => (
                            <button key={d} onClick={(e) => { e.stopPropagation(); handleExtend(item.id, d) }} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">+{d}d</button>
                          ))}
                          <button onClick={(e) => { e.stopPropagation(); setExtendingId(null) }} className="px-1.5 py-1 text-xs text-gray-500 hover:text-gray-700">✕</button>
                        </>
                      ) : (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); handleRemove(item.id, 'consumed') }} disabled={saving === item.id} title="Ate it" className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50">✓</button>
                          <button onClick={(e) => { e.stopPropagation(); handleRemove(item.id, 'wasted') }} disabled={saving === item.id} title="Went bad" className="p-1.5 text-orange-600 hover:bg-orange-50 rounded disabled:opacity-50">🗑</button>
                          <button onClick={(e) => { e.stopPropagation(); setExtendingId(item.id) }} disabled={saving === item.id} title="Extend expiry" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50">+</button>
                          <button onClick={(e) => { e.stopPropagation(); handleRemove(item.id, 'wrong_entry') }} disabled={saving === item.id} title="Wrong entry" className="p-1.5 text-gray-400 hover:bg-gray-100 rounded disabled:opacity-50">✕</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mobile: Expanded actions */}
                  {isExpanded && (
                    <div className="sm:hidden px-4 pb-3 pt-1 bg-gray-50 border-t border-gray-100">
                      {isExtending ? (
                        <div className="flex items-center gap-2 justify-center">
                          {[3, 5, 7].map(d => (
                            <button key={d} onClick={() => handleExtend(item.id, d)} className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium">+{d}d</button>
                          ))}
                          <button onClick={() => setExtendingId(null)} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 justify-between">
                          <button onClick={() => handleRemove(item.id, 'consumed')} disabled={saving === item.id} className="flex-1 py-2 px-3 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium disabled:opacity-50">✓ Ate</button>
                          <button onClick={() => handleRemove(item.id, 'wasted')} disabled={saving === item.id} className="flex-1 py-2 px-3 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium disabled:opacity-50">🗑 Bad</button>
                          <button onClick={() => setExtendingId(item.id)} disabled={saving === item.id} className="flex-1 py-2 px-3 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium disabled:opacity-50">+ Extend</button>
                          <button onClick={() => handleRemove(item.id, 'wrong_entry')} disabled={saving === item.id} className="py-2 px-3 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium disabled:opacity-50">✕</button>
                        </div>
                      )}
                      {/* Edit button on mobile */}
                      <button
                        onClick={() => { setEditingId(item.id); setEditingItem({...item}); setExpandedId(null) }}
                        className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700"
                      >
                        Edit item
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <span className="font-semibold text-gray-900">{pasteStep === 'input' ? '📋 Paste List' : '✅ Review'}</span>
              <button onClick={() => { setShowPasteModal(false); setPasteStep('input'); setParsedItems([]) }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-4 space-y-4">
              {pasteStep === 'input' ? (
                <>
                  <select value={pasteLocation} onChange={e => setPasteLocation(e.target.value as 'fridge'|'freezer'|'pantry')} className="w-full px-3 py-2 border rounded-lg">
                    <option value="fridge">🧊 Fridge</option>
                    <option value="freezer">❄️ Freezer</option>
                    <option value="pantry">🗄️ Pantry</option>
                  </select>
                  <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="Paste grocery list..." rows={6} className="w-full px-3 py-2 border rounded-lg resize-none" autoFocus />
                  <button onClick={handleParseText} disabled={parsing || !pasteText.trim()} className="w-full py-2 bg-emerald-600 text-white rounded-lg font-medium disabled:opacity-50">
                    {parsing ? 'Processing...' : '✨ Extract'}
                  </button>
                </>
              ) : (
                <>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {parsedItems.map((item, i) => (
                      <label key={i} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer ${item.selected ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
                        <input type="checkbox" checked={item.selected} onChange={() => setParsedItems(prev => prev.map((p, idx) => idx === i ? {...p, selected: !p.selected} : p))} className="w-4 h-4 rounded text-emerald-600" />
                        <span className="text-lg">{getFoodEmoji(item.name, item.type)}</span>
                        <span className="flex-1 text-gray-900">{item.name}</span>
                        <span className="text-sm text-gray-500">{item.quantity} {item.unit}</span>
                      </label>
                    ))}
                  </div>
                  <button onClick={handleAddParsed} disabled={saving === 'paste'} className="w-full py-2 bg-emerald-600 text-white rounded-lg font-medium disabled:opacity-50">
                    {saving === 'paste' ? 'Adding...' : `Add ${parsedItems.filter(i => i.selected).length} Items`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
