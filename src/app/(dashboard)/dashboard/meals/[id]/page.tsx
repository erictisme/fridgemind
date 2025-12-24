'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface Meal {
  id: string
  meal_name: string
  meal_type: string | null
  restaurant_name: string | null
  image_url: string | null
  eaten_at: string
  estimated_calories: number | null
  protein_grams: number | null
  carbs_grams: number | null
  fat_grams: number | null
  fiber_grams: number | null
  vegetable_servings: number | null
  detected_components: string[] | null
  health_assessment: string | null
  ai_notes: string | null
  notes: string | null
  source: string | null
  nutrition_source: string | null
  fatsecret_food_id: string | null
}

const HEALTH_BADGES: Record<string, { label: string; color: string; emoji: string }> = {
  balanced: { label: 'Balanced', color: 'bg-green-100 text-green-700', emoji: '✅' },
  protein_heavy: { label: 'Protein Heavy', color: 'bg-blue-100 text-blue-700', emoji: '💪' },
  carb_heavy: { label: 'Carb Heavy', color: 'bg-amber-100 text-amber-700', emoji: '🍞' },
  high_fat: { label: 'High Fat', color: 'bg-orange-100 text-orange-700', emoji: '🧈' },
  vegetable_rich: { label: 'Veggie Rich', color: 'bg-emerald-100 text-emerald-700', emoji: '🥗' },
  light: { label: 'Light', color: 'bg-sky-100 text-sky-700', emoji: '🍃' },
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: '🌅 Breakfast',
  lunch: '☀️ Lunch',
  dinner: '🌙 Dinner',
  snack: '🍪 Snack',
}

export default function MealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [meal, setMeal] = useState<Meal | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchMeal()
  }, [resolvedParams.id])

  const fetchMeal = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/meals/${resolvedParams.id}`)
      if (response.ok) {
        const data = await response.json()
        setMeal(data.meal)
      } else if (response.status === 404) {
        router.push('/dashboard/meals')
      }
    } catch (error) {
      console.error('Failed to fetch meal:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this meal?')) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/meals/${resolvedParams.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        router.push('/dashboard/meals')
      }
    } catch (error) {
      console.error('Failed to delete meal:', error)
    } finally {
      setDeleting(false)
    }
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-SG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
          <div className="space-y-2">
            <div className="h-6 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!meal) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <p className="text-gray-600">Meal not found</p>
        <Link href="/dashboard/meals" className="text-emerald-600 hover:underline mt-4 inline-block">
          Back to Meals
        </Link>
      </div>
    )
  }

  const healthBadge = meal.health_assessment ? HEALTH_BADGES[meal.health_assessment] : null

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/meals"
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          ← Back
        </Link>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-500 hover:text-red-700 text-sm"
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      {/* Meal Photo */}
      <div className="relative aspect-[16/10] bg-gray-100 rounded-xl overflow-hidden">
        {meal.image_url ? (
          <Image
            src={meal.image_url}
            alt={meal.meal_name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-6xl text-gray-300">
            🍽️
          </div>
        )}
      </div>

      {/* Meal Info */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{meal.meal_name}</h1>
          <p className="text-gray-500">{formatDateTime(meal.eaten_at)}</p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {meal.meal_type && (
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
              {MEAL_TYPE_LABELS[meal.meal_type] || meal.meal_type}
            </span>
          )}
          {meal.source === 'home' ? (
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
              🏠 Home-cooked
            </span>
          ) : meal.restaurant_name ? (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
              📍 {meal.restaurant_name}
            </span>
          ) : null}
          {healthBadge && (
            <span className={`px-3 py-1 rounded-full text-sm ${healthBadge.color}`}>
              {healthBadge.emoji} {healthBadge.label}
            </span>
          )}
          {meal.nutrition_source && (
            <span className={`px-3 py-1 rounded-full text-sm ${
              meal.nutrition_source === 'fatsecret'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {meal.nutrition_source === 'fatsecret' ? '✓ FatSecret' : 'AI Estimated'}
            </span>
          )}
        </div>

        {/* Nutrition Grid */}
        {(meal.estimated_calories || meal.protein_grams || meal.carbs_grams || meal.fat_grams) && (
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Nutrition</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {meal.estimated_calories && (
                <div>
                  <div className="text-2xl font-bold text-gray-900">{meal.estimated_calories}</div>
                  <div className="text-xs text-gray-500">Calories</div>
                </div>
              )}
              {meal.protein_grams && (
                <div>
                  <div className="text-2xl font-bold text-blue-600">{meal.protein_grams}g</div>
                  <div className="text-xs text-gray-500">Protein</div>
                </div>
              )}
              {meal.carbs_grams && (
                <div>
                  <div className="text-2xl font-bold text-amber-600">{meal.carbs_grams}g</div>
                  <div className="text-xs text-gray-500">Carbs</div>
                </div>
              )}
              {meal.fat_grams && (
                <div>
                  <div className="text-2xl font-bold text-orange-600">{meal.fat_grams}g</div>
                  <div className="text-xs text-gray-500">Fat</div>
                </div>
              )}
            </div>

            {/* Secondary nutrition */}
            <div className="flex gap-4 mt-3 pt-3 border-t border-gray-200">
              {meal.fiber_grams && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{meal.fiber_grams}g</span> fiber
                </div>
              )}
              {meal.vegetable_servings && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{meal.vegetable_servings}</span> veg servings
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detected Components */}
        {meal.detected_components && meal.detected_components.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">What&apos;s in it</h3>
            <div className="flex flex-wrap gap-2">
              {meal.detected_components.map((component, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700"
                >
                  {component}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {(meal.notes || meal.ai_notes) && (
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
            {meal.notes && <p className="text-gray-700 mb-2">{meal.notes}</p>}
            {meal.ai_notes && (
              <p className="text-sm text-gray-500 italic">{meal.ai_notes}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
