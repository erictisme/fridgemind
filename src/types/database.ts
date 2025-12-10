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

// Nutritional type options
export const NUTRITIONAL_TYPES = [
  'vegetables',
  'protein',
  'carbs',
  'vitamins',
  'fats',
  'other',
] as const

export type NutritionalType = typeof NUTRITIONAL_TYPES[number]

// Location options
export const LOCATIONS = ['fridge', 'freezer', 'pantry'] as const
export type Location = typeof LOCATIONS[number]

// Freshness options
export const FRESHNESS_LEVELS = ['fresh', 'use_soon', 'expired'] as const
export type Freshness = typeof FRESHNESS_LEVELS[number]
