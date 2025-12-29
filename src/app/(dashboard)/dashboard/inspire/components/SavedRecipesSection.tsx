'use client'

import { useState, useMemo } from 'react'
import SavedRecipeCard from './SavedRecipeCard'
import RecipeFilters, { RecipeFiltersState } from './RecipeFilters'
import RediscoverSection from './RediscoverSection'

interface RecipeIngredient {
  name: string
  quantity?: string | number
  unit?: string
  optional?: boolean
}

export interface SavedRecipe {
  id: string
  name: string
  description: string | null
  source_type: string
  source_url: string | null
  source_account: string | null
  image_url: string | null
  ingredients: RecipeIngredient[]
  instructions: string | null
  estimated_time_minutes: number | null
  servings: number
  cuisine_type: string | null
  tags: string[]
  is_favorite: boolean
  times_cooked: number
  last_cooked_at: string | null
  created_at: string
}

interface SavedRecipesSectionProps {
  recipes: SavedRecipe[]
  loading: boolean
  onToggleFavorite: (recipe: SavedRecipe) => void
  onDeleteRecipe: (id: string) => void
  onRecipeClick: (recipe: SavedRecipe) => void
  onDragStart?: (recipe: SavedRecipe) => void
}

export default function SavedRecipesSection({
  recipes,
  loading,
  onToggleFavorite,
  onDeleteRecipe,
  onRecipeClick,
  onDragStart,
}: SavedRecipesSectionProps) {
  const [filters, setFilters] = useState<RecipeFiltersState>({
    search: '',
    cuisineType: null,
    maxTime: null,
    favoritesOnly: false,
    tags: [],
  })

  // Get unique cuisine types and tags from recipes
  const { cuisineTypes, allTags } = useMemo(() => {
    const cuisines = new Set<string>()
    const tags = new Set<string>()

    recipes.forEach(r => {
      if (r.cuisine_type) cuisines.add(r.cuisine_type)
      r.tags?.forEach(t => tags.add(t))
    })

    return {
      cuisineTypes: Array.from(cuisines).sort(),
      allTags: Array.from(tags).sort(),
    }
  }, [recipes])

  // Filter recipes
  const filteredRecipes = useMemo(() => {
    return recipes.filter(recipe => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const nameMatch = recipe.name.toLowerCase().includes(searchLower)
        const descMatch = recipe.description?.toLowerCase().includes(searchLower)
        const ingredientMatch = recipe.ingredients?.some(i =>
          i.name.toLowerCase().includes(searchLower)
        )
        if (!nameMatch && !descMatch && !ingredientMatch) return false
      }

      // Cuisine filter
      if (filters.cuisineType && recipe.cuisine_type !== filters.cuisineType) {
        return false
      }

      // Time filter
      if (filters.maxTime && recipe.estimated_time_minutes) {
        if (recipe.estimated_time_minutes > filters.maxTime) return false
      }

      // Favorites filter
      if (filters.favoritesOnly && !recipe.is_favorite) {
        return false
      }

      // Tags filter
      if (filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(t => recipe.tags?.includes(t))
        if (!hasMatchingTag) return false
      }

      return true
    })
  }, [recipes, filters])

  // Rediscover recipes (not cooked in 30+ days or never cooked)
  const rediscoverRecipes = useMemo(() => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    return recipes
      .filter(r => {
        if (!r.last_cooked_at) return r.times_cooked === 0
        return new Date(r.last_cooked_at) < thirtyDaysAgo
      })
      .slice(0, 6)
  }, [recipes])

  // Check if any filters are active
  const hasActiveFilters = filters.search || filters.cuisineType || filters.maxTime || filters.favoritesOnly || filters.tags.length > 0

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="aspect-[4/5] bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (recipes.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <div className="text-4xl mb-4">📚</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No saved recipes yet</h3>
        <p className="text-gray-600">Search for recipes above or import from a URL to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">My Recipes</h2>
        <span className="text-sm text-gray-500">{recipes.length} saved</span>
      </div>

      {/* Filters */}
      <RecipeFilters
        filters={filters}
        onFiltersChange={setFilters}
        cuisineTypes={cuisineTypes}
        allTags={allTags}
      />

      {/* Rediscover Section */}
      {!hasActiveFilters && rediscoverRecipes.length > 0 && (
        <RediscoverSection
          recipes={rediscoverRecipes}
          onRecipeClick={onRecipeClick}
        />
      )}

      {/* Filtered Results Info */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''} found
          </p>
          <button
            onClick={() => setFilters({
              search: '',
              cuisineType: null,
              maxTime: null,
              favoritesOnly: false,
              tags: [],
            })}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* No Filter Results */}
      {hasActiveFilters && filteredRecipes.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-xl">
          <p className="text-gray-500">No recipes match your filters</p>
          <button
            onClick={() => setFilters({
              search: '',
              cuisineType: null,
              maxTime: null,
              favoritesOnly: false,
              tags: [],
            })}
            className="mt-2 text-indigo-600 hover:text-indigo-800 text-sm"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Recipe Grid */}
      {filteredRecipes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredRecipes.map(recipe => (
            <SavedRecipeCard
              key={recipe.id}
              recipe={recipe}
              onToggleFavorite={() => onToggleFavorite(recipe)}
              onDelete={() => onDeleteRecipe(recipe.id)}
              onClick={() => onRecipeClick(recipe)}
              onDragStart={onDragStart ? () => onDragStart(recipe) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
