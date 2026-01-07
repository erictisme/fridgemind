import posthog from 'posthog-js'

// ============================================
// SCAN EVENTS
// ============================================
export const trackScanStarted = (location: string) => {
  posthog.capture('scan_started', { location })
}

export const trackScanCompleted = (data: {
  location: string
  itemsDetected: number
  itemsSelected: number
  scanMode: 'add' | 'replace'
}) => {
  posthog.capture('scan_completed', data)
}

export const trackScanFailed = (data: {
  location: string
  error: string
  errorType: 'invalid_image' | 'api_error' | 'unknown'
}) => {
  posthog.capture('scan_failed', data)
}

export const trackScanSaved = (data: {
  location: string
  itemsInserted: number
  itemsUpdated: number
  itemsDeleted: number
}) => {
  posthog.capture('scan_saved', data)
}

// ============================================
// INVENTORY EVENTS
// ============================================
export const trackItemAdded = (data: {
  method: 'manual' | 'scan' | 'paste' | 'receipt'
  itemName: string
  location: string
  quantity: number
}) => {
  posthog.capture('item_added', data)
}

export const trackItemConsumed = (data: {
  itemName: string
  reason: 'consumed' | 'wasted' | 'wrong_entry'
  daysUntilExpiry: number
  wasExpiringSoon: boolean // true if <= 3 days until expiry
  wasExpired: boolean
}) => {
  posthog.capture('item_consumed', {
    ...data,
    // Key metric: did we help prevent waste?
    savedFromWaste: data.reason === 'consumed' && data.wasExpiringSoon,
  })
}

export const trackBulkItemsConsumed = (data: {
  count: number
  reason: 'consumed' | 'wasted'
  expiringSoonCount: number // how many were <= 3 days
  expiredCount: number
}) => {
  posthog.capture('bulk_items_consumed', {
    ...data,
    wastePreventedCount: data.reason === 'consumed' ? data.expiringSoonCount : 0,
  })
}

export const trackExpiryExtended = (data: {
  itemName: string
  daysExtended: number
  previousDaysUntilExpiry: number
}) => {
  posthog.capture('expiry_extended', data)
}

// ============================================
// NUTRITION EVENTS
// ============================================
export const trackNutritionViewed = (data: {
  period: 'daily' | 'weekly' | 'monthly'
  hasMealsLogged: boolean
  mealsCount: number
}) => {
  posthog.capture('nutrition_viewed', data)
}

export const trackNutritionInsightsViewed = () => {
  posthog.capture('nutrition_insights_viewed')
}

// ============================================
// RECIPE EVENTS
// ============================================
export const trackRecipeSearched = (data: {
  query: string
  sources: string[]
  resultsCount: number
}) => {
  posthog.capture('recipe_searched', data)
}

export const trackRecipeClicked = (data: {
  recipeName: string
  source: 'web' | 'youtube' | 'saved' | 'suggestion'
  position: number // which result they clicked (1st, 2nd, etc)
}) => {
  posthog.capture('recipe_clicked', data)
}

export const trackRecipeSaved = (data: {
  recipeName: string
  source: string
}) => {
  posthog.capture('recipe_saved', data)
}

export const trackRecipeCooked = (data: {
  recipeName: string
  ingredientsUsed: number
  fromSuggestion: boolean
}) => {
  posthog.capture('recipe_cooked', data)
}

export const trackSuggestionViewed = (data: {
  suggestionType: 'use_expiring' | 'try_new' | 'based_on_inventory'
  recipeName: string
}) => {
  posthog.capture('suggestion_viewed', data)
}

export const trackSuggestionActioned = (data: {
  suggestionType: string
  action: 'clicked' | 'dismissed' | 'saved'
  recipeName: string
}) => {
  posthog.capture('suggestion_actioned', data)
}

// ============================================
// CALENDAR / MEAL PLAN EVENTS
// ============================================
export const trackCalendarViewed = () => {
  posthog.capture('calendar_viewed')
}

export const trackMealPlanCreated = (data: {
  weekStart: string
  breakfastsPlanned: number
  lunchesPlanned: number
  dinnersPlanned: number
}) => {
  posthog.capture('meal_plan_created', data)
}

export const trackMealPlanUpdated = () => {
  posthog.capture('meal_plan_updated')
}

// ============================================
// FEATURE USAGE TRACKING (for feature value assessment)
// ============================================
export const trackFeatureUsed = (data: {
  feature: 'scan' | 'manual_add' | 'recipes' | 'nutrition' | 'shopping_list' | 'meal_plan' | 'suggestions' | 'calendar' | 'history' | 'staples'
  action: 'viewed' | 'interacted'
}) => {
  posthog.capture('feature_used', data)
}

// ============================================
// FOOD WASTE METRICS (aggregate tracking)
// ============================================
export const trackFoodWasteEvent = (data: {
  eventType: 'consumed' | 'wasted'
  itemName: string
  daysUntilExpiry: number
  quantity: number
}) => {
  posthog.capture('food_waste_metric', {
    ...data,
    wasWasted: data.eventType === 'wasted',
    wasSavedBeforeExpiry: data.eventType === 'consumed' && data.daysUntilExpiry <= 3 && data.daysUntilExpiry > 0,
  })
}
