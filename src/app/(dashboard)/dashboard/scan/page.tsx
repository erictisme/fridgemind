'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Location = 'fridge' | 'freezer' | 'pantry'

interface DetectedItem {
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
}

export default function ScanPage() {
  const [step, setStep] = useState<'location' | 'capture' | 'processing' | 'review'>('location')
  const [location, setLocation] = useState<Location>('fridge')
  const [images, setImages] = useState<string[]>([])
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleLocationSelect = (loc: Location) => {
    setLocation(loc)
    setStep('capture')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newImages: string[] = []
    const readers: Promise<string>[] = []

    Array.from(files).forEach(file => {
      readers.push(
        new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => {
            resolve(reader.result as string)
          }
          reader.readAsDataURL(file)
        })
      )
    })

    Promise.all(readers).then(results => {
      setImages(prev => [...prev, ...results])
    })
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
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, location }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze images')
      }

      const data = await response.json()

      // Add selected flag to each item
      const itemsWithSelection = data.items.map((item: DetectedItem) => ({
        ...item,
        selected: item.confidence >= 0.7, // Auto-select high confidence items
      }))

      setDetectedItems(itemsWithSelection)
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

  const handleSave = async () => {
    const selectedItems = detectedItems.filter(item => item.selected)

    if (selectedItems.length === 0) {
      setError('Please select at least one item to save')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems }),
      })

      if (!response.ok) {
        throw new Error('Failed to save items')
      }

      // Redirect to inventory page
      router.push('/dashboard/inventory')
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save items. Please try again.')
      setSaving(false)
    }
  }

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
                <div key={index} className="relative aspect-square">
                  <img
                    src={img}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add photo button */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
          >
            <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="mt-2 text-gray-600">
              {images.length === 0 ? 'Click to add photos' : 'Add more photos'}
            </p>
            <p className="text-sm text-gray-400">Take multiple shots to capture all items</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
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
              disabled={images.length === 0}
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
                Found <span className="font-semibold text-emerald-600">{detectedItems.length}</span> items
              </p>
              <p className="text-sm text-gray-400">
                Select items to add to your inventory
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

          {/* Items list */}
          <div className="space-y-3">
            {detectedItems.map((item, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  item.selected
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleItemSelection(index)}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mt-1 ${
                      item.selected
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-gray-300'
                    }`}
                  >
                    {item.selected && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Item details */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItemField(index, 'name', e.target.value)}
                        className="font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 focus:outline-none"
                      />
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          item.confidence >= 0.8
                            ? 'bg-green-100 text-green-700'
                            : item.confidence >= 0.6
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {Math.round(item.confidence * 100)}% confident
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">
                        {item.quantity} {item.unit}
                      </span>
                      <span className="px-2 py-1 bg-blue-100 rounded text-blue-700">
                        {item.storage_category}
                      </span>
                      <span className="px-2 py-1 bg-purple-100 rounded text-purple-700">
                        {item.nutritional_type}
                      </span>
                      <span className={`px-2 py-1 rounded ${
                        item.freshness === 'fresh'
                          ? 'bg-green-100 text-green-700'
                          : item.freshness === 'use_soon'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {item.freshness.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500">
                      Expires: {new Date(item.expiry_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

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
              {saving ? 'Saving...' : `Save ${detectedItems.filter(i => i.selected).length} items`}
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
