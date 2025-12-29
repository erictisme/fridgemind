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

  const handleCardClick = () => {
    window.open(result.source_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex-shrink-0 w-72 snap-start">
      <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg hover:border-indigo-300 transition-all h-full flex flex-col">
        {/* Clickable Card Area */}
        <div
          onClick={handleCardClick}
          className="cursor-pointer"
        >
          {/* Image */}
          <div className="relative h-32 bg-gradient-to-br from-indigo-100 to-purple-100">
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
              <span className="max-w-24 truncate">{result.source_name}</span>
            </div>

            {/* Time Badge */}
            {result.estimated_time_minutes && (
              <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white rounded-full text-xs font-medium">
                {formatTime(result.estimated_time_minutes)}
              </div>
            )}

            {/* Click to view hint */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-2">
              <span className="text-white text-xs flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Tap to view recipe
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-3">
            {/* Title */}
            <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1">
              {result.name}
            </h3>

            {/* Description */}
            {result.description && (
              <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                {result.description}
              </p>
            )}

            {/* Ingredients Preview */}
            {result.ingredients_preview.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {result.ingredients_preview.slice(0, 4).map((ing, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] truncate max-w-16"
                  >
                    {ing}
                  </span>
                ))}
                {result.ingredients_preview.length > 4 && (
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded text-[10px]">
                    +{result.ingredients_preview.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Save Button - separate from clickable area */}
        <div className="p-3 pt-0 mt-auto">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSave()
            }}
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
  )
}
