'use client'

import { SavedRecipe } from './SavedRecipesSection'

interface SavedRecipeCardProps {
  recipe: SavedRecipe
  onToggleFavorite: () => void
  onDelete: () => void
  onClick: () => void
  onDragStart?: () => void
  compact?: boolean
}

export default function SavedRecipeCard({
  recipe,
  onToggleFavorite,
  onDelete,
  onClick,
  onDragStart,
  compact = false,
}: SavedRecipeCardProps) {
  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'instagram': return '📸'
      case 'youtube': return '🎬'
      case 'manual': return '✍️'
      case 'ai_suggestion': return '🤖'
      default: return '🔗'
    }
  }

  const formatTime = (minutes?: number | null) => {
    if (!minutes) return null
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart()
      e.dataTransfer.effectAllowed = 'copy'
    }
  }

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={handleDragStart}
      onClick={onClick}
      className={`group bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer ${
        compact ? '' : 'aspect-[4/5]'
      } flex flex-col`}
    >
      {/* Image */}
      <div className={`relative ${compact ? 'h-24' : 'flex-1'} bg-gradient-to-br from-gray-100 to-gray-200 min-h-0`}>
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className={`opacity-30 ${compact ? 'text-2xl' : 'text-4xl'}`}>🍽️</span>
          </div>
        )}

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
        >
          <span className={recipe.is_favorite ? 'text-red-500' : 'text-gray-400'}>
            {recipe.is_favorite ? '❤️' : '🤍'}
          </span>
        </button>

        {/* Source Icon */}
        <div className="absolute bottom-2 left-2 w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-xs">
          {getSourceIcon(recipe.source_type)}
        </div>

        {/* Times Cooked Badge */}
        {recipe.times_cooked > 0 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-emerald-500 text-white rounded-full text-xs font-medium">
            {recipe.times_cooked}×
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`${compact ? 'p-2' : 'p-3'} flex flex-col gap-1`}>
        {/* Title */}
        <h3 className={`font-semibold text-gray-900 line-clamp-2 ${compact ? 'text-xs' : 'text-sm'}`}>
          {recipe.name}
        </h3>

        {/* Meta Row */}
        <div className="flex items-center gap-2 flex-wrap">
          {recipe.estimated_time_minutes && (
            <span className={`px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded ${compact ? 'text-[10px]' : 'text-xs'}`}>
              {formatTime(recipe.estimated_time_minutes)}
            </span>
          )}
          {recipe.cuisine_type && (
            <span className={`px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded capitalize ${compact ? 'text-[10px]' : 'text-xs'}`}>
              {recipe.cuisine_type}
            </span>
          )}
        </div>

        {/* Tags (only show in non-compact mode) */}
        {!compact && recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {recipe.tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded text-[10px]"
              >
                #{tag}
              </span>
            ))}
            {recipe.tags.length > 2 && (
              <span className="text-[10px] text-gray-400">+{recipe.tags.length - 2}</span>
            )}
          </div>
        )}
      </div>

      {/* Delete Button (show on hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (confirm('Delete this recipe?')) {
            onDelete()
          }
        }}
        className="absolute top-2 left-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs hover:bg-red-600"
      >
        ×
      </button>
    </div>
  )
}
