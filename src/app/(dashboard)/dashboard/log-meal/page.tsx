'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface InventoryItem {
  id: string
  name: string
  quantity: number
  unit: string
  nutritional_type: string
  location: string
}

interface SelectedItem {
  id: string
  name: string
  quantity: number
  maxQuantity: number
  unit: string
}

interface NutritionData {
  meal_name: string
  detected_components: string[]
  estimated_calories: number
  protein_grams: number
  carbs_grams: number
  fat_grams: number
  vegetable_servings: number
  health_assessment: string
  notes: string
}

type MealType = 'home' | 'out'
type Step = 'choose' | 'select-items' | 'capture' | 'analyzing' | 'result'

const HEALTH_BADGES: Record<string, { label: string; color: string; emoji: string }> = {
  balanced: { label: 'Balanced', color: 'bg-green-100 text-green-700', emoji: '✅' },
  protein_heavy: { label: 'Protein Heavy', color: 'bg-blue-100 text-blue-700', emoji: '💪' },
  carb_heavy: { label: 'Carb Heavy', color: 'bg-amber-100 text-amber-700', emoji: '🍞' },
  high_fat: { label: 'High Fat', color: 'bg-orange-100 text-orange-700', emoji: '🧈' },
  vegetable_rich: { label: 'Veggie Rich', color: 'bg-emerald-100 text-emerald-700', emoji: '🥗' },
  light: { label: 'Light', color: 'bg-sky-100 text-sky-700', emoji: '🍃' },
}

// Food emojis for types
const typeEmojis: Record<string, string> = {
  protein: '🍖',
  carbs: '🍞',
  fibre: '🥬',
  misc: '📦',
  vegetables: '🥬',
  vitamins: '🥬',
  fats: '📦',
  other: '📦',
}

export default function LogMealPage() {
  const [mealType, setMealType] = useState<MealType | null>(null)
  const [step, setStep] = useState<Step>('choose')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [image, setImage] = useState<string | null>(null)
  const [nutrition, setNutrition] = useState<NutritionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    try {
      const response = await fetch('/api/inventory')
      if (response.ok) {
        const data = await response.json()
        setInventory(data.items || [])
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err)
    }
  }

  const compressImage = (dataUrl: string, maxWidth = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    const reader = new FileReader()
    reader.onload = async () => {
      const compressed = await compressImage(reader.result as string)
      setImage(compressed)
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleMealTypeSelect = (type: MealType) => {
    setMealType(type)
    if (type === 'home') {
      setStep('select-items')
    } else {
      setStep('capture')
    }
  }

  const toggleItemSelection = (item: InventoryItem) => {
    setSelectedItems(prev => {
      const existing = prev.find(s => s.id === item.id)
      if (existing) {
        return prev.filter(s => s.id !== item.id)
      } else {
        return [...prev, {
          id: item.id,
          name: item.name,
          quantity: 1,
          maxQuantity: item.quantity,
          unit: item.unit,
        }]
      }
    })
  }

  const updateItemQuantity = (id: string, quantity: number) => {
    setSelectedItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, quantity: Math.min(Math.max(0.5, quantity), item.maxQuantity) } : item
      )
    )
  }

  const handleAnalyzeHomeMeal = async () => {
    if (selectedItems.length === 0) {
      setError('Please select at least one item')
      return
    }

    setStep('analyzing')
    setError(null)

    try {
      const response = await fetch('/api/log-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'home',
          items: selectedItems.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to log meal')
      }

      const data = await response.json()
      setNutrition(data.nutrition)
      setStep('result')
    } catch (err) {
      console.error('Log meal error:', err)
      setError('Failed to log meal. Please try again.')
      setStep('select-items')
    }
  }

  const handleAnalyzeOutMeal = async () => {
    if (!image) return

    setStep('analyzing')
    setError(null)

    try {
      const response = await fetch('/api/log-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'out',
          image,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMsg = errorData.details || errorData.error || 'Failed to analyze meal'
        console.error('API error:', errorMsg)
        throw new Error(errorMsg)
      }

      const data = await response.json()
      setNutrition(data.nutrition)
      setStep('result')
    } catch (err) {
      console.error('Analysis error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze meal. Please try again.'
      setError(errorMessage)
      setStep('capture')
    }
  }

  const resetForm = () => {
    setMealType(null)
    setStep('choose')
    setSelectedItems([])
    setImage(null)
    setNutrition(null)
    setError(null)
  }

  const healthBadge = nutrition ? HEALTH_BADGES[nutrition.health_assessment] || HEALTH_BADGES.balanced : null

  return (
    <div className="max-w-2xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Home
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Log Meal</h1>
        <p className="text-gray-500">Track what you're eating</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl">
          {error}
        </div>
      )}

      {/* Step 1: Choose meal type */}
      {step === 'choose' && (
        <div className="space-y-6">
          <p className="text-gray-600 text-center">Where are you eating?</p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleMealTypeSelect('home')}
              className="p-6 rounded-2xl border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-center"
            >
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">🏠</span>
              </div>
              <h3 className="font-semibold text-gray-900">At Home</h3>
              <p className="text-sm text-gray-500 mt-1">Select from inventory</p>
            </button>

            <button
              onClick={() => handleMealTypeSelect('out')}
              className="p-6 rounded-2xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-center"
            >
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">🍽️</span>
              </div>
              <h3 className="font-semibold text-gray-900">Eating Out</h3>
              <p className="text-sm text-gray-500 mt-1">Take a photo</p>
            </button>
          </div>
        </div>
      )}

      {/* Step 2a: Select items from inventory (home meal) */}
      {step === 'select-items' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">What are you eating?</h2>
              <p className="text-sm text-gray-500">Select items from your inventory</p>
            </div>
            <button
              onClick={() => { setStep('choose'); setMealType(null); setSelectedItems([]) }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
          </div>

          {inventory.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🧊</span>
              </div>
              <p className="text-gray-500 mb-4">Your inventory is empty</p>
              <Link
                href="/dashboard/scan"
                className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Scan Your Kitchen
              </Link>
            </div>
          ) : (
            <>
              {/* Inventory items */}
              <div className="space-y-2">
                {inventory.map(item => {
                  const isSelected = selectedItems.some(s => s.id === item.id)
                  const selectedItem = selectedItems.find(s => s.id === item.id)
                  const emoji = typeEmojis[item.nutritional_type] || '📦'

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div
                        onClick={() => toggleItemSelection(item)}
                        className="p-4 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-xl">{emoji}</span>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900">{item.name}</h3>
                            <p className="text-sm text-gray-500">
                              {item.quantity} {item.unit} available • {item.location}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Quantity selector when selected */}
                      {isSelected && selectedItem && (
                        <div className="px-4 pb-4 pt-0">
                          <div className="flex items-center gap-3 bg-white rounded-lg p-2 border border-gray-200">
                            <span className="text-sm text-gray-600">Amount used:</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateItemQuantity(item.id, selectedItem.quantity - 0.5) }}
                              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold"
                            >
                              -
                            </button>
                            <span className="font-medium text-gray-900 min-w-[60px] text-center">
                              {selectedItem.quantity} {item.unit}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateItemQuantity(item.id, selectedItem.quantity + 0.5) }}
                              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Selected summary and submit */}
              {selectedItems.length > 0 && (
                <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-4 px-4 py-4 mt-4">
                  <div className="mb-3">
                    <p className="text-sm text-gray-600">
                      Selected: {selectedItems.map(i => `${i.quantity} ${i.unit} ${i.name}`).join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={handleAnalyzeHomeMeal}
                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                  >
                    Log Meal ({selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 2b: Capture photo (eating out) */}
      {step === 'capture' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Take a photo</h2>
              <p className="text-sm text-gray-500">We'll estimate the nutrition</p>
            </div>
            <button
              onClick={() => { setStep('choose'); setMealType(null); setImage(null) }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
          </div>

          {image ? (
            <div className="relative">
              <img
                src={image}
                alt="Meal"
                className="w-full aspect-video object-cover rounded-2xl"
              />
              <button
                onClick={() => setImage(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
              >
                ×
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-colors"
            >
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📸</span>
              </div>
              <p className="font-medium text-gray-900 mb-1">Take a photo of your meal</p>
              <p className="text-sm text-gray-500">We'll estimate the nutritional content</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {image && (
            <button
              onClick={handleAnalyzeOutMeal}
              className="w-full py-4 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors"
            >
              Analyze Nutrition
            </button>
          )}
        </div>
      )}

      {/* Step 3: Analyzing */}
      {step === 'analyzing' && (
        <div className="text-center py-16">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-900">
            {mealType === 'home' ? 'Calculating nutrition...' : 'Analyzing your meal...'}
          </p>
          <p className="text-gray-500">
            {mealType === 'home' ? 'Estimating combined nutrition' : 'Estimating nutritional content'}
          </p>
        </div>
      )}

      {/* Step 4: Results */}
      {step === 'result' && nutrition && (
        <div className="space-y-6">
          {/* Meal photo (if eating out) */}
          {mealType === 'out' && image && (
            <img
              src={image}
              alt="Meal"
              className="w-full aspect-video object-cover rounded-2xl"
            />
          )}

          {/* Meal source badge */}
          <div className="flex items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded-full ${
              mealType === 'home'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {mealType === 'home' ? '🏠 Home Meal' : '🍽️ Eating Out'}
            </span>
            {mealType === 'home' && (
              <span className="text-xs text-gray-500">
                Inventory updated
              </span>
            )}
          </div>

          {/* Meal name and health badge */}
          <div>
            <h2 className="text-xl font-bold text-gray-900">{nutrition.meal_name}</h2>
            {healthBadge && (
              <span className={`inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full mt-2 ${healthBadge.color}`}>
                {healthBadge.emoji} {healthBadge.label}
              </span>
            )}
          </div>

          {/* Nutrition breakdown */}
          <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Estimated Nutrition</h3>

            {/* Calories */}
            <div className="text-center py-4 bg-white rounded-xl">
              <div className="text-3xl font-bold text-gray-900">{nutrition.estimated_calories}</div>
              <div className="text-sm text-gray-500">calories</div>
            </div>

            {/* Macros */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{nutrition.protein_grams}g</div>
                <div className="text-xs text-blue-600">Protein</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{nutrition.carbs_grams}g</div>
                <div className="text-xs text-amber-600">Carbs</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{nutrition.fat_grams}g</div>
                <div className="text-xs text-orange-600">Fat</div>
              </div>
            </div>

            {/* Veggies */}
            <div className="flex items-center justify-between bg-green-50 rounded-xl p-4">
              <span className="text-green-700">Vegetable Servings</span>
              <span className="text-xl font-bold text-green-600">{nutrition.vegetable_servings}</span>
            </div>

            {/* Components */}
            {nutrition.detected_components.length > 0 && (
              <div>
                <div className="text-sm text-gray-500 mb-2">Components:</div>
                <div className="flex flex-wrap gap-2">
                  {nutrition.detected_components.map((component, i) => (
                    <span key={i} className="text-xs bg-white px-2 py-1 rounded-lg text-gray-700">
                      {component}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Notes */}
            {nutrition.notes && (
              <p className="text-sm text-gray-600 italic">{nutrition.notes}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={resetForm}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
            >
              Log Another
            </button>
            <Link
              href="/dashboard"
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium text-center hover:bg-emerald-700"
            >
              Done
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
