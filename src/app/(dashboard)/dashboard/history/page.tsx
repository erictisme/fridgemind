'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface HistoryItem {
  id: string
  type: 'receipt' | 'cooked' | 'eaten' | 'wasted'
  date: string
  title: string
  subtitle?: string
  icon: string
  metadata?: Record<string, unknown>
}

interface HistoryData {
  history: Record<string, HistoryItem[]>
  summary: {
    receipts_this_month: number
    meals_this_month: number
    eaten_this_month: number
    wasted_this_month: number
    waste_rate: number
  }
}

type FilterType = 'all' | 'receipts' | 'meals' | 'consumption'

export default function HistoryPage() {
  const [data, setData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    fetchHistory()
  }, [filter])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/history?filter=${filter}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return date.toLocaleDateString('en-SG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const getItemColor = (type: string) => {
    switch (type) {
      case 'receipt':
        return 'bg-blue-50 border-blue-200'
      case 'cooked':
        return 'bg-purple-50 border-purple-200'
      case 'eaten':
        return 'bg-emerald-50 border-emerald-200'
      case 'wasted':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  if (loading && !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const summary = data?.summary
  const history = data?.history || {}
  const sortedDates = Object.keys(history).sort((a, b) =>
    new Date(b).getTime() - new Date(a).getTime()
  )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">History</h1>
        <Link
          href="/dashboard/groceries?tab=upload"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm flex items-center gap-2"
        >
          <span>+</span> Upload Receipt
        </Link>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="text-2xl font-bold text-blue-600">{summary.receipts_this_month}</div>
            <div className="text-xs text-blue-700">Receipts this month</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
            <div className="text-2xl font-bold text-purple-600">{summary.meals_this_month}</div>
            <div className="text-xs text-purple-700">Meals logged</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
            <div className="text-2xl font-bold text-emerald-600">{summary.eaten_this_month}</div>
            <div className="text-xs text-emerald-700">Items eaten</div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-100">
            <div className="text-2xl font-bold text-red-600">{summary.waste_rate}%</div>
            <div className="text-xs text-red-700">Waste rate</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'all', label: 'All', icon: '📋' },
          { key: 'receipts', label: 'Receipts', icon: '🧾' },
          { key: 'meals', label: 'Meals', icon: '🍳' },
          { key: 'consumption', label: 'Consumption', icon: '✅' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as FilterType)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === tab.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {sortedDates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No history yet</h3>
          <p className="text-gray-600 mb-4">
            Start by uploading a receipt or logging a meal
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/dashboard/groceries?tab=upload"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Upload Receipt
            </Link>
            <Link
              href="/dashboard/log-meal"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Log Meal
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => (
            <div key={dateStr}>
              {/* Date Header */}
              <div className="sticky top-0 bg-gray-50/95 backdrop-blur-sm py-2 -mx-2 px-2 z-10">
                <h3 className="text-sm font-semibold text-gray-500">{formatDate(dateStr)}</h3>
              </div>

              {/* Items for this date */}
              <div className="space-y-2 mt-2">
                {history[dateStr].map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${getItemColor(item.type)}`}
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-sm text-gray-500">{item.subtitle}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(item.date).toLocaleTimeString('en-SG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading indicator */}
      {loading && data && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  )
}
