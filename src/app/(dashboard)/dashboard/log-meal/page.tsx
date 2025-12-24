'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { uploadMealPhoto } from '@/lib/supabase/storage'

interface FatSecretFood {
  id: string
  name: string
  brand?: string
  description?: string
}

interface NutritionData {
  food_id?: string
  food_name?: string
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
  source: 'fatsecret' | 'gemini' | 'manual'
}

type MealSource = 'home' | 'out'
type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'snack'
type Step = 'capture' | 'search' | 'analyzing' | 'result' | 'leftovers'

const getMealTimeFromHour = (): MealTime => {
  const hour = new Date().getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

export default function LogMealPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('capture')
  const [mealSource, setMealSource] = useState<MealSource>('out')
  const [image, setImage] = useState<string | null>(null)
  const [mealName, setMealName] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [nutrition, setNutrition] = useState<NutritionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // FatSecret search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FatSecretFood[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Meal metadata
  const [mealDate, setMealDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [mealTime, setMealTime] = useState<MealTime>(getMealTimeFromHour)
  const [saving, setSaving] = useState(false)

  // Leftovers
  const [leftoverName, setLeftoverName] = useState('')
  const [leftoverExpiry, setLeftoverExpiry] = useState(3)

  // Debounced FatSecret search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(`/api/fatsecret/search?q=${encodeURIComponent(searchQuery)}&max=8`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.foods || [])
        }
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

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
      // Auto-analyze with Gemini to identify food
      handleAnalyzePhoto(compressed)
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
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
      handleAnalyzePhoto(compressed)
    }
    reader.readAsDataURL(file)
  }

  const handleAnalyzePhoto = async (imageData: string) => {
    setStep('analyzing')
    setError(null)

    try {
      // Step 1: Use Gemini to identify the food
      const response = await fetch('/api/log-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'out',
          image: imageData,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze meal')
      }

      const data = await response.json()
      const identifiedName = data.nutrition.meal_name
      setMealName(identifiedName)

      // Step 2: Auto-search FatSecret for the identified food
      try {
        const fsResponse = await fetch(`/api/fatsecret/search?q=${encodeURIComponent(identifiedName)}&max=5`)
        if (fsResponse.ok) {
          const fsData = await fsResponse.json()
          if (fsData.foods && fsData.foods.length > 0) {
            // Found FatSecret results - show search step with pre-filled results
            setSearchQuery(identifiedName)
            setSearchResults(fsData.foods)
            setStep('search')
            return
          }
        }
      } catch (fsErr) {
        console.error('FatSecret search failed:', fsErr)
      }

      // Fallback: No FatSecret results, use Gemini estimate
      setNutrition({
        ...data.nutrition,
        source: 'gemini',
      })
      setStep('result')
    } catch (err) {
      console.error('Analysis error:', err)
      setError('Failed to analyze. Try searching instead.')
      setStep('search')
    }
  }

  const handleFatSecretSelect = async (food: FatSecretFood) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/fatsecret/food?id=${food.id}`)
      if (!response.ok) throw new Error('Failed to get nutrition')

      const data = await response.json()
      setNutrition({
        food_id: data.food_id,
        food_name: data.food_name,
        meal_name: data.food_name + (data.brand_name ? ` (${data.brand_name})` : ''),
        detected_components: [],
        estimated_calories: data.calories,
        protein_grams: data.protein_grams,
        carbs_grams: data.carbs_grams,
        fat_grams: data.fat_grams,
        fiber_grams: data.fiber_grams || 0,
        vegetable_servings: 0,
        health_assessment: 'balanced',
        notes: data.serving_description,
        source: 'fatsecret',
      })
      setMealName(data.food_name + (data.brand_name ? ` (${data.brand_name})` : ''))
      setSearchQuery('')
      setSearchResults([])
      setStep('result')
    } catch (err) {
      console.error('FatSecret lookup error:', err)
      setError('Failed to get nutrition data')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickSave = async () => {
    if (!mealName.trim()) {
      setError('Please enter a meal name')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const eatenAt = new Date(mealDate)
      const now = new Date()
      eatenAt.setHours(now.getHours(), now.getMinutes(), 0, 0)

      // Upload photo to Supabase Storage if present
      let imageUrl: string | null = null
      if (image) {
        // Get user ID from session
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          imageUrl = await uploadMealPhoto(image, user.id)
        }
      }

      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_name: mealName,
          meal_type: mealTime,
          restaurant_name: mealSource === 'out' ? restaurantName || null : null,
          image_url: imageUrl,
          eaten_at: eatenAt.toISOString(),
          source: mealSource === 'home' ? 'home' : 'restaurant',
          estimated_calories: nutrition?.estimated_calories || null,
          protein_grams: nutrition?.protein_grams || null,
          carbs_grams: nutrition?.carbs_grams || null,
          fat_grams: nutrition?.fat_grams || null,
          fiber_grams: nutrition?.fiber_grams || null,
          vegetable_servings: nutrition?.vegetable_servings || null,
          detected_components: nutrition?.detected_components || null,
          health_assessment: nutrition?.health_assessment || null,
          fatsecret_food_id: nutrition?.food_id || null,
          nutrition_source: nutrition?.source || 'manual',
        }),
      })

      if (!response.ok) throw new Error('Failed to save meal')

      // Show leftovers prompt for home meals
      if (mealSource === 'home') {
        setLeftoverName(`Leftover ${mealName}`)
        setStep('leftovers')
      } else {
        router.push('/dashboard/meals')
      }
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save meal')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveLeftovers = async () => {
    if (!leftoverName.trim()) {
      router.push('/dashboard/meals')
      return
    }

    setSaving(true)
    try {
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + leftoverExpiry)

      const response = await fetch('/api/leftovers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leftoverName,
          location: 'fridge',
          expiry_date: expiryDate.toISOString().split('T')[0],
          nutritional_type: 'misc',
        }),
      })

      if (!response.ok) throw new Error('Failed to save leftovers')
    } catch (err) {
      console.error('Leftovers error:', err)
      // Don't block navigation on leftovers error
    } finally {
      setSaving(false)
      router.push('/dashboard/meals')
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 px-4">
      {/* Header */}
      <div className="mb-6 pt-2">
        <Link href="/dashboard/meals" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Meals
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Log Meal</h1>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Quick Capture Step */}
      {step === 'capture' && (
        <div className="space-y-6">
          {/* Source Toggle */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setMealSource('out')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                mealSource === 'out'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              🍽️ Eating Out
            </button>
            <button
              onClick={() => setMealSource('home')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                mealSource === 'home'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              🏠 Home
            </button>
          </div>

          {/* Photo Upload */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50'
            }`}
          >
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">{isDragging ? '📥' : '📸'}</span>
            </div>
            <p className="font-medium text-gray-900 mb-1">
              {isDragging ? 'Drop photo here' : 'Add a photo'}
            </p>
            <p className="text-sm text-gray-500">
              We&apos;ll identify the food automatically
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Search / Manual Entry */}
          <button
            onClick={() => setStep('search')}
            className="w-full py-4 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <span>🔍</span> Search for food
          </button>
        </div>
      )}

      {/* Search Step */}
      {step === 'search' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep('capture')}
              className="text-gray-500 hover:text-gray-700"
            >
              ←
            </button>
            <h2 className="font-semibold text-gray-900">Search for food</h2>
          </div>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., chicken rice, laksa..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400"
              autoFocus
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <>
              <p className="text-sm text-gray-500">Select for accurate nutrition:</p>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {searchResults.map((food) => (
                  <button
                    key={food.id}
                    onClick={() => handleFatSecretSelect(food)}
                    disabled={loading}
                    className="w-full p-4 text-left hover:bg-gray-50 disabled:opacity-50"
                  >
                    <div className="font-medium text-gray-900">{food.name}</div>
                    {food.brand && (
                      <div className="text-sm text-gray-500">{food.brand}</div>
                    )}
                    {food.description && (
                      <div className="text-xs text-gray-400 mt-1 truncate">{food.description}</div>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setNutrition(null)
                  setStep('result')
                }}
                className="w-full py-3 text-gray-500 text-sm hover:text-gray-700"
              >
                Skip nutrition lookup →
              </button>
            </>
          )}

          {/* Manual Entry Option */}
          {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
            <div className="text-center py-6">
              <p className="text-gray-500 mb-3">No results found</p>
              <button
                onClick={() => {
                  setMealName(searchQuery)
                  setNutrition(null)
                  setStep('result')
                }}
                className="text-emerald-600 hover:underline"
              >
                Log &quot;{searchQuery}&quot; without nutrition →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Analyzing */}
      {step === 'analyzing' && (
        <div className="text-center py-16">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900">Identifying food...</p>
          <p className="text-gray-500">This may take a moment</p>
        </div>
      )}

      {/* Result Step */}
      {step === 'result' && (
        <div className="space-y-5">
          {/* Photo preview */}
          {image && (
            <div className="relative">
              <img
                src={image}
                alt="Meal"
                className="w-full aspect-video object-cover rounded-2xl"
              />
              <button
                onClick={() => setImage(null)}
                className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
              >
                ×
              </button>
            </div>
          )}

          {/* Meal Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What did you eat?</label>
            <input
              type="text"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="e.g., Chicken Rice"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900"
            />
          </div>

          {/* Quick Metadata */}
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
                <option value="snack">🍪 Snack</option>
              </select>
            </div>
          </div>

          {/* Restaurant Name (for eating out) */}
          {mealSource === 'out' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Where? (optional)</label>
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="e.g., Maxwell Food Centre"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm"
              />
            </div>
          )}

          {/* Nutrition (if available) - Editable */}
          {nutrition && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Nutrition</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  nutrition.source === 'fatsecret'
                    ? 'bg-green-100 text-green-700'
                    : nutrition.source === 'manual'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {nutrition.source === 'fatsecret' ? '✓ FatSecret' : nutrition.source === 'manual' ? 'Manual' : 'AI Estimated'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white rounded-lg p-2">
                  <input
                    type="number"
                    value={nutrition.estimated_calories}
                    onChange={(e) => setNutrition({ ...nutrition, estimated_calories: parseInt(e.target.value) || 0, source: 'manual' })}
                    className="w-full text-lg font-bold text-gray-900 text-center bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
                  />
                  <div className="text-xs text-gray-500 text-center">Cal</div>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <input
                    type="number"
                    value={nutrition.protein_grams}
                    onChange={(e) => setNutrition({ ...nutrition, protein_grams: parseInt(e.target.value) || 0, source: 'manual' })}
                    className="w-full text-lg font-bold text-blue-600 text-center bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
                  />
                  <div className="text-xs text-gray-500 text-center">Protein</div>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <input
                    type="number"
                    value={nutrition.carbs_grams}
                    onChange={(e) => setNutrition({ ...nutrition, carbs_grams: parseInt(e.target.value) || 0, source: 'manual' })}
                    className="w-full text-lg font-bold text-amber-600 text-center bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
                  />
                  <div className="text-xs text-gray-500 text-center">Carbs</div>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <input
                    type="number"
                    value={nutrition.fat_grams}
                    onChange={(e) => setNutrition({ ...nutrition, fat_grams: parseInt(e.target.value) || 0, source: 'manual' })}
                    className="w-full text-lg font-bold text-orange-600 text-center bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
                  />
                  <div className="text-xs text-gray-500 text-center">Fat</div>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-2 text-center">Tap to edit values</p>

              {nutrition.notes && (
                <p className="text-xs text-gray-500 mt-1">{nutrition.notes}</p>
              )}
            </div>
          )}

          {/* No nutrition - offer to search */}
          {!nutrition && (
            <button
              onClick={() => {
                setSearchQuery(mealName)
                setStep('search')
              }}
              className="w-full py-3 border border-gray-300 rounded-xl text-gray-600 text-sm hover:bg-gray-50"
            >
              🔍 Search FatSecret for nutrition data
            </button>
          )}

          {/* Source badge */}
          <div className="flex items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded-full ${
              mealSource === 'home'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {mealSource === 'home' ? '🏠 Home Meal' : '🍽️ Eating Out'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setStep('capture')
                setImage(null)
                setMealName('')
                setNutrition(null)
              }}
              disabled={saving}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleQuickSave}
              disabled={saving || !mealName.trim()}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Leftovers Prompt */}
      {step === 'leftovers' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🥡</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Any leftovers?</h2>
            <p className="text-gray-500">Add them to your fridge inventory</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Leftover name</label>
            <input
              type="text"
              value={leftoverName}
              onChange={(e) => setLeftoverName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Eat within
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 5, 7].map((days) => (
                <button
                  key={days}
                  onClick={() => setLeftoverExpiry(days)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    leftoverExpiry === days
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => router.push('/dashboard/meals')}
              disabled={saving}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={handleSaveLeftovers}
              disabled={saving || !leftoverName.trim()}
              className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add to Fridge'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
