'use client'

import { useState } from 'react'

export interface RecipeFiltersState {
  search: string
  cuisineType: string | null
  maxTime: number | null
  favoritesOnly: boolean
  tags: string[]
}

interface RecipeFiltersProps {
  filters: RecipeFiltersState
  onFiltersChange: (filters: RecipeFiltersState) => void
  cuisineTypes: string[]
  allTags: string[]
}

const TIME_OPTIONS = [
  { value: null, label: 'Any time' },
  { value: 15, label: '≤15 min' },
  { value: 30, label: '≤30 min' },
  { value: 60, label: '≤1 hour' },
]

export default function RecipeFilters({
  filters,
  onFiltersChange,
  cuisineTypes,
  allTags,
}: RecipeFiltersProps) {
  const [showTagPicker, setShowTagPicker] = useState(false)

  const updateFilters = (updates: Partial<RecipeFiltersState>) => {
    onFiltersChange({ ...filters, ...updates })
  }

  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag]
    updateFilters({ tags: newTags })
  }

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => updateFilters({ search: e.target.value })}
          placeholder="Search saved recipes..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:outline-none text-gray-900 placeholder-gray-400 bg-white text-sm"
        />
        {filters.search && (
          <button
            onClick={() => updateFilters({ search: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter Buttons Row */}
      <div className="flex flex-wrap gap-2">
        {/* Cuisine Dropdown */}
        {cuisineTypes.length > 0 && (
          <select
            value={filters.cuisineType || ''}
            onChange={(e) => updateFilters({ cuisineType: e.target.value || null })}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              filters.cuisineType
                ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            <option value="">All cuisines</option>
            {cuisineTypes.map(cuisine => (
              <option key={cuisine} value={cuisine}>
                {cuisine.charAt(0).toUpperCase() + cuisine.slice(1)}
              </option>
            ))}
          </select>
        )}

        {/* Time Dropdown */}
        <select
          value={filters.maxTime?.toString() || ''}
          onChange={(e) => updateFilters({ maxTime: e.target.value ? parseInt(e.target.value) : null })}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
            filters.maxTime
              ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
          }`}
        >
          {TIME_OPTIONS.map(opt => (
            <option key={opt.label} value={opt.value?.toString() || ''}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Favorites Toggle */}
        <button
          onClick={() => updateFilters({ favoritesOnly: !filters.favoritesOnly })}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors flex items-center gap-1 ${
            filters.favoritesOnly
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
          }`}
        >
          <span>{filters.favoritesOnly ? '❤️' : '🤍'}</span>
          Favorites
        </button>

        {/* Tags Button */}
        {allTags.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowTagPicker(!showTagPicker)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors flex items-center gap-1 ${
                filters.tags.length > 0
                  ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>🏷️</span>
              Tags
              {filters.tags.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-indigo-600 text-white rounded-full text-xs">
                  {filters.tags.length}
                </span>
              )}
            </button>

            {/* Tags Dropdown */}
            {showTagPicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowTagPicker(false)}
                />
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 p-2 z-20 max-h-60 overflow-y-auto">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        filters.tags.includes(tag)
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="mr-2">{filters.tags.includes(tag) ? '✓' : ''}</span>
                      {tag}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Active Tag Chips */}
      {filters.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.tags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs flex items-center gap-1 hover:bg-indigo-200"
            >
              {tag}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
