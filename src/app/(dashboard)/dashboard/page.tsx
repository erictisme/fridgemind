'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ExpiringItem {
  id: string
  name: string
  expiry_date: string
  days_until_expiry: number
  quantity: number
  unit: string | null
}

interface SuggestedAction {
  type: 'scan' | 'shop' | 'cook' | 'store' | 'inspire' | 'use_soon'
  title: string
  description: string
  icon: string
  href: string
  priority: number
  data?: {
    items?: ExpiringItem[]
    count?: number
  }
}

interface HomeFeedData {
  context: {
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'night'
    inventory_count: number
    expiring_soon_count: number
    shopping_list_count: number
    recipes_count: number
  }
  primary_action: SuggestedAction | null
  secondary_actions: SuggestedAction[]
  expiring_items: ExpiringItem[]
}

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 22) return 'Good evening'
  return 'Good evening' // Late night also shows "Good evening"
}

const ACTION_COLORS: Record<string, { bg: string; icon: string; button: string }> = {
  scan: { bg: 'from-emerald-50 to-teal-50', icon: 'bg-emerald-500', button: 'bg-emerald-600 hover:bg-emerald-700' },
  shop: { bg: 'from-blue-50 to-indigo-50', icon: 'bg-blue-500', button: 'bg-blue-600 hover:bg-blue-700' },
  cook: { bg: 'from-purple-50 to-pink-50', icon: 'bg-purple-500', button: 'bg-purple-600 hover:bg-purple-700' },
  store: { bg: 'from-amber-50 to-orange-50', icon: 'bg-amber-500', button: 'bg-amber-600 hover:bg-amber-700' },
  inspire: { bg: 'from-pink-50 to-rose-50', icon: 'bg-pink-500', button: 'bg-pink-600 hover:bg-pink-700' },
  use_soon: { bg: 'from-red-50 to-orange-50', icon: 'bg-red-500', button: 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600' },
}

export default function DashboardPage() {
  const [feedData, setFeedData] = useState<HomeFeedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingItem, setDeletingItem] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [editingItem, setEditingItem] = useState<ExpiringItem | null>(null)
  const [editForm, setEditForm] = useState({ name: '', expiry_date: '', quantity: 1 })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    fetchHomeFeed()
  }, [])

  const fetchHomeFeed = async () => {
    try {
      const response = await fetch('/api/home-feed')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setFeedData(data)
    } catch {
      setError('Failed to load home feed')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteItem = async (itemId: string, reason: 'eaten' | 'bad' | 'wrong') => {
    setDeletingItem(itemId)
    setConfirmDelete(null)
    try {
      const response = await fetch(`/api/inventory/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (response.ok) {
        // Remove from local state immediately
        setFeedData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            expiring_items: prev.expiring_items.filter(i => i.id !== itemId),
            context: {
              ...prev.context,
              inventory_count: prev.context.inventory_count - 1,
              expiring_soon_count: prev.context.expiring_soon_count - 1,
            },
            primary_action: prev.primary_action?.data?.items
              ? {
                  ...prev.primary_action,
                  data: {
                    ...prev.primary_action.data,
                    items: prev.primary_action.data.items.filter(i => i.id !== itemId),
                    count: (prev.primary_action.data.count || 0) - 1,
                  },
                }
              : prev.primary_action,
          }
        })
      }
    } catch (err) {
      console.error('Failed to delete item:', err)
    } finally {
      setDeletingItem(null)
    }
  }

  const openEditModal = (item: ExpiringItem) => {
    setEditingItem(item)
    setEditForm({
      name: item.name,
      expiry_date: item.expiry_date,
      quantity: item.quantity,
    })
  }

  const handleSaveEdit = async () => {
    if (!editingItem) return
    setSavingEdit(true)
    try {
      const response = await fetch(`/api/inventory/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (response.ok) {
        // Update local state
        setFeedData(prev => {
          if (!prev) return prev
          const updateItem = (item: ExpiringItem) => {
            if (item.id !== editingItem.id) return item
            const newDays = Math.ceil((new Date(editForm.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            return {
              ...item,
              name: editForm.name,
              expiry_date: editForm.expiry_date,
              quantity: editForm.quantity,
              days_until_expiry: newDays,
            }
          }
          return {
            ...prev,
            expiring_items: prev.expiring_items.map(updateItem),
            primary_action: prev.primary_action?.data?.items
              ? {
                  ...prev.primary_action,
                  data: {
                    ...prev.primary_action.data,
                    items: prev.primary_action.data.items.map(updateItem),
                  },
                }
              : prev.primary_action,
          }
        })
        setEditingItem(null)
      }
    } catch (err) {
      console.error('Failed to save item:', err)
    } finally {
      setSavingEdit(false)
    }
  }

  const getExpiryLabel = (days: number) => {
    if (days <= 0) return { text: 'Expired', color: 'text-red-600 bg-red-100' }
    if (days === 1) return { text: 'Tomorrow', color: 'text-orange-600 bg-orange-100' }
    if (days <= 3) return { text: `${days} days`, color: 'text-amber-600 bg-amber-100' }
    return { text: `${days} days`, color: 'text-yellow-600 bg-yellow-100' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your kitchen...</p>
        </div>
      </div>
    )
  }

  if (error || !feedData) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error || 'Something went wrong'}</p>
        <button
          onClick={() => { setLoading(true); setError(null); fetchHomeFeed() }}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
        >
          Try Again
        </button>
      </div>
    )
  }

  const { context, primary_action, secondary_actions, expiring_items } = feedData
  const greeting = getGreeting()

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingItem(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Item</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={editForm.expiry_date}
                  onChange={e => setEditForm(prev => ({ ...prev, expiry_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={editForm.quantity}
                  onChange={e => setEditForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove {confirmDelete.name}?</h3>
            <p className="text-gray-500 text-sm mb-4">What happened to this item?</p>
            <div className="space-y-2">
              <button
                onClick={() => handleDeleteItem(confirmDelete.id, 'eaten')}
                className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <span>✓</span> Ate it
              </button>
              <button
                onClick={() => handleDeleteItem(confirmDelete.id, 'bad')}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <span>🗑</span> Went bad
              </button>
              <button
                onClick={() => handleDeleteItem(confirmDelete.id, 'wrong')}
                className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <span>✕</span> Added by mistake
              </button>
            </div>
            <button
              onClick={() => setConfirmDelete(null)}
              className="w-full mt-3 py-2 text-gray-400 hover:text-gray-600 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Cooking Wrapped 2025 Banner */}
      <Link href="/dashboard/wrapped" className="block">
        <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-2xl p-5 text-white relative overflow-hidden hover:shadow-lg transition-shadow">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdi0ySDAtMTB6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjYSkiLz48L3N2Zz4=')] opacity-30"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Your year in cooking</p>
              <h2 className="text-2xl font-black">Cooking Wrapped 2025</h2>
              <p className="text-white/70 text-sm mt-1">See your food personality, top recipes & 2026 goals</p>
            </div>
            <div className="text-4xl">🎁</div>
          </div>
          <div className="mt-3 inline-flex items-center text-sm font-medium bg-white/20 rounded-full px-3 py-1">
            View your Wrapped
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
        <p className="text-gray-500">
          {context.inventory_count > 0
            ? `${context.inventory_count} items in your kitchen`
            : "Let's get your kitchen organized"}
        </p>
      </div>

      {/* Primary Action Card */}
      {primary_action && (
        <Link href={primary_action.href} className="block">
          <div className={`bg-gradient-to-r ${ACTION_COLORS[primary_action.type].bg} rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow`}>
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 ${ACTION_COLORS[primary_action.type].icon} rounded-2xl flex items-center justify-center text-2xl flex-shrink-0`}>
                {primary_action.icon}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{primary_action.title}</h2>
                <p className="text-gray-600 mt-1">{primary_action.description}</p>

                {/* Expiring items preview */}
                {primary_action.type === 'use_soon' && primary_action.data?.items && (
                  <div className="mt-4 space-y-2">
                    {primary_action.data.items.slice(0, 3).map(item => {
                      const expiry = getExpiryLabel(item.days_until_expiry)
                      const isDeleting = deletingItem === item.id
                      return (
                        <div key={item.id} className={`flex items-center justify-between bg-white/70 rounded-xl px-3 py-2 ${isDeleting ? 'opacity-50' : ''}`}>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditModal(item) }}
                            className="font-medium text-gray-900 hover:text-emerald-600 text-left flex-1"
                          >
                            {item.name}
                          </button>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${expiry.color}`}>
                              {expiry.text}
                            </span>
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditModal(item) }}
                              className="w-7 h-7 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-sm"
                              title="Edit item"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete({ id: item.id, name: item.name }) }}
                              disabled={isDeleting}
                              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm"
                              title="Remove item"
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {primary_action.data.count && primary_action.data.count > 3 && (
                      <p className="text-sm text-gray-500 text-center">
                        +{primary_action.data.count - 3} more
                      </p>
                    )}
                  </div>
                )}

                <div className={`mt-4 inline-flex items-center px-4 py-2 ${ACTION_COLORS[primary_action.type].button} text-white rounded-xl font-medium`}>
                  {primary_action.type === 'use_soon' ? 'Get meal ideas' : primary_action.type === 'cook' ? 'What to cook?' : 'Go'}
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Secondary Actions */}
      {secondary_actions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {secondary_actions.map((action, index) => (
            <Link
              key={index}
              href={action.href}
              className="bg-white rounded-xl p-4 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <span className="text-2xl block mb-2">{action.icon}</span>
              <h3 className="font-semibold text-gray-900 text-sm">{action.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Lifecycle Navigation */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Access</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <LifecycleButton href="/dashboard/inspire" icon="✨" label="Inspire" />
          <LifecycleButton href="/dashboard/shopping-list" icon="📝" label="List" />
          <LifecycleButton href="/dashboard/shopping-list" icon="🛒" label="Shop" />
          <LifecycleButton href="/dashboard/groceries?tab=upload" icon="📦" label="Store" />
          <LifecycleButton href="/dashboard/suggestions" icon="🍳" label="Cook" />
          <LifecycleButton href="/dashboard/log-meal" icon="🍽️" label="Eat" />
        </div>
      </div>

      {/* Expiring Items List (if not already shown in primary action) */}
      {expiring_items.length > 0 && primary_action?.type !== 'use_soon' && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span>⚠️</span>
              Expiring Soon
            </h3>
            <Link href="/dashboard/inventory" className="text-sm text-amber-600 hover:text-amber-700">
              View all &rarr;
            </Link>
          </div>
          <div className="space-y-2">
            {expiring_items.slice(0, 4).map(item => {
              const expiry = getExpiryLabel(item.days_until_expiry)
              const isDeleting = deletingItem === item.id
              return (
                <div key={item.id} className={`flex items-center justify-between bg-white/70 rounded-xl px-3 py-2 ${isDeleting ? 'opacity-50' : ''}`}>
                  <button
                    onClick={() => openEditModal(item)}
                    className="text-left flex-1"
                  >
                    <span className="font-medium text-gray-900 hover:text-emerald-600">{item.name}</span>
                    {item.quantity > 1 && (
                      <span className="text-sm text-gray-500 ml-2">x{item.quantity}</span>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${expiry.color}`}>
                      {expiry.text}
                    </span>
                    <button
                      onClick={() => openEditModal(item)}
                      className="w-7 h-7 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-sm"
                      title="Edit item"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: item.id, name: item.name })}
                      disabled={isDeleting}
                      className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm"
                      title="Remove item"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={context.inventory_count} label="In Kitchen" href="/dashboard/inventory" />
        <StatCard value={context.expiring_soon_count} label="Expiring" color="amber" href="/dashboard/inventory" />
        <StatCard value={context.shopping_list_count} label="To Buy" color="blue" href="/dashboard/shopping-list" />
        <StatCard value={context.recipes_count} label="Recipes" color="purple" href="/dashboard/inspire" />
      </div>
    </div>
  )
}

function LifecycleButton({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center p-3 rounded-xl hover:bg-gray-50 transition-colors"
    >
      <span className="text-2xl mb-1">{icon}</span>
      <span className="text-xs font-medium text-gray-600">{label}</span>
    </Link>
  )
}

function StatCard({
  value,
  label,
  color = 'emerald',
  href
}: {
  value: number
  label: string
  color?: 'emerald' | 'amber' | 'blue' | 'purple'
  href: string
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <Link
      href={href}
      className={`${colors[color]} rounded-xl p-4 text-center hover:opacity-80 transition-opacity`}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium opacity-80">{label}</div>
    </Link>
  )
}
