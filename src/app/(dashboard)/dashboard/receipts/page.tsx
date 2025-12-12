'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ParsedReceipt, ReceiptItem } from '@/lib/gemini/receipt-parser'

type Location = 'fridge' | 'freezer' | 'pantry'

interface InventoryItem extends ReceiptItem {
  selected: boolean
  location: Location
}

// Category to location mapping
const CATEGORY_TO_LOCATION: Record<string, Location | null> = {
  produce: 'fridge',
  dairy: 'fridge',
  protein: 'fridge',
  frozen: 'freezer',
  pantry: 'pantry',
  beverage: 'pantry',
  snacks: 'pantry',
  bakery: 'pantry',
  household: null, // Skip household items
  other: 'pantry',
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

export default function ReceiptsPage() {
  const [step, setStep] = useState<'capture' | 'processing' | 'review' | 'success'>('capture')
  const [file, setFile] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileType, setFileType] = useState<string | null>(null)
  const [parsedReceipt, setParsedReceipt] = useState<ParsedReceipt | null>(null)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<{ store: string; date: string; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Compress image using canvas - max 1200px width, 0.7 quality
  const compressImage = (dataUrl: string, maxWidth = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // Scale down if too large
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = dataUrl
    })
  }

  // Convert HEIC to JPEG and compress
  const convertToJpeg = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic')

      if (isHeic) {
        import('heic2any').then(async (heic2any) => {
          try {
            const blob = await heic2any.default({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.8,
            })
            const reader = new FileReader()
            reader.onload = async () => {
              const compressed = await compressImage(reader.result as string)
              resolve(compressed)
            }
            reader.onerror = reject
            reader.readAsDataURL(blob as Blob)
          } catch (err) {
            console.error('HEIC conversion failed:', err)
            const reader = new FileReader()
            reader.onload = async () => {
              const compressed = await compressImage(reader.result as string)
              resolve(compressed)
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
          }
        })
      } else {
        const reader = new FileReader()
        reader.onload = async () => {
          const compressed = await compressImage(reader.result as string)
          resolve(compressed)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      }
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setConverting(true)
    setError(null)

    try {
      const isPdf = selectedFile.type === 'application/pdf'

      if (isPdf) {
        // For PDFs, just read as base64
        const reader = new FileReader()
        reader.onload = () => {
          setFile(reader.result as string)
          setFileName(selectedFile.name)
          setFileType('application/pdf')
          setConverting(false)
        }
        reader.onerror = () => {
          setError('Failed to read PDF file')
          setConverting(false)
        }
        reader.readAsDataURL(selectedFile)
      } else {
        // For images, convert and compress
        const converted = await convertToJpeg(selectedFile)
        setFile(converted)
        setFileName(selectedFile.name)
        setFileType('image/jpeg')
        setConverting(false)
      }
    } catch (err) {
      console.error('File processing error:', err)
      setError('Failed to process file. Please try again.')
      setConverting(false)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeFile = () => {
    setFile(null)
    setFileName(null)
    setFileType(null)
  }

  const handleAnalyze = async () => {
    if (!file) {
      setError('Please upload a receipt')
      return
    }

    setError(null)
    setDuplicateWarning(null)
    setStep('processing')

    try {
      const response = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_data: file,
          file_type: fileType,
          file_name: fileName,
        }),
      })

      const data = await response.json()

      // Handle duplicate receipt
      if (response.status === 409) {
        setDuplicateWarning(data.existing)
        setError(data.error)
        setStep('capture')
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse receipt')
      }

      // Set parsed receipt data
      setParsedReceipt(data.parsed)

      // Convert items to inventory items with default locations
      const items: InventoryItem[] = data.parsed.items.map((item: ReceiptItem) => {
        const defaultLocation = CATEGORY_TO_LOCATION[item.category]
        return {
          ...item,
          selected: defaultLocation !== null, // Auto-select if not household
          location: defaultLocation || 'pantry',
        }
      })

      setInventoryItems(items)
      setStep('review')
    } catch (err) {
      console.error('Analysis error:', err)
      setError('Failed to analyze receipt. Please try again.')
      setStep('capture')
    }
  }

  const toggleItemSelection = (index: number) => {
    setInventoryItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    )
  }

  const updateItemLocation = (index: number, location: Location) => {
    setInventoryItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, location } : item
      )
    )
  }

  const handleAddToInventory = async () => {
    const selectedItems = inventoryItems.filter(item => item.selected)

    if (selectedItems.length === 0) {
      setError('Please select at least one item to add')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/receipts/to-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_date: parsedReceipt?.receipt_date,
          items: selectedItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            location: item.location,
            category: item.category,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add items to inventory')
      }

      setStep('success')
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to add items to inventory. Please try again.')
      setSaving(false)
    }
  }

  const selectedCount = inventoryItems.filter(i => i.selected).length

  return (
    <div className="max-w-2xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Upload Receipt</h1>
        <p className="text-gray-600 text-sm mt-1">
          Scan your grocery receipt to quickly add items to inventory
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="font-semibold text-amber-900 mb-1">Duplicate Receipt Detected</h3>
          <p className="text-sm text-amber-800">
            You already uploaded a receipt from <strong>{duplicateWarning.store}</strong> on{' '}
            <strong>{new Date(duplicateWarning.date).toLocaleDateString()}</strong> for{' '}
            <strong>${duplicateWarning.total.toFixed(2)}</strong>
          </p>
        </div>
      )}

      {/* Step 1: Capture */}
      {step === 'capture' && (
        <div className="space-y-6">
          {/* File preview */}
          {file && (
            <div className="relative rounded-2xl overflow-hidden bg-gray-100">
              {fileType === 'application/pdf' ? (
                <div className="p-8 text-center">
                  <svg className="w-16 h-16 mx-auto text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  <p className="mt-2 text-gray-700 font-medium">{fileName}</p>
                  <p className="text-sm text-gray-500">PDF Receipt</p>
                </div>
              ) : (
                <img
                  src={file}
                  alt="Receipt preview"
                  className="w-full h-auto"
                />
              )}
              <button
                onClick={removeFile}
                className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center justify-center"
              >
                ×
              </button>
            </div>
          )}

          {/* Converting indicator */}
          {converting && (
            <div className="text-center py-4">
              <div className="w-6 h-6 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Processing file...</p>
            </div>
          )}

          {/* Upload button */}
          {!file && !converting && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
            >
              <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="mt-4 text-lg font-medium text-gray-700">
                Upload Receipt
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Click to take a photo, choose from gallery, or upload PDF
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supports JPG, PNG, HEIC, PDF
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif,.pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Action buttons */}
          {file && (
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setFile(null)
                  setFileName(null)
                  setFileType(null)
                }}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                disabled={converting}
                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Analyze Receipt
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Processing */}
      {step === 'processing' && (
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-900">Analyzing receipt...</p>
          <p className="text-gray-500">Our AI is extracting items and prices</p>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && parsedReceipt && (
        <div className="space-y-6">
          {/* Receipt details card */}
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Receipt Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Store:</span>
                <span className="font-medium text-gray-900">{parsedReceipt.store_name}</span>
              </div>
              {parsedReceipt.store_branch && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Branch:</span>
                  <span className="font-medium text-gray-900">{parsedReceipt.store_branch}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium text-gray-900">
                  {new Date(parsedReceipt.receipt_date).toLocaleDateString()}
                </span>
              </div>
              {parsedReceipt.receipt_number && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Receipt #:</span>
                  <span className="font-medium text-gray-900">{parsedReceipt.receipt_number}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-600">Total:</span>
                <span className="font-bold text-gray-900 text-lg">
                  ${parsedReceipt.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Items selection */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Select Items to Add ({selectedCount} selected)
              </h2>
              <button
                onClick={() => {
                  setStep('capture')
                  setParsedReceipt(null)
                  setInventoryItems([])
                }}
                className="text-sm text-emerald-600 hover:text-emerald-700"
              >
                Scan again
              </button>
            </div>

            <div className="space-y-3">
              {inventoryItems.map((item, index) => {
                const emoji = CATEGORY_EMOJI[item.category] || '📦'
                const isHousehold = item.category === 'household'

                return (
                  <div
                    key={index}
                    className={`rounded-2xl border-2 transition-colors p-4 ${
                      isHousehold
                        ? 'border-gray-200 bg-gray-50 opacity-60'
                        : item.selected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => !isHousehold && toggleItemSelection(index)}
                        disabled={isHousehold}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                          isHousehold
                            ? 'border-gray-300 bg-gray-200 cursor-not-allowed'
                            : item.selected
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-gray-300 hover:border-emerald-400'
                        }`}
                      >
                        {item.selected && !isHousehold && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Item details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{emoji}</span>
                            <h3 className="font-medium text-gray-900">{item.name}</h3>
                            {isHousehold && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                                Household
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                            ${item.total_price.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                          <span>
                            {item.quantity} {item.unit}
                          </span>
                          {item.unit_price && (
                            <span className="text-gray-400">
                              @ ${item.unit_price.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Location dropdown - only for selected non-household items */}
                        {item.selected && !isHousehold && (
                          <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Storage Location
                            </label>
                            <select
                              value={item.location}
                              onChange={(e) => updateItemLocation(index, e.target.value as Location)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                              <option value="fridge">🧊 Fridge</option>
                              <option value="freezer">❄️ Freezer</option>
                              <option value="pantry">🥫 Pantry</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Add to inventory button */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                setFile(null)
                setFileName(null)
                setFileType(null)
                setParsedReceipt(null)
                setInventoryItems([])
                setStep('capture')
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToInventory}
              disabled={saving || selectedCount === 0}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Adding...' : `Add to Inventory (${selectedCount})`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 'success' && (
        <div className="space-y-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Items Added!</h2>
            <p className="text-gray-600 mt-1">
              {selectedCount} item{selectedCount !== 1 ? 's' : ''} added to your inventory
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                setFile(null)
                setFileName(null)
                setFileType(null)
                setParsedReceipt(null)
                setInventoryItems([])
                setSaving(false)
                setStep('capture')
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Upload Another
            </button>
            <button
              onClick={() => router.push('/dashboard/inventory')}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              View Inventory
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
