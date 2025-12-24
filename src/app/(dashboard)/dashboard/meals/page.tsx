'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Meal {
  id: string
  meal_name: string
  meal_type: string
  restaurant_name: string | null
  image_url: string | null
  eaten_at: string
  estimated_calories: number | null
  protein_grams: number | null
  carbs_grams: number | null
  fat_grams: number | null
  health_assessment: string | null
  source: string | null
}

interface MealsData {
  meals: Record<string, Meal[]>
  calendar: Record<string, number> // date -> meal count
}

type ViewMode = 'timeline' | 'calendar'

const MEAL_TYPE_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍪',
}

export default function MealsPage() {
  const [data, setData] = useState<MealsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    fetchMeals()
  }, [selectedMonth])

  const fetchMeals = async () => {
    setLoading(true)
    try {
      const { year, month } = selectedMonth
      const response = await fetch(`/api/meals?year=${year}&month=${month + 1}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Failed to fetch meals:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return date.toLocaleDateString('en-SG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-SG', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getMealTimeLabel = (mealType: string | null) => {
    if (!mealType) return null
    return MEAL_TYPE_ICONS[mealType] || null
  }

  const getMonthName = (year: number, month: number) => {
    return new Date(year, month).toLocaleDateString('en-SG', {
      month: 'long',
      year: 'numeric',
    })
  }

  const navigateMonth = (delta: number) => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev.year, prev.month + delta)
      return { year: newDate.getFullYear(), month: newDate.getMonth() }
    })
    setSelectedDate(null)
  }

  const getCalendarDays = () => {
    const { year, month } = selectedMonth
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()

    const days: (number | null)[] = []

    // Empty cells for days before the first of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null)
    }

    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return days
  }

  const getDateKey = (day: number) => {
    const { year, month } = selectedMonth
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const meals = data?.meals || {}
  const calendar = data?.calendar || {}
  const sortedDates = Object.keys(meals).sort((a, b) =>
    new Date(b).getTime() - new Date(a).getTime()
  )

  // Filter by selected date in calendar mode
  const displayDates = selectedDate
    ? sortedDates.filter(d => d === selectedDate)
    : sortedDates

  if (loading && !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Meals</h1>
        <Link
          href="/dashboard/log-meal"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm flex items-center gap-2"
        >
          <span>+</span> Log Meal
        </Link>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setViewMode('timeline')
            setSelectedDate(null)
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            viewMode === 'timeline'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📋 Timeline
        </button>
        <button
          onClick={() => setViewMode('calendar')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            viewMode === 'calendar'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📅 Calendar
        </button>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              ←
            </button>
            <h2 className="text-lg font-semibold text-gray-900">
              {getMonthName(selectedMonth.year, selectedMonth.month)}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              →
            </button>
          </div>

          {/* Day Labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {getCalendarDays().map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="aspect-square" />
              }

              const dateKey = getDateKey(day)
              const mealCount = calendar[dateKey] || 0
              const isSelected = selectedDate === dateKey
              const isToday = dateKey === new Date().toISOString().split('T')[0]

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors relative ${
                    isSelected
                      ? 'bg-emerald-600 text-white'
                      : isToday
                      ? 'bg-emerald-50 text-emerald-700 font-semibold'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <span>{day}</span>
                  {mealCount > 0 && (
                    <div
                      className={`absolute bottom-1 flex gap-0.5 ${
                        isSelected ? 'text-white' : 'text-emerald-500'
                      }`}
                    >
                      {Array.from({ length: Math.min(mealCount, 4) }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-white' : 'bg-emerald-500'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Meals Timeline */}
      {displayDates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="text-4xl mb-4">🍽️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {selectedDate ? 'No meals on this day' : 'No meals logged yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {selectedDate
              ? 'Try selecting another date'
              : 'Start logging what you eat to build your food memory'}
          </p>
          {!selectedDate && (
            <Link
              href="/dashboard/log-meal"
              className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Log Your First Meal
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {displayDates.map((dateStr) => (
            <div key={dateStr}>
              {/* Date Header */}
              <div className="sticky top-0 bg-gray-50/95 backdrop-blur-sm py-2 -mx-2 px-2 z-10">
                <h3 className="text-sm font-semibold text-gray-500">{formatDate(dateStr)}</h3>
              </div>

              {/* Meals for this date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {meals[dateStr].map((meal) => (
                  <Link
                    key={meal.id}
                    href={`/dashboard/meals/${meal.id}`}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Meal Photo */}
                    <div className="relative aspect-[16/10] bg-gray-100">
                      {meal.image_url ? (
                        <Image
                          src={meal.image_url}
                          alt={meal.meal_name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-4xl text-gray-300">
                          🍽️
                        </div>
                      )}

                      {/* Time Badge */}
                      <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded-full flex items-center gap-1">
                        {getMealTimeLabel(meal.meal_type)}
                        <span>{formatTime(meal.eaten_at)}</span>
                      </div>

                      {/* Source Badge */}
                      {meal.source === 'home' && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-purple-600 text-white text-xs rounded-full">
                          🏠 Home
                        </div>
                      )}
                    </div>

                    {/* Meal Info */}
                    <div className="p-3">
                      <h4 className="font-medium text-gray-900 truncate">{meal.meal_name}</h4>
                      {meal.restaurant_name && (
                        <p className="text-sm text-gray-500 truncate">📍 {meal.restaurant_name}</p>
                      )}

                      {/* Quick Stats */}
                      {meal.estimated_calories && (
                        <div className="flex gap-3 mt-2 text-xs text-gray-500">
                          <span>{meal.estimated_calories} cal</span>
                          {meal.protein_grams && <span>{meal.protein_grams}g protein</span>}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading indicator */}
      {loading && data && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  )
}
