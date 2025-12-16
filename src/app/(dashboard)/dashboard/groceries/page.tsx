'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

interface Receipt {
  id: string
  store_name: string
  store_branch?: string
  receipt_date: string
  receipt_number?: string
  total: number
  payment_method?: string
  file_name?: string
  created_at: string
}

interface ReceiptItem {
  name: string
  quantity: number
  unit: string
  category: string
  total_price: number
}

interface ParsedReceipt {
  store_name: string
  receipt_date: string
  total: number
  items: ReceiptItem[]
}

interface Analytics {
  summary: {
    total_spent: number
    receipt_count: number
    avg_per_trip: number
    item_count: number
    current_month_spend: number
    last_month_spend: number
    month_over_month_percent: number
  }
  monthly_spending: Array<{ month: string; total: number }>
  category_breakdown: Array<{ category: string; total: number }>
  store_breakdown: Array<{ store: string; total: number; count: number }>
  top_items: Array<{ name: string; total: number; count: number }>
}

// Category emojis
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

export default function HistoryPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = searchParams.get('tab') === 'upload' ? 'upload' : 'dashboard'

  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'receipts' | 'upload'>(initialTab)

  // New state for inventory flow
  const [lastParsedReceipt, setLastParsedReceipt] = useState<ParsedReceipt | null>(null)
  const [addingToInventory, setAddingToInventory] = useState(false)
  const [inventorySuccess, setInventorySuccess] = useState<string | null>(null)

  // Bulk upload state
  const [bulkProgress, setBulkProgress] = useState<{
    total: number
    current: number
    successful: number
    duplicates: number
    failed: number
    currentFile: string
  } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const receiptsRes = await fetch('/api/receipts')
      if (receiptsRes.ok) {
        const data = await receiptsRes.json()
        setReceipts(data.receipts || [])
      }

      const analyticsRes = await fetch('/api/receipts/analytics?months=6')
      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploading(true)
    setLastParsedReceipt(null)
    setInventorySuccess(null)

    const fileArray = Array.from(files)

    // Single file - original behavior
    if (fileArray.length === 1) {
      const file = fileArray[0]
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const res = await fetch('/api/receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_data: base64,
            file_type: file.type,
            file_name: file.name,
          }),
        })

        const data = await res.json()

        if (res.ok) {
          console.log('[groceries] Receipt parsed successfully:', data.parsed)
          setLastParsedReceipt(data.parsed)
          fetchData()
        } else if (data.duplicate) {
          alert(`Duplicate receipt - already have ${data.existing.store} receipt from ${data.existing.date}`)
        } else {
          alert(data.error || 'Failed to process receipt')
        }
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Error processing file')
      }
      setUploading(false)
      return
    }

    // Multiple files - bulk upload mode
    setBulkProgress({
      total: fileArray.length,
      current: 0,
      successful: 0,
      duplicates: 0,
      failed: 0,
      currentFile: '',
    })

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      setBulkProgress(prev => prev ? {
        ...prev,
        current: i + 1,
        currentFile: file.name,
      } : null)

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const res = await fetch('/api/receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_data: base64,
            file_type: file.type,
            file_name: file.name,
          }),
        })

        const data = await res.json()

        if (res.ok) {
          setBulkProgress(prev => prev ? { ...prev, successful: prev.successful + 1 } : null)
        } else if (data.duplicate) {
          setBulkProgress(prev => prev ? { ...prev, duplicates: prev.duplicates + 1 } : null)
        } else {
          setBulkProgress(prev => prev ? { ...prev, failed: prev.failed + 1 } : null)
        }
      } catch {
        setBulkProgress(prev => prev ? { ...prev, failed: prev.failed + 1 } : null)
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    setUploading(false)
    fetchData()
  }

  const handleAddToInventory = async () => {
    console.log('[groceries] handleAddToInventory called, lastParsedReceipt:', lastParsedReceipt)
    if (!lastParsedReceipt) return

    // Filter out household items
    const foodItems = lastParsedReceipt.items.filter(
      item => item.category !== 'household'
    )

    if (foodItems.length === 0) {
      alert('No food items to add (only household items found)')
      return
    }

    setAddingToInventory(true)

    const payload = {
      receipt_date: lastParsedReceipt.receipt_date,
      items: foodItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
      })),
    }
    console.log('[groceries] Sending to inventory:', payload)

    try {
      const res = await fetch('/api/receipts/to-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      console.log('[groceries] Response:', { ok: res.ok, status: res.status, data })

      if (res.ok) {
        // Check if there were any errors
        if (data.errors && data.errors.length > 0) {
          console.error('[groceries] Some items failed:', data.errors)
          alert(`Added ${data.inserted} items, but ${data.errors.length} failed:\n${data.errors.map((e: {item: string, error: string}) => `${e.item}: ${e.error}`).join('\n')}`)
        }

        if (data.inserted > 0) {
          // Redirect to inventory to see the added items
          console.log('[groceries] Success! Redirecting to inventory...')
          router.push('/dashboard/inventory')
        } else {
          alert('No items were added. Check console for errors.')
          setAddingToInventory(false)
        }
      } else {
        alert(data.error || 'Failed to add to inventory')
        setAddingToInventory(false)
      }
    } catch (error) {
      console.error('[groceries] Error:', error)
      alert(error instanceof Error ? error.message : 'Error adding to inventory')
      setAddingToInventory(false)
    }
  }

  const deleteReceipt = async (id: string) => {
    if (!confirm('Delete this receipt?')) return

    try {
      const res = await fetch(`/api/receipts?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Error deleting receipt:', error)
    }
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      produce: 'bg-green-500',
      dairy: 'bg-blue-400',
      protein: 'bg-red-500',
      pantry: 'bg-amber-500',
      beverage: 'bg-cyan-500',
      frozen: 'bg-indigo-400',
      household: 'bg-gray-500',
      snacks: 'bg-pink-500',
      bakery: 'bg-orange-400',
      other: 'bg-slate-400',
    }
    return colors[category] || colors.other
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const foodItemsCount = lastParsedReceipt?.items.filter(i => i.category !== 'household').length || 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">History</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'dashboard'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'receipts'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Receipts
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'upload'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Upload
          </button>
        </div>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* Success message */}
          {inventorySuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <span className="text-emerald-800 font-medium">{inventorySuccess}</span>
              </div>
              <button
                onClick={() => setInventorySuccess(null)}
                className="text-emerald-600 hover:text-emerald-800"
              >
                ✕
              </button>
            </div>
          )}

          {/* Parsed receipt - Add to Inventory flow */}
          {lastParsedReceipt && (
            <div className="bg-white rounded-xl border-2 border-emerald-500 p-6 space-y-4">
              {/* Header with Add to Inventory button at TOP */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {lastParsedReceipt.store_name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {new Date(lastParsedReceipt.receipt_date).toLocaleDateString()} • {formatCurrency(lastParsedReceipt.total)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLastParsedReceipt(null)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => {
                      console.log('[groceries] Button clicked!')
                      handleAddToInventory()
                    }}
                    disabled={addingToInventory || foodItemsCount === 0}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {addingToInventory ? 'Adding...' : `Add ${foodItemsCount} items to Inventory`}
                  </button>
                </div>
              </div>

              {/* Items list (read-only, just for review) */}
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 mb-3">
                  AI will determine storage location (fridge/freezer/pantry) for each item
                </p>
                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {lastParsedReceipt.items.map((item, i) => {
                    const isHousehold = item.category === 'household'
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                          isHousehold ? 'bg-gray-100 text-gray-400' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{CATEGORY_EMOJI[item.category] || '📦'}</span>
                          <span className={isHousehold ? 'line-through' : ''}>
                            {item.name}
                          </span>
                          {isHousehold && (
                            <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">skipped</span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Bulk Progress */}
          {bulkProgress && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  Bulk Import Progress
                </h3>
                <span className="text-sm text-gray-500">
                  {bulkProgress.current} / {bulkProgress.total}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>

              {/* Current file */}
              {uploading && (
                <p className="text-sm text-gray-500 truncate">
                  Processing: {bulkProgress.currentFile}
                </p>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-emerald-50 rounded-lg p-3">
                  <div className="text-xl font-bold text-emerald-600">{bulkProgress.successful}</div>
                  <div className="text-xs text-emerald-700">Imported</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="text-xl font-bold text-amber-600">{bulkProgress.duplicates}</div>
                  <div className="text-xs text-amber-700">Duplicates</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-xl font-bold text-red-600">{bulkProgress.failed}</div>
                  <div className="text-xs text-red-700">Failed</div>
                </div>
              </div>

              {/* Done button */}
              {!uploading && (
                <button
                  onClick={() => setBulkProgress(null)}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                >
                  Done - View Receipts
                </button>
              )}
            </div>
          )}

          {/* Upload area */}
          {!lastParsedReceipt && !bulkProgress && (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8">
              <div className="text-center">
                <div className="text-4xl mb-4">🧾</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Upload Receipts
                </h3>
                <p className="text-gray-600 mb-4">
                  Select one or multiple PDFs/images. Duplicates are auto-detected.
                </p>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  multiple
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                  id="file-upload"
                  disabled={uploading}
                />
                <label
                  htmlFor="file-upload"
                  className={`inline-block px-6 py-3 rounded-lg font-medium cursor-pointer ${
                    uploading
                      ? 'bg-gray-300 text-gray-500'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {uploading ? 'Processing...' : 'Select Files'}
                </label>
                <p className="text-xs text-gray-400 mt-3">
                  Tip: Select all 57 receipts at once for bulk import
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && analytics && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500">Total Spent</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(analytics.summary.total_spent)}
              </div>
              <div className="text-xs text-gray-400">
                {analytics.summary.receipt_count} receipts
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500">This Month</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(analytics.summary.current_month_spend)}
              </div>
              <div
                className={`text-xs ${
                  analytics.summary.month_over_month_percent >= 0
                    ? 'text-red-500'
                    : 'text-emerald-500'
                }`}
              >
                {analytics.summary.month_over_month_percent >= 0 ? '↑' : '↓'}
                {Math.abs(analytics.summary.month_over_month_percent).toFixed(1)}% vs last month
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500">Avg per Trip</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(analytics.summary.avg_per_trip)}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500">Items Tracked</div>
              <div className="text-2xl font-bold text-gray-900">
                {analytics.summary.item_count}
              </div>
            </div>
          </div>

          {/* Monthly Spending Chart */}
          {analytics.monthly_spending.length > 0 && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Monthly Spending</h3>
              <div className="flex items-end gap-2 h-48">
                {analytics.monthly_spending.map((m) => {
                  const maxSpend = Math.max(...analytics.monthly_spending.map((x) => x.total))
                  const height = maxSpend > 0 ? (m.total / maxSpend) * 100 : 0
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center">
                      <div className="text-xs text-gray-500 mb-1">
                        {formatCurrency(m.total)}
                      </div>
                      <div
                        className="w-full bg-emerald-500 rounded-t transition-all"
                        style={{ height: `${height}%`, minHeight: m.total > 0 ? '8px' : '0' }}
                      ></div>
                      <div className="text-xs text-gray-500 mt-2">
                        {new Date(m.month + '-01').toLocaleDateString('en', { month: 'short' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Category & Top Items */}
          <div className="grid md:grid-cols-2 gap-6">
            {analytics.category_breakdown.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">Spending by Category</h3>
                <div className="space-y-3">
                  {analytics.category_breakdown.slice(0, 8).map((cat) => {
                    const maxSpend = analytics.category_breakdown[0]?.total || 1
                    const width = (cat.total / maxSpend) * 100
                    return (
                      <div key={cat.category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="capitalize text-gray-700">{cat.category}</span>
                          <span className="text-gray-500">{formatCurrency(cat.total)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getCategoryColor(cat.category)} rounded-full`}
                            style={{ width: `${width}%` }}
                          ></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {analytics.top_items.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">Top Items by Spend</h3>
                <div className="space-y-2">
                  {analytics.top_items.slice(0, 10).map((item, i) => (
                    <div
                      key={item.name}
                      className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm w-5">{i + 1}.</span>
                        <span className="text-gray-700 text-sm">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(item.total)}
                        </div>
                        <div className="text-xs text-gray-400">×{item.count}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {analytics.summary.receipt_count === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No data yet</h3>
              <p className="text-gray-600 mb-4">
                Upload your first receipt to start tracking
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Upload Receipt
              </button>
            </div>
          )}
        </div>
      )}

      {/* Staples Prompt - show when user has 5+ receipts */}
      {receipts.length >= 5 && activeTab === 'dashboard' && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-5 border border-purple-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center text-2xl">
                📊
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Identify Your Staples</h3>
                <p className="text-sm text-gray-600">
                  You have {receipts.length} receipts. Analyze to find items you buy regularly.
                </p>
              </div>
            </div>
            <a
              href="/dashboard/staples"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              Analyze Now
            </a>
          </div>
        </div>
      )}

      {/* Receipts Tab */}
      {activeTab === 'receipts' && (
        <div className="space-y-4">
          {receipts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <div className="text-4xl mb-4">🧾</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No receipts yet</h3>
              <p className="text-gray-600 mb-4">Upload your first receipt to get started</p>
              <button
                onClick={() => setActiveTab('upload')}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Upload Receipt
              </button>
            </div>
          ) : (
            receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="bg-white rounded-xl p-4 border border-gray-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-2xl">
                    🧾
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {receipt.store_name}
                      {receipt.store_branch && (
                        <span className="text-gray-500 font-normal"> - {receipt.store_branch}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(receipt.receipt_date).toLocaleDateString('en-SG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                      {receipt.payment_method && ` • ${receipt.payment_method}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(receipt.total)}
                    </div>
                    {receipt.file_name && (
                      <div className="text-xs text-gray-400 truncate max-w-[150px]">
                        {receipt.file_name}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteReceipt(receipt.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete receipt"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
