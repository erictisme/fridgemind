'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Step = 'basics' | 'cuisines' | 'dietary'

interface CuisinePreference {
  cuisine: string
  weight: number
}

const SKILL_LEVELS = [
  { value: 'beginner', label: 'Beginner', description: 'Simple recipes, basic techniques' },
  { value: 'intermediate', label: 'Intermediate', description: 'Comfortable with most recipes' },
  { value: 'advanced', label: 'Advanced', description: 'Complex techniques, adventurous cooking' },
]

const TIME_PREFERENCES = [
  { value: 'quick', label: 'Quick', description: 'Under 30 minutes' },
  { value: 'medium', label: 'Medium', description: '30-60 minutes' },
  { value: 'elaborate', label: 'Elaborate', description: '60+ minutes, weekend cooking' },
]

const SPICE_LEVELS = [
  { value: 'mild', label: 'Mild', emoji: '🌶️' },
  { value: 'medium', label: 'Medium', emoji: '🌶️🌶️' },
  { value: 'spicy', label: 'Spicy', emoji: '🌶️🌶️🌶️' },
  { value: 'very_spicy', label: 'Very Spicy', emoji: '🔥' },
]

const CUISINES = [
  { value: 'italian', label: 'Italian', emoji: '🍝' },
  { value: 'chinese', label: 'Chinese', emoji: '🥡' },
  { value: 'japanese', label: 'Japanese', emoji: '🍣' },
  { value: 'mexican', label: 'Mexican', emoji: '🌮' },
  { value: 'indian', label: 'Indian', emoji: '🍛' },
  { value: 'thai', label: 'Thai', emoji: '🍜' },
  { value: 'korean', label: 'Korean', emoji: '🥘' },
  { value: 'mediterranean', label: 'Mediterranean', emoji: '🥗' },
  { value: 'american', label: 'American', emoji: '🍔' },
  { value: 'french', label: 'French', emoji: '🥐' },
  { value: 'vietnamese', label: 'Vietnamese', emoji: '🍲' },
  { value: 'middle_eastern', label: 'Middle Eastern', emoji: '🧆' },
]

const DIETARY_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten_free', label: 'Gluten-Free' },
  { value: 'dairy_free', label: 'Dairy-Free' },
  { value: 'nut_free', label: 'Nut-Free' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'low_carb', label: 'Low Carb' },
  { value: 'keto', label: 'Keto' },
]

export default function CookingProfilePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('basics')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [skillLevel, setSkillLevel] = useState('intermediate')
  const [timePreference, setTimePreference] = useState('medium')
  const [spiceTolerance, setSpiceTolerance] = useState('medium')
  const [cuisinePreferences, setCuisinePreferences] = useState<CuisinePreference[]>([])
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/taste-profile')
      if (response.ok) {
        const data = await response.json()
        if (data.profile) {
          setSkillLevel(data.profile.skill_level || 'intermediate')
          setTimePreference(data.profile.cooking_time_preference || 'medium')
          setSpiceTolerance(data.profile.spice_tolerance || 'medium')
          setCuisinePreferences(data.profile.cuisine_preferences || [])
          setDietaryRestrictions(data.profile.dietary_restrictions || [])
        }
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleCuisine = (cuisine: string) => {
    setCuisinePreferences(prev => {
      const existing = prev.find(c => c.cuisine === cuisine)
      if (existing) {
        return prev.filter(c => c.cuisine !== cuisine)
      } else {
        return [...prev, { cuisine, weight: 1 }]
      }
    })
  }

  const toggleDietary = (restriction: string) => {
    setDietaryRestrictions(prev =>
      prev.includes(restriction)
        ? prev.filter(r => r !== restriction)
        : [...prev, restriction]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/taste-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_level: skillLevel,
          cooking_time_preference: timePreference,
          spice_tolerance: spiceTolerance,
          cuisine_preferences: cuisinePreferences,
          dietary_restrictions: dietaryRestrictions,
          onboarding_completed: true,
        }),
      })

      if (response.ok) {
        router.push('/dashboard/suggestions')
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
    } finally {
      setSaving(false)
    }
  }

  const goNext = () => {
    if (step === 'basics') setStep('cuisines')
    else if (step === 'cuisines') setStep('dietary')
  }

  const goBack = () => {
    if (step === 'cuisines') setStep('basics')
    else if (step === 'dietary') setStep('cuisines')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Set Up Your Cooking Profile</h1>
        <p className="text-gray-500">Help us understand your cooking style to give you better meal suggestions</p>
      </div>

      {/* Progress indicator */}
      <div className="flex gap-2 mb-8">
        {['basics', 'cuisines', 'dietary'].map((s, i) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded-full ${
              ['basics', 'cuisines', 'dietary'].indexOf(step) >= i
                ? 'bg-emerald-500'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Basics */}
      {step === 'basics' && (
        <div className="space-y-8">
          {/* Skill Level */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">What's your cooking skill level?</h2>
            <div className="grid gap-3">
              {SKILL_LEVELS.map(level => (
                <button
                  key={level.value}
                  onClick={() => setSkillLevel(level.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    skillLevel === level.value
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{level.label}</div>
                  <div className="text-sm text-gray-500">{level.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Time Preference */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">How much time do you usually have to cook?</h2>
            <div className="grid gap-3">
              {TIME_PREFERENCES.map(pref => (
                <button
                  key={pref.value}
                  onClick={() => setTimePreference(pref.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    timePreference === pref.value
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{pref.label}</div>
                  <div className="text-sm text-gray-500">{pref.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Spice Tolerance */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">How do you handle spice?</h2>
            <div className="grid grid-cols-4 gap-3">
              {SPICE_LEVELS.map(level => (
                <button
                  key={level.value}
                  onClick={() => setSpiceTolerance(level.value)}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    spiceTolerance === level.value
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{level.emoji}</div>
                  <div className="text-sm font-medium text-gray-900">{level.label}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={goNext}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700"
          >
            Next: Choose Cuisines
          </button>
        </div>
      )}

      {/* Step 2: Cuisines */}
      {step === 'cuisines' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">What cuisines do you love?</h2>
            <p className="text-gray-500 text-sm mb-4">Select all that apply - we'll suggest meals from these cuisines</p>
            <div className="grid grid-cols-3 gap-3">
              {CUISINES.map(cuisine => {
                const isSelected = cuisinePreferences.some(c => c.cuisine === cuisine.value)
                return (
                  <button
                    key={cuisine.value}
                    onClick={() => toggleCuisine(cuisine.value)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{cuisine.emoji}</div>
                    <div className="text-sm font-medium text-gray-900">{cuisine.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {cuisinePreferences.length > 0 && (
            <p className="text-sm text-emerald-600">
              {cuisinePreferences.length} cuisine{cuisinePreferences.length !== 1 ? 's' : ''} selected
            </p>
          )}

          <div className="flex gap-4">
            <button
              onClick={goBack}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={goNext}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700"
            >
              Next: Dietary Needs
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Dietary */}
      {step === 'dietary' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Any dietary restrictions?</h2>
            <p className="text-gray-500 text-sm mb-4">Select all that apply - we'll make sure suggestions fit your diet</p>
            <div className="grid grid-cols-3 gap-3">
              {DIETARY_OPTIONS.map(option => {
                const isSelected = dietaryRestrictions.includes(option.value)
                return (
                  <button
                    key={option.value}
                    onClick={() => toggleDietary(option.value)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900">{option.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {dietaryRestrictions.length > 0 && (
            <p className="text-sm text-emerald-600">
              {dietaryRestrictions.length} restriction{dietaryRestrictions.length !== 1 ? 's' : ''} selected
            </p>
          )}

          <div className="p-4 bg-gray-50 rounded-xl">
            <h3 className="font-medium text-gray-900 mb-2">Your Profile Summary</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Skill: {SKILL_LEVELS.find(l => l.value === skillLevel)?.label}</li>
              <li>Time: {TIME_PREFERENCES.find(p => p.value === timePreference)?.label}</li>
              <li>Spice: {SPICE_LEVELS.find(s => s.value === spiceTolerance)?.label}</li>
              <li>Cuisines: {cuisinePreferences.length > 0 ? cuisinePreferences.map(c => c.cuisine).join(', ') : 'Any'}</li>
              <li>Dietary: {dietaryRestrictions.length > 0 ? dietaryRestrictions.join(', ') : 'None'}</li>
            </ul>
          </div>

          <div className="flex gap-4">
            <button
              onClick={goBack}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
