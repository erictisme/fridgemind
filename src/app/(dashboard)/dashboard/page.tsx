'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface InventoryItem {
  id: string
  name: string
  quantity: number
  expiry_date: string
  location: string
  nutritional_type: string
}

// Food emojis for nutritional types
const nutritionalEmojis: Record<string, string> = {
  vegetables: '🥬',
  protein: '🍖',
  carbs: '🍞',
  vitamins: '💊',
  fats: '🧈',
  dairy: '🥛',
  other: '📦',
}

export default function DashboardPage() {
  const [expiringItems, setExpiringItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [totalItems, setTotalItems] = useState(0)

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    try {
      const response = await fetch('/api/inventory')
      if (response.ok) {
        const data = await response.json()
        const items = data.items || []
        setTotalItems(items.length)

        // Filter items expiring within 5 days
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const expiring = items.filter((item: InventoryItem) => {
          const expiry = new Date(item.expiry_date)
          const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          return daysUntil <= 5
        }).slice(0, 5) // Show max 5

        setExpiringItems(expiring)
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiry = new Date(expiryDate)
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const getExpiryLabel = (days: number) => {
    if (days <= 0) return { text: 'Expired', color: 'text-red-600 bg-red-100' }
    if (days === 1) return { text: 'Tomorrow', color: 'text-orange-600 bg-orange-100' }
    if (days <= 3) return { text: `${days} days`, color: 'text-amber-600 bg-amber-100' }
    return { text: `${days} days`, color: 'text-yellow-600 bg-yellow-100' }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Home</h1>
        <p className="text-gray-500">
          {totalItems > 0 ? `${totalItems} items in your kitchen` : "Let's stock your kitchen"}
        </p>
      </div>

      {/* Expiring Soon Section */}
      {!loading && expiringItems.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-5 border border-red-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              Use Soon
            </h2>
            <Link href="/dashboard/inventory" className="text-sm text-red-600 hover:text-red-700">
              View all &rarr;
            </Link>
          </div>
          <div className="space-y-3">
            {expiringItems.map(item => {
              const days = getDaysUntilExpiry(item.expiry_date)
              const expiry = getExpiryLabel(days)
              const emoji = nutritionalEmojis[item.nutritional_type] || '📦'
              return (
                <div key={item.id} className="flex items-center justify-between bg-white/70 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{emoji}</span>
                    <div>
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.quantity} serving{item.quantity !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${expiry.color}`}>
                    {expiry.text}
                  </span>
                </div>
              )
            })}
          </div>
          {expiringItems.length > 0 && (
            <Link
              href="/dashboard/suggestions"
              className="mt-4 block w-full py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white text-center rounded-xl font-medium hover:from-red-600 hover:to-orange-600 transition-all"
            >
              Get meal ideas for these items
            </Link>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/dashboard/scan"
          className="bg-emerald-50 hover:bg-emerald-100 rounded-2xl p-5 transition-colors"
        >
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900">Scan Kitchen</h3>
          <p className="text-sm text-gray-500">Update your inventory</p>
        </Link>

        <Link
          href="/dashboard/inventory"
          className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-5 transition-colors"
        >
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900">Inventory</h3>
          <p className="text-sm text-gray-500">{totalItems} items</p>
        </Link>

        <Link
          href="/dashboard/suggestions"
          className="bg-purple-50 hover:bg-purple-100 rounded-2xl p-5 transition-colors"
        >
          <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center mb-3">
            <span className="text-xl">🍳</span>
          </div>
          <h3 className="font-semibold text-gray-900">What to Cook</h3>
          <p className="text-sm text-gray-500">AI meal ideas</p>
        </Link>

        <Link
          href="/dashboard/log-meal"
          className="bg-amber-50 hover:bg-amber-100 rounded-2xl p-5 transition-colors"
        >
          <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mb-3">
            <span className="text-xl">🍽️</span>
          </div>
          <h3 className="font-semibold text-gray-900">Log Meal</h3>
          <p className="text-sm text-gray-500">Track what you eat</p>
        </Link>

        <Link
          href="/dashboard/receipts"
          className="bg-pink-50 hover:bg-pink-100 rounded-2xl p-5 transition-colors"
        >
          <div className="w-12 h-12 bg-pink-500 rounded-xl flex items-center justify-center mb-3">
            <span className="text-xl">🧾</span>
          </div>
          <h3 className="font-semibold text-gray-900">Scan Receipt</h3>
          <p className="text-sm text-gray-500">Add groceries</p>
        </Link>
      </div>

      {/* Empty state - show when no items */}
      {!loading && totalItems === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Start tracking your food</h3>
          <p className="text-gray-500 mb-4">Take a photo of your fridge to see what you have</p>
          <Link
            href="/dashboard/scan"
            className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Scan Your Kitchen
          </Link>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  )
}
