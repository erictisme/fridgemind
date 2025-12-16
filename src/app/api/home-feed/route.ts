import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ExpiringItem {
  id: string
  name: string
  expiry_date: string
  days_until_expiry: number
  quantity: number
  unit: string | null
}

interface SuggestedAction {
  type: 'scan' | 'shop' | 'cook' | 'store' | 'inspire' | 'use_soon'
  title: string
  description: string
  icon: string
  href: string
  priority: number
  data?: {
    items?: ExpiringItem[]
    count?: number
  }
}

interface HomeFeedResponse {
  success: boolean
  context: {
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'night'
    inventory_count: number
    expiring_soon_count: number
    shopping_list_count: number
    recipes_count: number
  }
  primary_action: SuggestedAction | null
  secondary_actions: SuggestedAction[]
  expiring_items: ExpiringItem[]
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const timeOfDay = getTimeOfDay()
    const today = new Date().toISOString().split('T')[0]

    // Fetch inventory count and expiring items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inventoryItems } = await (supabase as any)
      .from('inventory_items')
      .select('id, name, expiry_date, quantity, unit')
      .eq('user_id', user.id)
      .is('consumed_at', null)

    const inventory = inventoryItems || []
    const inventoryCount = inventory.length

    // Calculate expiring items (within 3 days)
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const expiringItems: ExpiringItem[] = inventory
      .filter((item: { expiry_date: string | null }) => {
        if (!item.expiry_date) return false
        const expiryDate = new Date(item.expiry_date)
        return expiryDate <= threeDaysFromNow
      })
      .map((item: { id: string; name: string; expiry_date: string; quantity: number; unit: string | null }) => {
        const expiryDate = new Date(item.expiry_date)
        const todayDate = new Date(today)
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
        return {
          id: item.id,
          name: item.name,
          expiry_date: item.expiry_date,
          days_until_expiry: daysUntilExpiry,
          quantity: item.quantity,
          unit: item.unit,
        }
      })
      .sort((a: ExpiringItem, b: ExpiringItem) => a.days_until_expiry - b.days_until_expiry)

    // Fetch shopping list count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shoppingItems } = await (supabase as any)
      .from('shopping_list_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_checked', false)

    const shoppingListCount = shoppingItems?.length || 0

    // Fetch recipes count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recipes } = await (supabase as any)
      .from('saved_recipes')
      .select('id')
      .eq('user_id', user.id)

    const recipesCount = recipes?.length || 0

    // Build suggested actions based on context
    const actions: SuggestedAction[] = []

    // Priority 1: Items expiring very soon (today or tomorrow)
    const urgentExpiring = expiringItems.filter(i => i.days_until_expiry <= 1)
    if (urgentExpiring.length > 0) {
      actions.push({
        type: 'use_soon',
        title: 'Use these today!',
        description: `${urgentExpiring.length} item${urgentExpiring.length > 1 ? 's' : ''} expiring`,
        icon: '🔥',
        href: '/dashboard/suggestions',
        priority: 100,
        data: { items: urgentExpiring.slice(0, 3), count: urgentExpiring.length },
      })
    }

    // Priority 2: Empty or very low inventory
    if (inventoryCount === 0) {
      actions.push({
        type: 'scan',
        title: 'Scan your kitchen',
        description: 'Start by adding what you have',
        icon: '📷',
        href: '/dashboard/scan',
        priority: 90,
      })
    } else if (inventoryCount < 5) {
      actions.push({
        type: 'store',
        title: 'Stock up your kitchen',
        description: 'Your inventory is running low',
        icon: '🛒',
        href: '/dashboard/groceries',
        priority: 70,
      })
    }

    // Priority 3: Shopping list ready
    if (shoppingListCount > 0) {
      actions.push({
        type: 'shop',
        title: 'Ready to shop',
        description: `${shoppingListCount} item${shoppingListCount > 1 ? 's' : ''} on your list`,
        icon: '🛍️',
        href: '/dashboard/shopping-list',
        priority: 60,
        data: { count: shoppingListCount },
      })
    }

    // Priority 4: Meal time suggestions
    const isMealTime = (timeOfDay === 'morning' || timeOfDay === 'evening') && inventoryCount > 0
    if (isMealTime) {
      actions.push({
        type: 'cook',
        title: timeOfDay === 'morning' ? 'What\'s for breakfast?' : 'What\'s for dinner?',
        description: 'Get meal ideas from your inventory',
        icon: '🍳',
        href: '/dashboard/suggestions',
        priority: 50,
      })
    }

    // Priority 5: Items expiring soon (within 3 days)
    if (expiringItems.length > urgentExpiring.length) {
      const soonExpiring = expiringItems.filter(i => i.days_until_expiry > 1 && i.days_until_expiry <= 3)
      if (soonExpiring.length > 0) {
        actions.push({
          type: 'use_soon',
          title: 'Use soon',
          description: `${soonExpiring.length} item${soonExpiring.length > 1 ? 's'  : ''} expiring in 2-3 days`,
          icon: '⚠️',
          href: '/dashboard/suggestions',
          priority: 40,
          data: { items: soonExpiring.slice(0, 3), count: soonExpiring.length },
        })
      }
    }

    // Priority 6: Get inspiration
    if (recipesCount === 0) {
      actions.push({
        type: 'inspire',
        title: 'Save your first recipe',
        description: 'Import from Instagram or paste text',
        icon: '✨',
        href: '/dashboard/inspire',
        priority: 30,
      })
    } else {
      actions.push({
        type: 'inspire',
        title: 'Browse recipes',
        description: `${recipesCount} saved recipe${recipesCount > 1 ? 's' : ''}`,
        icon: '📚',
        href: '/dashboard/inspire',
        priority: 20,
      })
    }

    // Default: General cook suggestion
    if (inventoryCount > 0 && !isMealTime) {
      actions.push({
        type: 'cook',
        title: 'What to cook?',
        description: 'Get meal suggestions',
        icon: '🍳',
        href: '/dashboard/suggestions',
        priority: 10,
      })
    }

    // Sort by priority
    actions.sort((a, b) => b.priority - a.priority)

    const response: HomeFeedResponse = {
      success: true,
      context: {
        time_of_day: timeOfDay,
        inventory_count: inventoryCount,
        expiring_soon_count: expiringItems.length,
        shopping_list_count: shoppingListCount,
        recipes_count: recipesCount,
      },
      primary_action: actions[0] || null,
      secondary_actions: actions.slice(1, 4),
      expiring_items: expiringItems.slice(0, 5),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Home feed error:', error)
    return NextResponse.json(
      { error: 'Failed to load home feed' },
      { status: 500 }
    )
  }
}
