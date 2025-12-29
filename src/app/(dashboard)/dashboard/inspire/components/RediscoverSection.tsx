'use client'

import { SavedRecipe } from './SavedRecipesSection'

interface RediscoverSectionProps {
  recipes: SavedRecipe[]
  onRecipeClick: (recipe: SavedRecipe) => void
}

export default function RediscoverSection({
  recipes,
  onRecipeClick,
}: RediscoverSectionProps) {
  if (recipes.length === 0) return null

  const getTimeAgo = (recipe: SavedRecipe) => {
    if (!recipe.last_cooked_at) return 'New'

    const lastCooked = new Date(recipe.last_cooked_at)
    const days = Math.floor((Date.now() - lastCooked.getTime()) / (1000 * 60 * 60 * 24))

    if (days < 30) return `${days}d ago`
    if (days < 60) return '1 month ago'
    if (days < 365) return `${Math.floor(days / 30)} months ago`
    return `${Math.floor(days / 365)}y ago`
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">💡</span>
        <h3 className="font-medium text-gray-900">Haven&apos;t made in a while</h3>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory">
        {recipes.map(recipe => (
          <button
            key={recipe.id}
            onClick={() => onRecipeClick(recipe)}
            className="flex-shrink-0 w-40 snap-start text-left"
          >
            <div className="bg-white rounded-xl overflow-hidden border border-amber-200 shadow-sm hover:shadow-md transition-shadow">
              {/* Image */}
              <div className="relative h-24 bg-gradient-to-br from-amber-50 to-orange-50">
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
                    <span className="text-2xl opacity-30">🍽️</span>
                  </div>
                )}

                {/* Time ago badge */}
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">
                  {getTimeAgo(recipe)}
                </div>
              </div>

              {/* Content */}
              <div className="p-2">
                <h4 className="font-medium text-gray-900 text-xs line-clamp-2">
                  {recipe.name}
                </h4>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
