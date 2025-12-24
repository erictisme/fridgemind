// FatSecret API Types

export interface FatSecretToken {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number // Unix timestamp when token expires
}

export interface FatSecretServing {
  serving_id: string
  serving_description: string
  serving_url: string
  metric_serving_amount?: string
  metric_serving_unit?: string
  number_of_units?: string
  measurement_description?: string
  calories?: string
  carbohydrate?: string
  protein?: string
  fat?: string
  saturated_fat?: string
  polyunsaturated_fat?: string
  monounsaturated_fat?: string
  cholesterol?: string
  sodium?: string
  potassium?: string
  fiber?: string
  sugar?: string
  vitamin_a?: string
  vitamin_c?: string
  calcium?: string
  iron?: string
}

export interface FatSecretFood {
  food_id: string
  food_name: string
  food_type: 'Generic' | 'Brand'
  brand_name?: string
  food_url: string
  food_description?: string
  servings?: {
    serving: FatSecretServing | FatSecretServing[]
  }
}

export interface FatSecretSearchResult {
  foods: {
    food: FatSecretFood[]
    max_results: string
    page_number: string
    total_results: string
  }
}

export interface FatSecretFoodResult {
  food: FatSecretFood
}

export interface FatSecretAutocompleteResult {
  suggestions: {
    suggestion: string[]
  }
}

// Normalized nutrition data for our app
export interface NormalizedNutrition {
  food_id: string
  food_name: string
  brand_name?: string
  serving_description: string
  calories: number
  protein_grams: number
  carbs_grams: number
  fat_grams: number
  fiber_grams: number
  sodium_mg?: number
  sugar_grams?: number
}

export interface FatSecretError {
  error: {
    code: number
    message: string
  }
}
