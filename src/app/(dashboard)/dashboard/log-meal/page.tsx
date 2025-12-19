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
  fiber_grams: number
  vegetable_servings: number
  health_assessment: string
  notes: string
}

interface HouseholdMember {
  id: string
  name: string
  portion: number // percentage 0-100
}

type MealSource = 'home' | 'out'
type MealType = 'home' | 'out' // keep for backward compatibility
type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'snack'
type Step = 'choose' | 'select-items' | 'capture' | 'analyzing' | 'result'

const HOUSEHOLD_MEMBERS: HouseholdMember[] = [
  { id: 'eric', name: 'Eric', portion: 50 },
  { id: 'yy', name: 'YY', portion: 50 },
]

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
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Meal metadata
  const [mealDate, setMealDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [mealTime, setMealTime] = useState<MealTime>(() => {
    const hour = new Date().getHours()
    if (hour < 11) return 'breakfast'
    if (hour < 15) return 'lunch'
    if (hour < 21) return 'dinner'
    return 'snack'
  })
  const [householdPortions, setHouseholdPortions] = useState<HouseholdMember[]>(HOUSEHOLD_MEMBERS)
  const [divideBy, setDivideBy] = useState<number>(1) // For receipts - divide total by X people
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchInventory()
  }, [])

  // Auto-analyze when image is set (eating out mode)
  useEffect(() => {
    if (image && mealType === 'out' && step === 'capture') {
      handleAnalyzeOutMeal()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image])

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

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set false if leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setError(null)

    const files = e.dataTransfer.files
    if (files.length === 0) return

    const file = files[0]
    if (!file.type.startsWith('image/')) {
      setError('Please drop an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      const compressed = await compressImage(reader.result as string)
      setImage(compressed)
    }
    reader.readAsDataURL(file)
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
    setMealDate(new Date().toISOString().split('T')[0])
    const hour = new Date().getHours()
    setMealTime(hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 21 ? 'dinner' : 'snack')
    setHouseholdPortions(HOUSEHOLD_MEMBERS)
    setDivideBy(1)
  }

  const updatePortions = (memberId: string, newPortion: number) => {
    setHouseholdPortions(prev => prev.map(m =>
      m.id === memberId ? { ...m, portion: Math.max(0, Math.min(100, newPortion)) } : m
    ))
  }

  const toggleMemberActive = (memberId: string) => {
    setHouseholdPortions(prev => {
      const member = prev.find(m => m.id === memberId)
      if (!member) return prev

      if (member.portion > 0) {
        // Deactivate: set to 0
        return prev.map(m => m.id === memberId ? { ...m, portion: 0 } : m)
      } else {
        // Activate: split evenly with other active members
        const activeCount = prev.filter(m => m.portion > 0).length + 1
        const evenPortion = Math.round(100 / activeCount)
        return prev.map(m => {
          if (m.id === memberId) return { ...m, portion: evenPortion }
          if (m.portion > 0) return { ...m, portion: evenPortion }
          return m
        })
      }
    })
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
              ref={dropZoneRef}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-amber-500 bg-amber-100'
                  : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50'
              }`}
            >
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">{isDragging ? '📥' : '📸'}</span>
              </div>
              <p className="font-medium text-gray-900 mb-1">
                {isDragging ? 'Drop your photo here' : 'Take or drop a photo'}
              </p>
              <p className="text-sm text-gray-500">
                {isDragging ? 'Release to upload' : 'Drag & drop or click to select'}
              </p>
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
          {/* Meal photo or placeholder */}
          <div className="relative">
            {image ? (
              <img
                src={image}
                alt="Meal"
                className="w-full aspect-video object-cover rounded-2xl"
              />
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video bg-gray-100 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
              >
                <span className="text-4xl mb-2">📷</span>
                <span className="text-sm text-gray-500">Add photo</span>
              </div>
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

          {/* Quick Metadata Form */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-4">
            {/* Date & Meal Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={mealDate}
                  onChange={(e) => setMealDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Meal</label>
                <select
                  value={mealTime}
                  onChange={(e) => setMealTime(e.target.value as MealTime)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white text-sm"
                >
                  <option value="breakfast">🌅 Breakfast</option>
                  <option value="lunch">☀️ Lunch</option>
                  <option value="dinner">🌙 Dinner</option>
                  <option value="snack">🍿 Snack</option>
                </select>
              </div>
            </div>

            {/* Who ate - Household portions */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Who ate this?</label>
              <div className="space-y-2">
                {householdPortions.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <button
                      onClick={() => toggleMemberActive(member.id)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                        member.portion > 0
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {member.name[0]}
                    </button>
                    <span className={`text-sm font-medium w-12 ${member.portion > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                      {member.name}
                    </span>
                    {member.portion > 0 && (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={member.portion}
                          onChange={(e) => updatePortions(member.id, parseInt(e.target.value))}
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <span className="text-sm font-medium text-gray-700 w-12 text-right">{member.portion}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Portion warning if not 100% */}
              {householdPortions.reduce((sum, m) => sum + m.portion, 0) !== 100 && householdPortions.some(m => m.portion > 0) && (
                <p className="text-xs text-amber-600 mt-2">
                  ⚠️ Portions total {householdPortions.reduce((sum, m) => sum + m.portion, 0)}% (should be 100%)
                </p>
              )}
            </div>

            {/* Divide by (for sharing/receipts) */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Divide by <span className="text-gray-400">(e.g., shared with others)</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDivideBy(Math.max(1, divideBy - 1))}
                  className="w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-700"
                >
                  -
                </button>
                <span className="text-lg font-bold text-gray-900 w-8 text-center">{divideBy}</span>
                <button
                  onClick={() => setDivideBy(divideBy + 1)}
                  className="w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-700"
                >
                  +
                </button>
                <span className="text-sm text-gray-500 ml-2">
                  {divideBy > 1 ? `(${Math.round(nutrition.estimated_calories / divideBy)} cal each)` : 'person'}
                </span>
              </div>
            </div>
          </div>

          {/* Nutrition breakdown (collapsed summary) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Nutrition</h3>
              <span className="text-sm text-gray-500">
                {divideBy > 1 ? `÷${divideBy} = ` : ''}
                {Math.round(nutrition.estimated_calories / divideBy)} cal
              </span>
            </div>

            {/* Compact macros */}
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="bg-orange-50 rounded-lg p-2">
                <div className="text-lg font-bold text-orange-600">{Math.round(nutrition.estimated_calories / divideBy)}</div>
                <div className="text-xs text-orange-600">Cal</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-2">
                <div className="text-lg font-bold text-blue-600">{Math.round(nutrition.protein_grams / divideBy)}g</div>
                <div className="text-xs text-blue-600">Protein</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-2">
                <div className="text-lg font-bold text-amber-600">{Math.round(nutrition.carbs_grams / divideBy)}g</div>
                <div className="text-xs text-amber-600">Carbs</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-2">
                <div className="text-lg font-bold text-purple-600">{Math.round(nutrition.fat_grams / divideBy)}g</div>
                <div className="text-xs text-purple-600">Fat</div>
              </div>
              <div className="bg-green-50 rounded-lg p-2">
                <div className="text-lg font-bold text-green-600">{(nutrition.vegetable_servings / divideBy).toFixed(1)}</div>
                <div className="text-xs text-green-600">Veggies</div>
              </div>
            </div>

            {/* Components */}
            {nutrition.detected_components.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {nutrition.detected_components.map((component, i) => (
                  <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                    {component}
                  </span>
                ))}
              </div>
            )}
          </div>

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
                Inventory will be updated
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={resetForm}
              disabled={saving}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                setSaving(true)
                try {
                  // Combine date and time to create eaten_at timestamp
                  const eatenAt = new Date(mealDate)
                  const now = new Date()
                  eatenAt.setHours(now.getHours(), now.getMinutes(), 0, 0)

                  // Calculate nutrition per person (divide by divideBy, then apply portion)
                  const activeMembers = householdPortions.filter(m => m.portion > 0)

                  // Save meal for each household member with their portion
                  for (const member of activeMembers) {
                    const portionMultiplier = (member.portion / 100) / divideBy

                    const response = await fetch('/api/log-meal/save', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        meal_name: nutrition.meal_name,
                        meal_source: mealType === 'home' ? 'home_cooked' : 'restaurant',
                        meal_time: mealTime,
                        eaten_at: eatenAt.toISOString(),
                        household_member: member.name,
                        portion_percentage: member.portion,
                        divide_by: divideBy,
                        // Nutrition scaled by portion
                        estimated_calories: Math.round(nutrition.estimated_calories * portionMultiplier),
                        protein_grams: Math.round(nutrition.protein_grams * portionMultiplier),
                        carbs_grams: Math.round(nutrition.carbs_grams * portionMultiplier),
                        fat_grams: Math.round(nutrition.fat_grams * portionMultiplier),
                        fiber_grams: nutrition.fiber_grams ? Math.round(nutrition.fiber_grams * portionMultiplier) : null,
                        vegetable_servings: parseFloat((nutrition.vegetable_servings * portionMultiplier).toFixed(1)),
                        detected_components: nutrition.detected_components,
                        health_assessment: nutrition.health_assessment,
                        ai_notes: nutrition.notes,
                        image_url: image || null,
                      }),
                    })

                    if (!response.ok) {
                      throw new Error('Failed to save meal')
                    }
                  }

                  resetForm()
                } catch (err) {
                  console.error('Save error:', err)
                  setError('Failed to save meal. Please try again.')
                } finally {
                  setSaving(false)
                }
              }}
              disabled={saving}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Meal'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
