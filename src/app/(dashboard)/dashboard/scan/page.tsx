'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Location = 'fridge' | 'freezer' | 'pantry'

interface DetectedItem {
  id?: string  // Present for existing items from inventory
  name: string
  storage_category: string
  nutritional_type: string
  quantity: number
  unit: string
  expiry_date: string
  freshness: string
  confidence: number
  location: string
  selected: boolean
  notDetected?: boolean  // True for items in inventory but not seen in scan
}

interface ExistingInventoryItem {
  id: string
  name: string
  storage_category: string
  nutritional_type: string
  quantity: number
  unit: string
  expiry_date: string
  freshness: string
  confidence: number
  location: string
}

const STORAGE_CATEGORIES = ['produce', 'dairy', 'protein', 'pantry', 'beverage', 'condiment', 'frozen']
const NUTRITIONAL_TYPES = ['protein', 'carbs', 'fibre', 'misc']
const UNITS = ['piece', 'pack', 'bottle', 'carton', 'lb', 'oz', 'gallon', 'bunch', 'bag', 'container', 'can', 'jar']
const FRESHNESS_OPTIONS = ['fresh', 'use_soon', 'expired']

interface SaveResult {
  inserted: number
  updated: number
  deleted: number
  insertedItems: string[]
  updatedItems: string[]
  deletedItems: string[]
  message: string
}

// Normalize item name for matching (lowercase, trim, remove plurals)
function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/s$/, '')
    .replace(/ies$/, 'y')
}

export default function ScanPage() {
  const [step, setStep] = useState<'location' | 'capture' | 'processing' | 'review' | 'success'>('location')
  const [location, setLocation] = useState<Location>('fridge')
  const [images, setImages] = useState<string[]>([])
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [converting, setConverting] = useState(false)
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleLocationSelect = (loc: Location) => {
    setLocation(loc)
    setStep('capture')
  }

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
    const files = e.target.files
    if (!files) return

    setConverting(true)
    setError(null)

    try {
      const conversions = Array.from(files).map(file => convertToJpeg(file))
      const results = await Promise.all(conversions)
      setImages(prev => [...prev, ...results])
    } catch (err) {
      console.error('File processing error:', err)
      setError('Failed to process some images. Please try again.')
    } finally {
      setConverting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleAnalyze = async () => {
    if (images.length === 0) {
      setError('Please add at least one photo')
      return
    }

    setError(null)
    setStep('processing')

    try {
      // Step 1: Analyze images with AI
      const scanResponse = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, location }),
      })

      if (!scanResponse.ok) {
        throw new Error('Failed to analyze images')
      }

      const scanData = await scanResponse.json()

      // Step 2: Fetch existing inventory for this location
      const inventoryResponse = await fetch(`/api/inventory?location=${location}`)
      const inventoryData = await inventoryResponse.json()
      const existingItems: ExistingInventoryItem[] = inventoryData.items || []

      // Step 3: Build normalized name map of detected items
      const detectedNames = new Set(
        scanData.items.map((item: DetectedItem) => normalizeItemName(item.name))
      )

      // Step 4: Find existing items that were NOT detected (will show as qty=0)
      const undetectedItems: DetectedItem[] = existingItems
        .filter(item => !detectedNames.has(normalizeItemName(item.name)))
        .map(item => ({
          id: item.id,
          name: item.name,
          storage_category: item.storage_category,
          nutritional_type: item.nutritional_type,
          quantity: 0,  // Mark as not detected
          unit: item.unit,
          expiry_date: item.expiry_date,
          freshness: item.freshness,
          confidence: 0,
          location: item.location,
          selected: true,  // Include by default so it gets processed
          notDetected: true,  // Visual flag
        }))

      // Step 5: For detected items, check if they match existing items (to preserve ID)
      const detectedWithIds = scanData.items.map((item: DetectedItem) => {
        const normalizedName = normalizeItemName(item.name)
        const existingMatch = existingItems.find(
          e => normalizeItemName(e.name) === normalizedName
        )
        return {
          ...item,
          id: existingMatch?.id,  // Attach existing ID if found
          selected: item.confidence >= 0.7,
          notDetected: false,
        }
      })

      // Step 6: Merge: detected items first, then undetected items
      const mergedItems = [...detectedWithIds, ...undetectedItems]
      setDetectedItems(mergedItems)
      setStep('review')
    } catch (err) {
      console.error('Analysis error:', err)
      setError('Failed to analyze images. Please try again.')
      setStep('capture')
    }
  }

  const toggleItemSelection = (index: number) => {
    setDetectedItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    )
  }

  const updateItemField = (index: number, field: keyof DetectedItem, value: string | number) => {
    setDetectedItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    )
  }

  const deleteItem = (index: number) => {
    setDetectedItems(prev => prev.filter((_, i) => i !== index))
    setEditingIndex(null)
  }

  const handleSave = async () => {
    const selectedItems = detectedItems.filter(item => item.selected)

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedItems,
          location: location,
          syncMode: true,  // Enable smart sync
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save items')
      }

      const result = await response.json()
      setSaveResult(result)
      setStep('success')
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save items. Please try again.')
      setSaving(false)
    }
  }

  // Count items that will be removed (qty = 0 and selected)
  const itemsToRemove = detectedItems.filter(i => i.selected && i.quantity === 0).length
  const itemsToKeep = detectedItems.filter(i => i.selected && i.quantity > 0).length

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Scan Your {location.charAt(0).toUpperCase() + location.slice(1)}</h1>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Step 1: Location Selection */}
      {step === 'location' && (
        <div className="space-y-4">
          <p className="text-gray-600">What would you like to scan?</p>
          <div className="grid grid-cols-3 gap-4">
            <LocationButton
              icon="🧊"
              label="Fridge"
              onClick={() => handleLocationSelect('fridge')}
            />
            <LocationButton
              icon="❄️"
              label="Freezer"
              onClick={() => handleLocationSelect('freezer')}
            />
            <LocationButton
              icon="🥫"
              label="Pantry"
              onClick={() => handleLocationSelect('pantry')}
            />
          </div>
        </div>
      )}

      {/* Step 2: Photo Capture */}
      {step === 'capture' && (
        <div className="space-y-6">
          {/* Location indicator */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              {location === 'fridge' ? '🧊' : location === 'freezer' ? '❄️' : '🥫'}
            </span>
            <span className="font-medium">{location.charAt(0).toUpperCase() + location.slice(1)}</span>
            <button
              onClick={() => setStep('location')}
              className="ml-2 text-sm text-emerald-600 hover:text-emerald-700"
            >
              Change
            </button>
          </div>

          {/* Image preview grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {images.map((img, index) => (
                <div key={index} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={img}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-sm hover:bg-red-600 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Converting indicator */}
          {converting && (
            <div className="text-center py-4">
              <div className="w-6 h-6 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Processing images...</p>
            </div>
          )}

          {/* Add photo button */}
          <div
            onClick={() => !converting && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              converting
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50'
            }`}
          >
            <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="mt-2 text-gray-600">
              {images.length === 0 ? 'Click to add photos' : 'Add more photos'}
            </p>
            <p className="text-sm text-gray-400">Supports HEIC, JPG, PNG - Take multiple shots to capture all items</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                setImages([])
                setStep('location')
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAnalyze}
              disabled={images.length === 0 || converting}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Analyze {images.length > 0 && `(${images.length} photo${images.length > 1 ? 's' : ''})`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Processing */}
      {step === 'processing' && (
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-900">Analyzing your photos...</p>
          <p className="text-gray-500">Our AI is identifying items in your {location}</p>
        </div>
      )}

      {/* Step 4: Review Results */}
      {step === 'review' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">
                Found <span className="font-semibold text-emerald-600">{detectedItems.filter(i => !i.notDetected).length}</span> items
                {detectedItems.filter(i => i.notDetected).length > 0 && (
                  <span className="text-amber-600 ml-1">
                    ({detectedItems.filter(i => i.notDetected).length} not detected)
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-400">
                Review and adjust quantities. Items at 0 will be removed.
              </p>
            </div>
            <button
              onClick={() => {
                setStep('capture')
                setDetectedItems([])
              }}
              className="text-sm text-emerald-600 hover:text-emerald-700"
            >
              Scan again
            </button>
          </div>

          {/* Info banner about undetected items */}
          {detectedItems.filter(i => i.notDetected).length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>Items not detected</strong> are shown with qty=0 and will be removed from inventory.
              Edit the quantity to keep them.
            </div>
          )}

          {/* Scanned Photos Reference */}
          {images.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Scanned photos ({images.length})</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`Photo ${i + 1}`}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-gray-200"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Items list */}
          <div className="space-y-3">
            {detectedItems.map((item, index) => (
              <div
                key={index}
                className={`rounded-lg border-2 transition-colors overflow-hidden ${
                  item.notDetected
                    ? 'border-amber-300 bg-amber-50'
                    : item.selected
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {/* Item header - always visible */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleItemSelection(index)}
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        item.selected
                          ? item.notDetected
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      {item.selected && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Item summary */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
                          {item.notDetected && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                              Not detected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!item.notDetected && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                item.confidence >= 0.8
                                  ? 'bg-green-100 text-green-700'
                                  : item.confidence >= 0.6
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {Math.round(item.confidence * 100)}%
                            </span>
                          )}
                          <button
                            onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                            className="text-gray-400 hover:text-emerald-600"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteItem(index)}
                            className="text-gray-400 hover:text-red-600"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          item.quantity === 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {item.quantity === 0 ? '0 (will remove)' : `${item.quantity} ${item.unit}`}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-blue-100 rounded text-blue-700">
                          {item.storage_category}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-purple-100 rounded text-purple-700">
                          {item.nutritional_type}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          item.freshness === 'fresh'
                            ? 'bg-green-100 text-green-700'
                            : item.freshness === 'use_soon'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {item.freshness.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded edit form */}
                {editingIndex === index && (
                  <div className="border-t border-gray-200 bg-white p-4 space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItemField(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>

                    {/* Quantity and Unit */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Quantity {item.notDetected && <span className="text-amber-600">(set &gt; 0 to keep)</span>}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={item.quantity}
                          onChange={(e) => updateItemField(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateItemField(index, 'unit', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          {UNITS.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Storage Category and Nutritional Type */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Storage Category</label>
                        <select
                          value={item.storage_category}
                          onChange={(e) => updateItemField(index, 'storage_category', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          {STORAGE_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Nutritional Type</label>
                        <select
                          value={item.nutritional_type}
                          onChange={(e) => updateItemField(index, 'nutritional_type', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          {NUTRITIONAL_TYPES.map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Expiry Date and Freshness */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Expiry Date</label>
                        <input
                          type="date"
                          value={item.expiry_date}
                          onChange={(e) => updateItemField(index, 'expiry_date', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Freshness</label>
                        <select
                          value={item.freshness}
                          onChange={(e) => updateItemField(index, 'freshness', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          {FRESHNESS_OPTIONS.map(f => (
                            <option key={f} value={f}>{f.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Done editing button */}
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      Done Editing
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {detectedItems.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No items detected. Try scanning again with better lighting.</p>
            </div>
          )}

          {/* Save button */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                setImages([])
                setDetectedItems([])
                setStep('location')
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || detectedItems.filter(i => i.selected).length === 0}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : (
                <>
                  Save ({itemsToKeep} keep{itemsToRemove > 0 ? `, ${itemsToRemove} remove` : ''})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Success */}
      {step === 'success' && saveResult && (
        <div className="space-y-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Inventory Updated!</h2>
            <p className="text-gray-600 mt-1">{saveResult.message}</p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-700">{saveResult.inserted}</div>
              <div className="text-sm text-green-600">Added</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-700">{saveResult.updated}</div>
              <div className="text-sm text-blue-600">Updated</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-700">{saveResult.deleted}</div>
              <div className="text-sm text-red-600">Removed</div>
            </div>
          </div>

          {/* Inserted items details */}
          {saveResult.insertedItems.length > 0 && (
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-800 mb-2">Added:</h3>
              <ul className="text-sm text-green-700 space-y-1">
                {saveResult.insertedItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Updated items details */}
          {saveResult.updatedItems.length > 0 && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2">Updated:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                {saveResult.updatedItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Deleted items details */}
          {saveResult.deletedItems.length > 0 && (
            <div className="p-4 bg-red-50 rounded-lg">
              <h3 className="font-medium text-red-800 mb-2">Removed:</h3>
              <ul className="text-sm text-red-700 space-y-1">
                {saveResult.deletedItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                setImages([])
                setDetectedItems([])
                setSaveResult(null)
                setStep('location')
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Scan More
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

function LocationButton({
  icon,
  label,
  onClick,
}: {
  icon: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="p-6 rounded-xl border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-colors text-center"
    >
      <span className="text-4xl block mb-2">{icon}</span>
      <span className="font-medium text-gray-700">{label}</span>
    </button>
  )
}
