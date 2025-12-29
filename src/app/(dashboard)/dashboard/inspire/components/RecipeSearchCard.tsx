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
    if (type === 'youtube') return '▶️'
    if (type === 'instagram') return '📸'
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

  const formatViewCount = (count?: number) => {
    if (!count) return null
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`
    return String(count)
  }

  const isYouTube = result.source_type === 'youtube'

  const handleCardClick = () => {
    window.open(result.source_url, '_blank', 'noopener,noreferrer')
  }

  // Get time from either new or legacy field
  const timeMinutes = result.total_time_minutes || result.estimated_time_minutes

  // Format rating display
  const renderRating = () => {
    if (!result.rating || result.rating.value === 0) return null

    const stars = Math.round(result.rating.value)
    const reviewText = result.rating.count > 0
      ? `(${result.rating.count.toLocaleString()})`
      : ''

    return (
      <div className="flex items-center gap-1">
        <div className="flex">
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i} className={`text-xs ${i <= stars ? 'text-amber-400' : 'text-gray-300'}`}>
              ★
            </span>
          ))}
        </div>
        <span className="text-xs text-gray-500">{result.rating.value.toFixed(1)}</span>
        {reviewText && <span className="text-xs text-gray-400">{reviewText}</span>}
      </div>
    )
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
            <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-1 backdrop-blur-sm rounded-full text-xs font-medium ${
              isYouTube
                ? 'bg-red-500/90 text-white'
                : 'bg-white/90 text-gray-700'
            }`}>
              <span>{getSourceIcon(result.source_type)}</span>
              <span className="max-w-24 truncate">{isYouTube ? result.channel_name || 'YouTube' : result.source_name}</span>
            </div>

            {/* Time/Duration Badge */}
            {isYouTube ? (
              result.video_duration && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 text-white rounded text-xs font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  {result.video_duration}
                </div>
              )
            ) : (
              timeMinutes && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white rounded-full text-xs font-medium">
                  {formatTime(timeMinutes)}
                </div>
              )
            )}

            {/* YouTube Play Button Overlay */}
            {isYouTube && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-red-600/90 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </div>
              </div>
            )}

            {/* Click to view hint */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-2">
              <span className="text-white text-xs flex items-center gap-1">
                {isYouTube ? (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                    Watch video
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View full recipe
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-3">
            {/* Title */}
            <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1">
              {result.name}
            </h3>

            {/* YouTube Metrics */}
            {isYouTube && result.view_count ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {formatViewCount(result.view_count)} views
                </span>
                {result.like_count && result.like_count > 0 && (
                  <span className="flex items-center gap-0.5">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                    </svg>
                    {formatViewCount(result.like_count)}
                  </span>
                )}
              </div>
            ) : (
              /* Rating for web recipes */
              renderRating()
            )}

            {/* Channel/Author */}
            {isYouTube && result.channel_name ? (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
                </svg>
                {result.channel_name}
              </p>
            ) : result.author && (
              <p className="text-xs text-gray-400 mt-1">by {result.author}</p>
            )}

            {/* Description - only for non-YouTube or YouTube without views */}
            {result.description && !isYouTube && !result.rating && (
              <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                {result.description}
              </p>
            )}

            {/* Ingredients Preview - only for web recipes */}
            {!isYouTube && result.ingredients_preview.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {result.ingredients_preview.slice(0, 3).map((ing, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] truncate max-w-20"
                  >
                    {ing.replace(/^\d+[\s\/\d]*(?:cup|tbsp|tsp|oz|lb|g|kg|ml|l|piece|pieces|clove|cloves)?\s*/i, '').trim()}
                  </span>
                ))}
                {result.ingredients_preview.length > 3 && (
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded text-[10px]">
                    +{result.ingredients_preview.length - 3}
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
