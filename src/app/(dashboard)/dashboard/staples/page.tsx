'use client'

import { useState, useEffect, useCallback } from 'react'

interface Staple {
  id: string
  name: string
  category: string | null
  purchase_count: number
  first_purchased_at: string | null
  last_purchased_at: string | null
  avg_purchase_frequency_days: number | null
  is_staple: boolean
  is_occasional: boolean
  never_suggest_alternative: boolean
  notes: string | null
}

interface AnalyzeResult {
  receipts_analyzed: number
  items_found: number
  staples_identified: number
  top_staples: Staple[]
  frequent_occasional: Staple[]
}

const CATEGORY_EMOJI: Record<string, string> = {
  produce: '🥬',
  dairy: '🥛',
  protein: '🍖',
  pantry: '🥫',
  beverage: '🥤',
  frozen: '❄️',
  snacks: '🍪',
  bakery: '🍞',
  household: '🧹',
  other: '📦',
}

export default function StaplesPage() {
  const [staples, setStaples] = useState<Staple[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [filter, setFilter] = useState<'all' | 'staples' | 'occasional' | 'unclassified'>('all')
  const [counts, setCounts] = useState({ total: 0, staples: 0, occasional: 0, unclassified: 0 })

  const fetchStaples = useCallback(async () => {
    try {
      const res = await fetch('/api/staples')
      if (res.ok) {
        const data = await res.json()
        setStaples(data.staples || [])
        setCounts(data.counts || { total: 0, staples: 0, occasional: 0, unclassified: 0 })
      }
    } catch (error) {
      console.error('Error fetching staples:', error)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStaples()
  }, [fetchStaples])

  const analyzeReceipts = async () => {
    setAnalyzing(true)
    setAnalyzeResult(null)
    try {
      const res = await fetch('/api/staples/analyze', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setAnalyzeResult(data)
        // Refresh staples list
        fetchStaples()
      } else {
        alert('Failed to analyze receipts')
      }
    } catch (error) {
      console.error('Error analyzing receipts:', error)
      alert('Error analyzing receipts')
    }
    setAnalyzing(false)
  }

  const updateStaple = async (id: string, updates: { is_staple?: boolean; is_occasional?: boolean }) => {
    try {
      const res = await fetch('/api/staples', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      if (res.ok) {
        // Update local state
        setStaples((prev) =>
          prev.map((s) => {
            if (s.id === id) {
              return {
                ...s,
                is_staple: updates.is_staple ?? s.is_staple,
                is_occasional: updates.is_occasional ?? s.is_occasional,
              }
            }
            return s
          })
        )
        // Refresh counts
        fetchStaples()
      }
    } catch (error) {
      console.error('Error updating staple:', error)
    }
  }

  const filteredStaples = staples.filter((s) => {
    if (filter === 'staples') return s.is_staple
    if (filter === 'occasional') return s.is_occasional
    if (filter === 'unclassified') return !s.is_staple && !s.is_occasional
    return true
  })

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Staples</h1>
          <p className="text-gray-500">
            Items you buy regularly. Staples won&apos;t get alternative suggestions.
          </p>
        </div>
        <button
          onClick={analyzeReceipts}
          disabled={analyzing}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
        >
          {analyzing ? 'Analyzing...' : 'Analyze Receipts'}
        </button>
      </div>

      {/* Analysis Result */}
      {analyzeResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-emerald-900">Analysis Complete!</h3>
            <button
              onClick={() => setAnalyzeResult(null)}
              className="text-emerald-600 hover:text-emerald-800"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-emerald-600">{analyzeResult.receipts_analyzed}</div>
              <div className="text-xs text-gray-500">Receipts</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-emerald-600">{analyzeResult.items_found}</div>
              <div className="text-xs text-gray-500">Unique Items</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-emerald-600">{analyzeResult.staples_identified}</div>
              <div className="text-xs text-gray-500">Auto-Staples (3+)</div>
            </div>
          </div>
          <p className="text-sm text-emerald-700">
            Items purchased 3+ times are auto-marked as staples. Review below to adjust.
          </p>
        </div>
      )}

      {/* Empty State */}
      {staples.length === 0 && !analyzeResult && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No purchase history yet</h3>
          <p className="text-gray-600 mb-4">
            Upload receipts first, then analyze to identify your staples.
          </p>
          <a
            href="/dashboard/groceries?tab=upload"
            className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Upload Receipts
          </a>
        </div>
      )}

      {/* Filter Tabs */}
      {staples.length > 0 && (
        <>
          <div className="flex gap-2 border-b border-gray-200 pb-2">
            <FilterTab
              label="All"
              count={counts.total}
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterTab
              label="Staples"
              count={counts.staples}
              active={filter === 'staples'}
              onClick={() => setFilter('staples')}
              color="emerald"
            />
            <FilterTab
              label="Occasional"
              count={counts.occasional}
              active={filter === 'occasional'}
              onClick={() => setFilter('occasional')}
              color="amber"
            />
            <FilterTab
              label="Unclassified"
              count={counts.unclassified}
              active={filter === 'unclassified'}
              onClick={() => setFilter('unclassified')}
              color="gray"
            />
          </div>

          {/* Staples List */}
          <div className="space-y-2">
            {filteredStaples.map((staple) => (
              <StapleRow
                key={staple.id}
                staple={staple}
                onMarkStaple={() => updateStaple(staple.id, { is_staple: true })}
                onMarkOccasional={() => updateStaple(staple.id, { is_occasional: true })}
                onClear={() => updateStaple(staple.id, { is_staple: false, is_occasional: false })}
              />
            ))}
          </div>

          {filteredStaples.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No items in this category
            </div>
          )}
        </>
      )}

      {/* Legend */}
      {staples.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-900 mb-2">How this works:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li><span className="text-emerald-600 font-medium">Staples</span> - Items you always buy. We won&apos;t suggest alternatives.</li>
            <li><span className="text-amber-600 font-medium">Occasional</span> - Items to challenge you on. We&apos;ll suggest trying new things!</li>
            <li><span className="text-gray-500">Unclassified</span> - Review and categorize these.</li>
          </ul>
        </div>
      )}
    </div>
  )
}

function FilterTab({
  label,
  count,
  active,
  onClick,
  color = 'gray',
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  color?: 'emerald' | 'amber' | 'gray'
}) {
  const colors = {
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    gray: 'bg-gray-100 text-gray-700',
  }

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active
          ? colors[color]
          : 'text-gray-500 hover:bg-gray-100'
      }`}
    >
      {label} <span className="text-xs opacity-70">({count})</span>
    </button>
  )
}

function StapleRow({
  staple,
  onMarkStaple,
  onMarkOccasional,
  onClear,
}: {
  staple: Staple
  onMarkStaple: () => void
  onMarkOccasional: () => void
  onClear: () => void
}) {
  const emoji = CATEGORY_EMOJI[staple.category || 'other'] || '📦'

  return (
    <div className="flex items-center justify-between bg-white rounded-xl p-4 border border-gray-200">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <div className="font-medium text-gray-900">{staple.name}</div>
          <div className="text-xs text-gray-500">
            Bought {staple.purchase_count}x
            {staple.avg_purchase_frequency_days && (
              <span> • Every ~{staple.avg_purchase_frequency_days} days</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {staple.is_staple ? (
          <>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
              Staple
            </span>
            <button
              onClick={onClear}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              Clear
            </button>
          </>
        ) : staple.is_occasional ? (
          <>
            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
              Occasional
            </span>
            <button
              onClick={onClear}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              Clear
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onMarkStaple}
              className="px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-sm font-medium"
            >
              Staple
            </button>
            <button
              onClick={onMarkOccasional}
              className="px-3 py-1 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-sm font-medium"
            >
              Occasional
            </button>
          </>
        )}
      </div>
    </div>
  )
}
