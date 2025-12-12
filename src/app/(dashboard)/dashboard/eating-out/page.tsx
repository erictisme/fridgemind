'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

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

interface EatingOutLog {
  id: string
  meal_name: string
  restaurant_name: string | null
  estimated_calories: number
  protein_grams: number
  carbs_grams: number
  fat_grams: number
  vegetable_servings: number
  health_assessment: string
  eaten_at: string
}

type Step = 'capture' | 'analyzing' | 'result' | 'history'

const HEALTH_BADGES: Record<string, { label: string; color: string; emoji: string }> = {
  balanced: { label: 'Balanced', color: 'bg-green-100 text-green-700', emoji: '✅' },
  protein_heavy: { label: 'Protein Heavy', color: 'bg-blue-100 text-blue-700', emoji: '💪' },
  carb_heavy: { label: 'Carb Heavy', color: 'bg-amber-100 text-amber-700', emoji: '🍞' },
  high_fat: { label: 'High Fat', color: 'bg-orange-100 text-orange-700', emoji: '🧈' },
  vegetable_rich: { label: 'Veggie Rich', color: 'bg-emerald-100 text-emerald-700', emoji: '🥗' },
  light: { label: 'Light', color: 'bg-sky-100 text-sky-700', emoji: '🍃' },
}

export default function EatingOutPage() {
  const [step, setStep] = useState<Step>('capture')
  const [image, setImage] = useState<string | null>(null)
  const [nutrition, setNutrition] = useState<NutritionData | null>(null)
  const [history, setHistory] = useState<EatingOutLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/eating-out')
      if (response.ok) {
        const data = await response.json()
        setHistory(data.meals || [])
      }
    } catch (err) {
      console.error('Failed to fetch history:', err)
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

  const handleAnalyze = async () => {
    if (!image) return

    setStep('analyzing')
    setError(null)

    try {
      const response = await fetch('/api/eating-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze meal')
      }

      const data = await response.json()
      setNutrition(data.nutrition)
      setStep('result')
      fetchHistory() // Refresh history
    } catch (err) {
      console.error('Analysis error:', err)
      setError('Failed to analyze meal. Please try again.')
      setStep('capture')
    }
  }

  const resetCapture = () => {
    setImage(null)
    setNutrition(null)
    setStep('capture')
    setError(null)
  }

  const healthBadge = nutrition ? HEALTH_BADGES[nutrition.health_assessment] || HEALTH_BADGES.balanced : null

  return (
    <div className="max-w-2xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
            &larr; Home
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Eating Out</h1>
          <p className="text-gray-500">Track nutrition when dining out</p>
        </div>
        {step !== 'history' && history.length > 0 && (
          <button
            onClick={() => setStep('history')}
            className="text-sm text-emerald-600 hover:text-emerald-700"
          >
            View History ({history.length})
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl">
          {error}
        </div>
      )}

      {/* Capture Step */}
      {step === 'capture' && (
        <div className="space-y-6">
          {/* Image preview or upload */}
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
              className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
            >
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
              onClick={handleAnalyze}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
            >
              Analyze Nutrition
            </button>
          )}
        </div>
      )}

      {/* Analyzing Step */}
      {step === 'analyzing' && (
        <div className="text-center py-16">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-900">Analyzing your meal...</p>
          <p className="text-gray-500">Estimating nutritional content</p>
        </div>
      )}

      {/* Result Step */}
      {step === 'result' && nutrition && (
        <div className="space-y-6">
          {/* Meal photo */}
          {image && (
            <img
              src={image}
              alt="Meal"
              className="w-full aspect-video object-cover rounded-2xl"
            />
          )}

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
                <div className="text-sm text-gray-500 mb-2">Detected:</div>
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
              onClick={resetCapture}
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

      {/* History Step */}
      {step === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Meals</h2>
            <button
              onClick={() => setStep('capture')}
              className="text-sm text-emerald-600 hover:text-emerald-700"
            >
              + Log New
            </button>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No meals logged yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(meal => {
                const badge = HEALTH_BADGES[meal.health_assessment] || HEALTH_BADGES.balanced
                return (
                  <div key={meal.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">{meal.meal_name}</h3>
                        {meal.restaurant_name && (
                          <p className="text-sm text-gray-500">{meal.restaurant_name}</p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${badge.color}`}>
                        {badge.emoji}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-600">{meal.estimated_calories} cal</span>
                      <span className="text-blue-600">{meal.protein_grams}g protein</span>
                      <span className="text-green-600">{meal.vegetable_servings} veg</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      {new Date(meal.eaten_at).toLocaleDateString()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
