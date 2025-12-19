'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DailySummary {
  date: string
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  total_fiber: number
  total_vegetable_servings: number
  meals_logged: number
}

interface NutritionSummary {
  period: 'daily' | 'weekly' | 'monthly'
  start_date: string
  end_date: string
  totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    vegetable_servings: number
    meals_logged: number
    home_meals: number
    restaurant_meals: number
  }
  averages: {
    calories_per_day: number
    protein_per_day: number
    carbs_per_day: number
    fat_per_day: number
    fiber_per_day: number
    vegetable_servings_per_day: number
  }
  red_flags: {
    fried_food_count: number
    red_meat_count: number
    high_sodium_count: number
  }
  daily_breakdown: DailySummary[]
}

interface NutritionInsight {
  type: 'red_flag' | 'positive' | 'recommendation'
  severity: 'info' | 'warning' | 'critical'
  icon: string
  title: string
  message: string
}

type Period = 'daily' | 'weekly' | 'monthly'

export default function NutritionPage() {
  const [period, setPeriod] = useState<Period>('weekly')
  const [summary, setSummary] = useState<NutritionSummary | null>(null)
  const [insights, setInsights] = useState<NutritionInsight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [period])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [summaryRes, insightsRes] = await Promise.all([
        fetch(`/api/nutrition/summary?period=${period}`),
        fetch('/api/nutrition/insights'),
      ])

      if (summaryRes.ok) {
        const data = await summaryRes.json()
        setSummary(data)
      }

      if (insightsRes.ok) {
        const data = await insightsRes.json()
        setInsights(data.insights || [])
      }
    } catch (error) {
      console.error('Failed to fetch nutrition data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-SG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  // Simple bar for daily breakdown
  const maxCalories = Math.max(...(summary?.daily_breakdown.map(d => d.total_calories) || [1]), 1)

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const redFlagInsights = insights.filter(i => i.type === 'red_flag')
  const positiveInsights = insights.filter(i => i.type === 'positive')
  const recommendationInsights = insights.filter(i => i.type === 'recommendation')

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Nutrition</h1>
        <Link
          href="/dashboard/log-meal"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm"
        >
          + Log Meal
        </Link>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {(['daily', 'weekly', 'monthly'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              period === p
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p === 'daily' ? 'Today' : p === 'weekly' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      {/* Macro Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MacroCard
            label="Calories"
            value={period === 'daily' ? summary.totals.calories : summary.averages.calories_per_day}
            unit={period === 'daily' ? '' : '/day'}
            color="bg-orange-50 border-orange-200"
            textColor="text-orange-600"
          />
          <MacroCard
            label="Protein"
            value={period === 'daily' ? summary.totals.protein : summary.averages.protein_per_day}
            unit="g"
            color="bg-red-50 border-red-200"
            textColor="text-red-600"
          />
          <MacroCard
            label="Carbs"
            value={period === 'daily' ? summary.totals.carbs : summary.averages.carbs_per_day}
            unit="g"
            color="bg-amber-50 border-amber-200"
            textColor="text-amber-600"
          />
          <MacroCard
            label="Fat"
            value={period === 'daily' ? summary.totals.fat : summary.averages.fat_per_day}
            unit="g"
            color="bg-yellow-50 border-yellow-200"
            textColor="text-yellow-600"
          />
        </div>
      )}

      {/* Secondary Stats */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <div className="text-2xl font-bold text-emerald-600">
              {period === 'daily'
                ? summary.totals.vegetable_servings.toFixed(1)
                : summary.averages.vegetable_servings_per_day.toFixed(1)}
            </div>
            <div className="text-xs text-emerald-700">Veggie servings{period !== 'daily' ? '/day' : ''}</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <div className="text-2xl font-bold text-purple-600">
              {period === 'daily' ? summary.totals.fiber : summary.averages.fiber_per_day}g
            </div>
            <div className="text-xs text-purple-700">Fiber{period !== 'daily' ? '/day' : ''}</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{summary.totals.meals_logged}</div>
            <div className="text-xs text-blue-700">Meals logged</div>
          </div>
        </div>
      )}

      {/* Insights Section */}
      {insights.length > 0 && (
        <div className="space-y-4">
          {/* Red Flags */}
          {redFlagInsights.length > 0 && (
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                <span>⚠️</span> Red Flags This Week
              </h3>
              <div className="space-y-2">
                {redFlagInsights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xl">{insight.icon}</span>
                    <div>
                      <div className="font-medium text-red-900">{insight.title}</div>
                      <div className="text-sm text-red-700">{insight.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Positive */}
          {positiveInsights.length > 0 && (
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
              <h3 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                <span>✅</span> Great Job
              </h3>
              <div className="space-y-2">
                {positiveInsights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xl">{insight.icon}</span>
                    <div>
                      <div className="font-medium text-emerald-900">{insight.title}</div>
                      <div className="text-sm text-emerald-700">{insight.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendationInsights.length > 0 && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <span>💡</span> Recommendations
              </h3>
              <div className="space-y-2">
                {recommendationInsights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xl">{insight.icon}</span>
                    <div>
                      <div className="font-medium text-blue-900">{insight.title}</div>
                      <div className="text-sm text-blue-700">{insight.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Daily Breakdown Chart */}
      {summary && summary.daily_breakdown.length > 0 && period !== 'daily' && (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Daily Calories</h3>
          <div className="space-y-2">
            {summary.daily_breakdown.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <div className="w-16 text-xs text-gray-500">{formatDate(day.date)}</div>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all"
                    style={{ width: `${(day.total_calories / maxCalories) * 100}%` }}
                  />
                </div>
                <div className="w-16 text-sm font-medium text-gray-700 text-right">
                  {day.total_calories}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Red Flag Summary */}
      {summary && (summary.red_flags.fried_food_count > 0 || summary.red_flags.red_meat_count > 0 || summary.red_flags.high_sodium_count > 0) && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">This {period === 'weekly' ? 'Week' : 'Month'}&apos;s Red Flags</h3>
          <div className="flex gap-4 flex-wrap">
            {summary.red_flags.fried_food_count > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span>🍟</span>
                <span className="text-gray-600">Fried: {summary.red_flags.fried_food_count}×</span>
              </div>
            )}
            {summary.red_flags.red_meat_count > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span>🥩</span>
                <span className="text-gray-600">Red meat: {summary.red_flags.red_meat_count}×</span>
              </div>
            )}
            {summary.red_flags.high_sodium_count > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span>🧂</span>
                <span className="text-gray-600">High sodium: {summary.red_flags.high_sodium_count}×</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {summary && summary.totals.meals_logged === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="text-4xl mb-4">🍽️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No meals logged yet</h3>
          <p className="text-gray-600 mb-4">Start logging your meals to see nutrition insights</p>
          <Link
            href="/dashboard/log-meal"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 inline-block"
          >
            Log Your First Meal
          </Link>
        </div>
      )}

      {/* Meal Breakdown */}
      {summary && summary.totals.meals_logged > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">Meal Types</h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-sm text-gray-600">
                Home: {summary.totals.home_meals} ({Math.round((summary.totals.home_meals / summary.totals.meals_logged) * 100)}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500"></span>
              <span className="text-sm text-gray-600">
                Out: {summary.totals.restaurant_meals} ({Math.round((summary.totals.restaurant_meals / summary.totals.meals_logged) * 100)}%)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MacroCard({
  label,
  value,
  unit,
  color,
  textColor,
}: {
  label: string
  value: number
  unit: string
  color: string
  textColor: string
}) {
  return (
    <div className={`rounded-xl p-4 border ${color}`}>
      <div className={`text-2xl font-bold ${textColor}`}>
        {value}{unit}
      </div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  )
}
