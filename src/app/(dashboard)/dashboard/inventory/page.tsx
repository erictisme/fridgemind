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

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')

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

  const filteredItems = locationFilter === 'all'
    ? items
    : items.filter(item => item.location === locationFilter)

  const getExpiryStatus = (expiryDate: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiry = new Date(expiryDate)
    const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntil <= 0) return { label: 'Expired', color: 'bg-red-100 text-red-700' }
    if (daysUntil <= 2) return { label: `${daysUntil}d left`, color: 'bg-red-100 text-red-700' }
    if (daysUntil <= 5) return { label: `${daysUntil}d left`, color: 'bg-amber-100 text-amber-700' }
    return { label: `${daysUntil}d left`, color: 'bg-green-100 text-green-700' }
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
        <Link
          href="/dashboard/scan"
          className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Scan More
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
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
            return (
              <div
                key={item.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{item.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${expiryStatus.color}`}>
                    {expiryStatus.label}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                    {item.quantity} {item.unit}
                  </span>
                  <span className="text-xs px-2 py-1 bg-blue-50 rounded text-blue-600">
                    {item.location}
                  </span>
                  <span className="text-xs px-2 py-1 bg-purple-50 rounded text-purple-600">
                    {item.nutritional_type}
                  </span>
                </div>

                <p className="text-xs text-gray-400">
                  Expires: {new Date(item.expiry_date).toLocaleDateString()}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
