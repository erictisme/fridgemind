'use client'

import { useState, useEffect } from 'react'

interface MealPlan {
  id?: string
  week_start: string
  breakfasts_home: number
  lunches_home: number
  dinners_home: number
  cravings: string[]
  notes: string
}

// Helper to get Monday of current week
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday
}

// Helper to get Sunday of current week
function getSundayOfWeek(monday: Date): Date {
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return sunday
}

// Format date range for display (e.g., "Dec 9-15")
function formatWeekRange(monday: Date): string {
  const sunday = getSundayOfWeek(monday)
  const monthStart = monday.toLocaleDateString('en-US', { month: 'short' })
  const dayStart = monday.getDate()
  const dayEnd = sunday.getDate()

  // If same month
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monthStart} ${dayStart}-${dayEnd}`
  }
  // Different months
  const monthEnd = sunday.toLocaleDateString('en-US', { month: 'short' })
  return `${monthStart} ${dayStart} - ${monthEnd} ${dayEnd}`
}

export default function MealPlanPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const currentMonday = getMondayOfWeek(new Date())
  const weekStart = currentMonday.toISOString().split('T')[0]
  const weekRange = formatWeekRange(currentMonday)

  const [mealPlan, setMealPlan] = useState<MealPlan>({
    week_start: weekStart,
    breakfasts_home: 0,
    lunches_home: 0,
    dinners_home: 0,
    cravings: [],
    notes: '',
  })

  const [newCraving, setNewCraving] = useState('')

  useEffect(() => {
    fetchMealPlan()
  }, [])

  const fetchMealPlan = async () => {
    try {
      const response = await fetch(`/api/meal-plan?week_start=${weekStart}`)
      if (!response.ok) throw new Error('Failed to fetch')

      const data = await response.json()
      if (data.mealPlan) {
        setMealPlan(data.mealPlan)
      }
    } catch {
      setError('Failed to load meal plan')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Determine if this is a new meal plan or update
      const method = mealPlan.id ? 'PUT' : 'POST'
      const response = await fetch('/api/meal-plan', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mealPlan),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      const data = await response.json()
      setMealPlan(data.mealPlan)
      setSuccessMessage('Meal plan saved successfully!')

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save meal plan')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: keyof MealPlan, value: number | string | string[]) => {
    setMealPlan({ ...mealPlan, [field]: value })
  }

  const addCraving = () => {
    if (newCraving.trim()) {
      updateField('cravings', [...mealPlan.cravings, newCraving.trim()])
      setNewCraving('')
    }
  }

  const removeCraving = (index: number) => {
    const updated = mealPlan.cravings.filter((_, i) => i !== index)
    updateField('cravings', updated)
  }

  const totalMeals = mealPlan.breakfasts_home + mealPlan.lunches_home + mealPlan.dinners_home

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meal Plan</h1>
        <p className="text-gray-500">Week of {weekRange}</p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex justify-between items-center border border-red-200">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Meals at Home Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900">Meals at Home</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          How many meals do you plan to eat at home this week?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Breakfasts */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Breakfasts
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateField('breakfasts_home', Math.max(0, mealPlan.breakfasts_home - 1))}
                className="w-10 h-10 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-bold text-xl"
              >
                -
              </button>
              <input
                type="number"
                min="0"
                max="7"
                value={mealPlan.breakfasts_home}
                onChange={(e) => updateField('breakfasts_home', Math.max(0, Math.min(7, parseInt(e.target.value) || 0)))}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center text-lg font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <button
                onClick={() => updateField('breakfasts_home', Math.min(7, mealPlan.breakfasts_home + 1))}
                className="w-10 h-10 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-bold text-xl"
              >
                +
              </button>
            </div>
          </div>

          {/* Lunches */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lunches
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateField('lunches_home', Math.max(0, mealPlan.lunches_home - 1))}
                className="w-10 h-10 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-bold text-xl"
              >
                -
              </button>
              <input
                type="number"
                min="0"
                max="7"
                value={mealPlan.lunches_home}
                onChange={(e) => updateField('lunches_home', Math.max(0, Math.min(7, parseInt(e.target.value) || 0)))}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center text-lg font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <button
                onClick={() => updateField('lunches_home', Math.min(7, mealPlan.lunches_home + 1))}
                className="w-10 h-10 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-bold text-xl"
              >
                +
              </button>
            </div>
          </div>

          {/* Dinners */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dinners
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateField('dinners_home', Math.max(0, mealPlan.dinners_home - 1))}
                className="w-10 h-10 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-bold text-xl"
              >
                -
              </button>
              <input
                type="number"
                min="0"
                max="7"
                value={mealPlan.dinners_home}
                onChange={(e) => updateField('dinners_home', Math.max(0, Math.min(7, parseInt(e.target.value) || 0)))}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center text-lg font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <button
                onClick={() => updateField('dinners_home', Math.min(7, mealPlan.dinners_home + 1))}
                className="w-10 h-10 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-bold text-xl"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Total meals summary */}
        <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <p className="text-sm text-emerald-800">
            <span className="font-semibold">{totalMeals} total meals</span> planned at home this week
          </p>
        </div>
      </div>

      {/* Cravings Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900">Cravings & Ideas</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          What dishes or cuisines are you in the mood for this week?
        </p>

        {/* Add craving input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newCraving}
            onChange={(e) => setNewCraving(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCraving()}
            placeholder="e.g., Thai curry, tacos, pasta..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            onClick={addCraving}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Cravings list */}
        {mealPlan.cravings.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {mealPlan.cravings.map((craving, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm border border-purple-200"
              >
                {craving}
                <button
                  onClick={() => removeCraving(index)}
                  className="hover:text-purple-900"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No cravings added yet</p>
        )}
      </div>

      {/* Notes Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Any additional thoughts or reminders for this week?
        </p>

        <textarea
          value={mealPlan.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          rows={4}
          placeholder="e.g., Meal prep on Sunday, try that new recipe, use up leftover chicken..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Meal Plan
            </>
          )}
        </button>
      </div>
    </div>
  )
}
