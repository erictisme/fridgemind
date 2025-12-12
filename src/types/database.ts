export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          household_size: number
          dietary_preferences: Json
          notification_preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          household_size?: number
          dietary_preferences?: Json
          notification_preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          household_size?: number
          dietary_preferences?: Json
          notification_preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      inventory_items: {
        Row: {
          id: string
          user_id: string
          name: string
          storage_category: string
          nutritional_type: string | null
          location: string
          quantity: number
          unit: string | null
          purchase_date: string | null
          expiry_date: string | null
          freshness: string
          confidence: number | null
          image_url: string | null
          notes: string | null
          is_staple: boolean
          created_at: string
          updated_at: string
          consumed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          storage_category: string
          nutritional_type?: string | null
          location: string
          quantity?: number
          unit?: string | null
          purchase_date?: string | null
          expiry_date?: string | null
          freshness?: string
          confidence?: number | null
          image_url?: string | null
          notes?: string | null
          is_staple?: boolean
          created_at?: string
          updated_at?: string
          consumed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          storage_category?: string
          nutritional_type?: string | null
          location?: string
          quantity?: number
          unit?: string | null
          purchase_date?: string | null
          expiry_date?: string | null
          freshness?: string
          confidence?: number | null
          image_url?: string | null
          notes?: string | null
          is_staple?: boolean
          created_at?: string
          updated_at?: string
          consumed_at?: string | null
        }
      }
      scan_sessions: {
        Row: {
          id: string
          user_id: string
          location: string
          image_urls: string[]
          raw_ai_response: Json | null
          items_detected: number
          items_confirmed: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          location: string
          image_urls: string[]
          raw_ai_response?: Json | null
          items_detected?: number
          items_confirmed?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          location?: string
          image_urls?: string[]
          raw_ai_response?: Json | null
          items_detected?: number
          items_confirmed?: number
          created_at?: string
        }
      }
      meal_plans: {
        Row: {
          id: string
          user_id: string
          week_start: string
          breakfasts_home: number
          lunches_home: number
          dinners_home: number
          cravings: string[] | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          week_start: string
          breakfasts_home?: number
          lunches_home?: number
          dinners_home?: number
          cravings?: string[] | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          week_start?: string
          breakfasts_home?: number
          lunches_home?: number
          dinners_home?: number
          cravings?: string[] | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      shopping_lists: {
        Row: {
          id: string
          user_id: string
          name: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      shopping_list_items: {
        Row: {
          id: string
          list_id: string
          user_id: string
          name: string
          category: string | null
          quantity: number
          unit: string | null
          is_checked: boolean
          source: string | null
          priority: number
          created_at: string
        }
        Insert: {
          id?: string
          list_id: string
          user_id: string
          name: string
          category?: string | null
          quantity?: number
          unit?: string | null
          is_checked?: boolean
          source?: string | null
          priority?: number
          created_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          user_id?: string
          name?: string
          category?: string | null
          quantity?: number
          unit?: string | null
          is_checked?: boolean
          source?: string | null
          priority?: number
          created_at?: string
        }
      }
      consumption_logs: {
        Row: {
          id: string
          user_id: string
          item_name: string
          category: string
          quantity_consumed: number
          consumed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          item_name: string
          category: string
          quantity_consumed?: number
          consumed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          item_name?: string
          category?: string
          quantity_consumed?: number
          consumed_at?: string
        }
      }
      taste_profiles: {
        Row: {
          id: string
          user_id: string
          skill_level: string
          cooking_time_preference: string
          spice_tolerance: string
          cuisine_preferences: Json
          dietary_restrictions: Json
          learned_ingredients: Json
          learned_cooking_methods: Json
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          skill_level?: string
          cooking_time_preference?: string
          spice_tolerance?: string
          cuisine_preferences?: Json
          dietary_restrictions?: Json
          learned_ingredients?: Json
          learned_cooking_methods?: Json
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          skill_level?: string
          cooking_time_preference?: string
          spice_tolerance?: string
          cuisine_preferences?: Json
          dietary_restrictions?: Json
          learned_ingredients?: Json
          learned_cooking_methods?: Json
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      cooked_meals: {
        Row: {
          id: string
          user_id: string
          name: string
          image_url: string | null
          detected_ingredients: Json
          cooking_method: string | null
          cuisine_type: string | null
          meal_type: string | null
          rating: number | null
          would_make_again: boolean | null
          notes: string | null
          cooked_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          image_url?: string | null
          detected_ingredients?: Json
          cooking_method?: string | null
          cuisine_type?: string | null
          meal_type?: string | null
          rating?: number | null
          would_make_again?: boolean | null
          notes?: string | null
          cooked_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          image_url?: string | null
          detected_ingredients?: Json
          cooking_method?: string | null
          cuisine_type?: string | null
          meal_type?: string | null
          rating?: number | null
          would_make_again?: boolean | null
          notes?: string | null
          cooked_at?: string
          created_at?: string
        }
      }
      meal_suggestions: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          recipe_summary: string | null
          estimated_time_minutes: number | null
          difficulty: string | null
          ingredients_available: Json
          ingredients_missing: Json
          priority_score: number
          expiring_items_used: Json
          status: string
          generated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          recipe_summary?: string | null
          estimated_time_minutes?: number | null
          difficulty?: string | null
          ingredients_available?: Json
          ingredients_missing?: Json
          priority_score?: number
          expiring_items_used?: Json
          status?: string
          generated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          recipe_summary?: string | null
          estimated_time_minutes?: number | null
          difficulty?: string | null
          ingredients_available?: Json
          ingredients_missing?: Json
          priority_score?: number
          expiring_items_used?: Json
          status?: string
          generated_at?: string
          created_at?: string
        }
      }
      eating_out_logs: {
        Row: {
          id: string
          user_id: string
          image_url: string | null
          restaurant_name: string | null
          meal_name: string | null
          meal_type: string | null
          estimated_calories: number | null
          protein_grams: number | null
          carbs_grams: number | null
          fat_grams: number | null
          fiber_grams: number | null
          vegetable_servings: number | null
          detected_components: Json
          health_assessment: string | null
          ai_notes: string | null
          notes: string | null
          eaten_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          image_url?: string | null
          restaurant_name?: string | null
          meal_name?: string | null
          meal_type?: string | null
          estimated_calories?: number | null
          protein_grams?: number | null
          carbs_grams?: number | null
          fat_grams?: number | null
          fiber_grams?: number | null
          vegetable_servings?: number | null
          detected_components?: Json
          health_assessment?: string | null
          ai_notes?: string | null
          notes?: string | null
          eaten_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          image_url?: string | null
          restaurant_name?: string | null
          meal_name?: string | null
          meal_type?: string | null
          estimated_calories?: number | null
          protein_grams?: number | null
          carbs_grams?: number | null
          fat_grams?: number | null
          fiber_grams?: number | null
          vegetable_servings?: number | null
          detected_components?: Json
          health_assessment?: string | null
          ai_notes?: string | null
          notes?: string | null
          eaten_at?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Convenience types
export type Profile = Tables<'profiles'>
export type InventoryItem = Tables<'inventory_items'>
export type ScanSession = Tables<'scan_sessions'>
export type MealPlan = Tables<'meal_plans'>
export type ShoppingList = Tables<'shopping_lists'>
export type ShoppingListItem = Tables<'shopping_list_items'>
export type ConsumptionLog = Tables<'consumption_logs'>
export type TasteProfile = Tables<'taste_profiles'>
export type CookedMeal = Tables<'cooked_meals'>
export type MealSuggestion = Tables<'meal_suggestions'>
export type EatingOutLog = Tables<'eating_out_logs'>

// Storage category options
export const STORAGE_CATEGORIES = [
  'produce',
  'dairy',
  'protein',
  'pantry',
  'beverage',
  'condiment',
  'frozen',
] as const

export type StorageCategory = typeof STORAGE_CATEGORIES[number]

// Nutritional type options (simplified)
export const NUTRITIONAL_TYPES = [
  'protein',
  'carbs',
  'fibre',
  'misc',
] as const

export type NutritionalType = typeof NUTRITIONAL_TYPES[number]

// Location options
export const LOCATIONS = ['fridge', 'freezer', 'pantry'] as const
export type Location = typeof LOCATIONS[number]

// Freshness options
export const FRESHNESS_LEVELS = ['fresh', 'use_soon', 'expired'] as const
export type Freshness = typeof FRESHNESS_LEVELS[number]

// Taste profile options
export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'] as const
export type SkillLevel = typeof SKILL_LEVELS[number]

export const COOKING_TIME_PREFERENCES = ['quick', 'medium', 'elaborate'] as const
export type CookingTimePreference = typeof COOKING_TIME_PREFERENCES[number]

export const SPICE_TOLERANCES = ['mild', 'medium', 'spicy', 'very_spicy'] as const
export type SpiceTolerance = typeof SPICE_TOLERANCES[number]

export const CUISINE_TYPES = [
  'italian', 'chinese', 'japanese', 'mexican', 'indian',
  'thai', 'korean', 'mediterranean', 'american', 'french',
  'vietnamese', 'middle_eastern', 'greek', 'spanish'
] as const
export type CuisineType = typeof CUISINE_TYPES[number]

export const DIETARY_RESTRICTIONS = [
  'vegetarian', 'vegan', 'gluten_free', 'dairy_free',
  'nut_free', 'halal', 'kosher', 'low_carb', 'keto'
] as const
export type DietaryRestriction = typeof DIETARY_RESTRICTIONS[number]

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealType = typeof MEAL_TYPES[number]

export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const
export type DifficultyLevel = typeof DIFFICULTY_LEVELS[number]

export const HEALTH_ASSESSMENTS = [
  'balanced', 'protein_heavy', 'carb_heavy', 'high_fat', 'vegetable_rich', 'light'
] as const
export type HealthAssessment = typeof HEALTH_ASSESSMENTS[number]
