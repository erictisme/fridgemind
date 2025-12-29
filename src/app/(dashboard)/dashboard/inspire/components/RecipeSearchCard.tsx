'use client'

import { RecipeSearchResult } from './RecipeSearchSection'

interface RecipeSearchCardProps {
  result: RecipeSearchResult
  onSave: () => void
  isSaving: boolean
  isSaved: boolean
}

export default function RecipeSearchCard({
  result,
  onSave,
  isSaving,
  isSaved,
}: RecipeSearchCardProps) {
  const getSourceIcon = (type: string) => {
    if (type === 'youtube') return '🎬'
    if (type === 'blog') return '📝'
    return '🌐'
  }

  const formatTime = (minutes?: number) => {
    if (!minutes) return null
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  return (
    <div className="flex-shrink-0 w-64 snap-start">
      <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
        {/* Image */}
        <div className="relative h-36 bg-gradient-to-br from-indigo-100 to-purple-100">
          {result.image_url ? (
            <img
              src={result.image_url}
              alt={result.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl opacity-50">🍽️</span>
            </div>
          )}

          {/* Source Badge */}
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-gray-700">
            <span>{getSourceIcon(result.source_type)}</span>
            <span className="max-w-20 truncate">{result.source_name}</span>
          </div>

          {/* Time Badge */}
          {result.estimated_time_minutes && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white rounded-full text-xs font-medium">
              {formatTime(result.estimated_time_minutes)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 flex-1 flex flex-col">
          {/* Title */}
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2">
            {result.name}
          </h3>

          {/* Ingredients Preview */}
          {result.ingredients_preview.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {result.ingredients_preview.slice(0, 3).map((ing, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs truncate max-w-20"
                >
                  {ing}
                </span>
              ))}
              {result.ingredients_preview.length > 3 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                  +{result.ingredients_preview.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Save Button */}
          <div className="mt-auto">
            <button
              onClick={onSave}
              disabled={isSaving || isSaved}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                isSaved
                  ? 'bg-emerald-100 text-emerald-700 cursor-default'
                  : isSaving
                  ? 'bg-indigo-100 text-indigo-700 cursor-wait'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {isSaved ? (
                <span className="flex items-center justify-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Saved
                </span>
              ) : isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save to Library'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
