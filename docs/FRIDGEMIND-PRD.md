# FridgeMind - Product Requirements Document

**Version:** 1.0
**Last Updated:** 2025-12-10
**Status:** Active Development

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision](#3-product-vision)
4. [User Personas](#4-user-personas)
5. [Core Features (MVP)](#5-core-features-mvp)
6. [Technical Architecture](#6-technical-architecture)
7. [Data Models](#7-data-models)
8. [API Design](#8-api-design)
9. [UI/UX Specifications](#9-uiux-specifications)
10. [Implementation Phases](#10-implementation-phases)
11. [Success Metrics](#11-success-metrics)
12. [Future Roadmap](#12-future-roadmap)

---

## 1. Overview

### What is FridgeMind?

FridgeMind is an AI-powered inventory and meal-planning assistant that eliminates household cognitive load around food management. It uses **photo recognition**, **predictive restocking**, and **meal-based planning** to ensure no forgotten food, overbuying, or midweek stress.

### Core Value Proposition

> "Take photos. Get clarity. Eat smart. Live lighter."

Reduce mental fatigue from managing food and groceries — automate "what do we have" and "what should we buy."

### Key Differentiators

| Capability | FridgeMind | Competitors |
|------------|------------|-------------|
| AI photo-to-inventory | ✅ Full support | 🔸 Samsung only (hardware-locked) |
| Predictive consumption model | ✅ ML-based | ❌ None |
| Meal count integration | ✅ Weekly planning | ❌ None |
| Craving-based auto-adjustment | ✅ NLP-powered | ❌ None |
| Calendar integration | 🕐 Phase 3 | ❌ None |

---

## 2. Problem Statement

### Current Solutions Fail in 3 Ways

1. **Too Manual:** Barcode scanning and manual data entry are painful and unsustainable
2. **Too Shallow:** They track expiry but don't *predict* or *plan*
3. **Not Personal:** They ignore lifestyle patterns (meals in/out, cravings, calendar events)

### Target User Pain Points

- Mental overhead of remembering what's in the fridge
- Forgotten items leading to food waste (~$1,800/year per US household)
- Overbuying due to uncertainty about existing inventory
- Midweek stress about "what's for dinner"
- Inefficient grocery shopping (multiple trips, forgotten items)

### Competitors Analysis

| App | Weakness |
|-----|----------|
| CozZo | Manual entry, no AI vision |
| KitchenPal | Basic inventory, no predictions |
| Samsung SmartFridge | Hardware-locked, expensive |
| Paprika | Recipe-focused, no inventory tracking |
| Mealime | Meal planning only, no inventory awareness |

---

## 3. Product Vision

### Mission Statement

Build a system that *sees, learns, and plans* your food lifecycle.

### Phased Capability Map

| Phase | Feature | Goal | Tech Focus |
|-------|---------|------|------------|
| 1 | Visual inventory (photo → items) | Reduce mental load | Gemini Vision + LLM parsing |
| 1.5 | Predictive restock | Preempt missing items | Usage pattern model |
| 2 | Meal count planning | Stop overbuying | Planning algorithm |
| 2.5 | Craving input → list adjust | Delight and variety | NLP + recipe matching |
| 3 | Calendar sync | Full automation | Google Calendar API |

---

## 4. User Personas

### Primary: "Busy Professional" (Eric)

- **Age:** 28-40
- **Living Situation:** Apartment/condo, 1-2 people
- **Pain Points:**
  - Works long hours, little time for grocery planning
  - Frequently forgets what's in the fridge
  - Orders takeout when unsure what to cook
  - Wastes food regularly
- **Goals:**
  - Reduce mental load around food
  - Save money on groceries
  - Eat healthier with less effort

### Secondary: "Family Manager" (Sarah)

- **Age:** 30-50
- **Living Situation:** House, family of 3-5
- **Pain Points:**
  - Manages food for multiple people with different preferences
  - Complex meal planning for the week
  - Multiple grocery trips per week
- **Goals:**
  - Streamline family meal planning
  - Reduce food waste
  - Simplify grocery shopping

---

## 5. Core Features (MVP)

### 5.1 Photo-Based Inventory Capture

**User Flow:**
1. User opens app and taps "Scan Fridge"
2. Takes 1-3 photos (fridge interior, freezer, pantry)
3. AI processes images and identifies items
4. User reviews and confirms/edits detected items
5. Inventory is updated

**Technical Requirements:**
- Support multiple photos per scan session (fridge often requires 2-3 shots to capture all shelves)
- Handle various lighting conditions
- Detect items with 80%+ accuracy
- **Dual categorization system:**
  - **Storage category:** produce, dairy, protein, pantry, beverage, condiment, frozen
  - **Nutritional type:** vegetables, protein, carbs, vitamins (mushrooms, supplements), fats, other

**AI Output Structure:**
```json
{
  "items": [
    {
      "name": "Milk",
      "storage_category": "dairy",
      "nutritional_type": "protein",
      "location": "fridge",
      "quantity": 1,
      "unit": "gallon",
      "confidence": 0.92,
      "estimated_expiry": "2025-12-17",
      "freshness": "fresh"
    },
    {
      "name": "Shiitake Mushrooms",
      "storage_category": "produce",
      "nutritional_type": "vitamins",
      "location": "fridge",
      "quantity": 1,
      "unit": "pack",
      "confidence": 0.88,
      "estimated_expiry": "2025-12-14",
      "freshness": "fresh"
    }
  ]
}
```

### 5.2 Inventory Dashboard

**Features:**
- Grid/list view of all items
- Filter by location (fridge/freezer/pantry)
- Sort by expiry date, category, or recently added
- "Use Soon" section highlighting items expiring within 3 days
- Quick edit/delete functionality
- Search functionality

### 5.3 Meal Count Planning

**User Flow:**
1. Weekly prompt (Sunday): "How many meals at home this week?"
2. User inputs:
   - Breakfasts at home: 5
   - Lunches at home: 3
   - Dinners at home: 6
3. System calculates required ingredients by category
4. Compares with current inventory
5. Generates shopping suggestions

**Meal Planning Algorithm:**
```
needed_items = (meals_per_category × standard_portion_size) - current_inventory
```

### 5.4 Smart Shopping List

**Features:**
- Auto-generated based on:
  - Expiring items that need replacement
  - Predicted consumption patterns
  - Meal count requirements
- Manual add/remove items
- Category grouping for efficient shopping
- Checkbox completion
- Share list functionality

### 5.5 Craving-Based Adjustments (Phase 2.5)

**User Flow:**
1. User inputs cravings: "I want curry, salad, and pasta this week"
2. System parses ingredients needed for these dishes
3. Compares with inventory
4. Updates shopping list dynamically

---

## 6. Technical Architecture

### 6.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                   (Next.js + React)                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│                  (Next.js API Routes)                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌─────────────────┐ ┌───────────┐ ┌─────────────────┐
│  Google Gemini  │ │  Supabase │ │  Edge Functions │
│  Vision API     │ │  Database │ │  (Cron Jobs)    │
└─────────────────┘ └───────────┘ └─────────────────┘
```

### 6.2 Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js 14+ (App Router) | SSR, API routes, great DX |
| Styling | Tailwind CSS | Rapid UI development |
| State Management | Zustand | Lightweight, simple |
| Database | Supabase (PostgreSQL) | Hosted, auth built-in, realtime |
| Auth | Supabase Auth | Email/password, OAuth |
| AI Vision | Google Gemini 2.0 Flash | Best vision performance, competitive pricing |
| File Storage | Supabase Storage | Integrated with DB |
| Hosting | Vercel | Seamless Next.js deployment |
| Scheduling | Supabase Edge Functions | Cron jobs for reminders |

### 6.3 Security Considerations

- All API keys stored in environment variables
- Supabase Row Level Security (RLS) for data isolation
- Image uploads scanned for malware
- HTTPS everywhere
- Rate limiting on API endpoints

---

## 7. Data Models

### 7.1 Database Schema (Supabase/PostgreSQL)

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT,
  household_size INTEGER DEFAULT 1,
  dietary_preferences JSONB DEFAULT '[]',
  notification_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Food items inventory
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_category TEXT NOT NULL, -- 'produce', 'dairy', 'protein', 'pantry', 'beverage', 'condiment', 'frozen'
  nutritional_type TEXT, -- 'vegetables', 'protein', 'carbs', 'vitamins', 'fats', 'other'
  location TEXT NOT NULL, -- 'fridge', 'freezer', 'pantry'
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT, -- 'piece', 'lb', 'oz', 'gallon', 'bunch', etc.
  expiry_date DATE,
  freshness TEXT DEFAULT 'fresh', -- 'fresh', 'use_soon', 'expired'
  confidence DECIMAL(3,2), -- AI confidence score
  image_url TEXT,
  notes TEXT,
  is_staple BOOLEAN DEFAULT FALSE, -- auto-reorder item
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  consumed_at TIMESTAMPTZ -- when item was marked as used/consumed
);

-- Photo scan sessions
CREATE TABLE scan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  location TEXT NOT NULL, -- what was scanned
  image_urls TEXT[] NOT NULL,
  raw_ai_response JSONB,
  items_detected INTEGER,
  items_confirmed INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meal plans
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  breakfasts_home INTEGER DEFAULT 0,
  lunches_home INTEGER DEFAULT 0,
  dinners_home INTEGER DEFAULT 0,
  cravings TEXT[], -- array of desired dishes/cuisines
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopping lists
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Shopping List',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopping list items
CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT,
  is_checked BOOLEAN DEFAULT FALSE,
  source TEXT, -- 'auto_restock', 'expiring', 'meal_plan', 'manual', 'craving'
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consumption history (for predictions)
CREATE TABLE consumption_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity_consumed DECIMAL(10,2),
  consumed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_inventory_user ON inventory_items(user_id);
CREATE INDEX idx_inventory_expiry ON inventory_items(expiry_date);
CREATE INDEX idx_inventory_location ON inventory_items(location);
CREATE INDEX idx_consumption_user ON consumption_logs(user_id);
CREATE INDEX idx_consumption_date ON consumption_logs(consumed_at);
```

### 7.2 Row Level Security Policies

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumption_logs ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own inventory" ON inventory_items
  FOR ALL USING (auth.uid() = user_id);

-- Similar policies for other tables...
```

---

## 8. API Design

### 8.1 REST Endpoints

#### Inventory

```
POST   /api/inventory/scan          # Upload photos for AI processing
GET    /api/inventory               # Get all inventory items
GET    /api/inventory/:id           # Get single item
PATCH  /api/inventory/:id           # Update item
DELETE /api/inventory/:id           # Delete item
POST   /api/inventory/consume/:id   # Mark item as consumed
GET    /api/inventory/expiring      # Get items expiring soon
```

#### Meal Planning

```
GET    /api/meal-plans              # Get all meal plans
POST   /api/meal-plans              # Create meal plan for week
PATCH  /api/meal-plans/:id          # Update meal plan
GET    /api/meal-plans/current      # Get current week's plan
POST   /api/meal-plans/cravings     # Add cravings to current plan
```

#### Shopping Lists

```
GET    /api/shopping-lists          # Get all shopping lists
POST   /api/shopping-lists          # Create new list
GET    /api/shopping-lists/active   # Get active shopping list
POST   /api/shopping-lists/generate # Auto-generate based on inventory
PATCH  /api/shopping-lists/:id/items/:itemId  # Toggle item checked
```

### 8.2 API Request/Response Examples

#### Scan Inventory

**Request:**
```http
POST /api/inventory/scan
Content-Type: multipart/form-data

{
  "images": [File, File, File],
  "location": "fridge"
}
```

**Response:**
```json
{
  "success": true,
  "session_id": "uuid",
  "detected_items": [
    {
      "id": "temp-1",
      "name": "Milk (2%)",
      "category": "dairy",
      "quantity": 1,
      "unit": "gallon",
      "estimated_expiry": "2025-12-17",
      "confidence": 0.94,
      "needs_confirmation": false
    },
    {
      "id": "temp-2",
      "name": "Unknown item",
      "category": "unknown",
      "confidence": 0.45,
      "needs_confirmation": true,
      "suggestions": ["Butter", "Cheese block", "Tofu"]
    }
  ],
  "summary": {
    "total_detected": 12,
    "high_confidence": 10,
    "needs_review": 2
  }
}
```

---

## 9. UI/UX Specifications

### 9.1 Navigation Structure

```
Home (Dashboard)
├── Inventory
│   ├── Fridge
│   ├── Freezer
│   └── Pantry
├── Scan (Photo capture)
├── Meal Plan
├── Shopping List
└── Settings
```

### 9.2 Key Screens

#### Dashboard (Home)
- Quick stats: Items expiring soon, shopping list preview
- "Scan Now" prominent button
- Recent activity feed
- Weekly meal plan summary

#### Scan Flow
1. Camera view with guides
2. Photo review (add more / proceed)
3. AI processing animation
4. Results review with edit capability
5. Confirmation and save

#### Inventory View
- Toggle: Grid / List view
- Tabs: Fridge | Freezer | Pantry | All
- Each item card shows:
  - Name, quantity
  - Expiry indicator (color-coded)
  - Quick actions (edit, delete, consume)

#### Meal Plan View
- Week view with meal slots
- Input fields for meals at home
- Cravings input section
- "Generate Shopping List" button

### 9.3 Design System

**Colors:**
```
Primary:       #10B981 (Emerald 500) - Fresh, food-positive
Secondary:     #3B82F6 (Blue 500) - Trust, intelligence
Warning:       #F59E0B (Amber 500) - Use soon
Danger:        #EF4444 (Red 500) - Expired
Background:    #F9FAFB (Gray 50)
Surface:       #FFFFFF
Text Primary:  #111827 (Gray 900)
Text Secondary:#6B7280 (Gray 500)
```

**Typography:**
- Font: Inter (system-ui fallback)
- Headings: 600 weight
- Body: 400 weight

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goals:**
- Project setup and infrastructure
- Basic UI shell
- Photo capture and AI integration
- Simple inventory CRUD

**Tasks:**
- [x] Initialize Next.js project with TypeScript and Tailwind
- [ ] Set up Supabase project
- [ ] Create database schema
- [ ] Implement auth (email/password)
- [ ] Build basic layout and navigation
- [ ] Implement photo upload to Supabase Storage
- [ ] Integrate Gemini Vision API
- [ ] Build AI response parser
- [ ] Create inventory display components
- [ ] Implement basic CRUD for inventory items

**Deliverable:** User can sign up, take photos, see detected items, and manage inventory.

### Phase 1.5: Predictive Restock (Week 3)

**Goals:**
- Track consumption patterns
- Simple prediction model
- Auto-suggestions for restock

**Tasks:**
- [ ] Create consumption logging system
- [ ] Build consumption pattern analyzer
- [ ] Implement "staple items" feature
- [ ] Create restock suggestions algorithm
- [ ] Add "Running Low" indicators

**Deliverable:** System learns what user buys regularly and suggests restocking.

### Phase 2: Meal Planning (Week 4)

**Goals:**
- Weekly meal count input
- Need calculation algorithm
- Shopping list generation

**Tasks:**
- [ ] Build meal plan input UI
- [ ] Create need calculation engine
- [ ] Implement shopping list auto-generation
- [ ] Build shopping list management UI
- [ ] Add category-based list grouping

**Deliverable:** User inputs meals/week, gets smart shopping list comparing inventory vs needs.

### Phase 2.5: Cravings Integration (Week 5)

**Goals:**
- Natural language craving input
- Recipe/ingredient matching
- Dynamic list updates

**Tasks:**
- [ ] Build craving input UI
- [ ] Create ingredient extraction from cravings
- [ ] Build recipe database integration (or simple mapping)
- [ ] Update shopping list generator to include craving items

**Deliverable:** User says "want curry" → system adds curry ingredients to list.

### Phase 3: Polish & Reminders (Week 6)

**Goals:**
- Weekly reminder system
- UX improvements
- Performance optimization

**Tasks:**
- [ ] Implement push notifications / email reminders
- [ ] Friday evening: "Time to scan your fridge!"
- [ ] Sunday afternoon: "Plan your meals for the week"
- [ ] Add loading states and error handling
- [ ] Optimize image processing
- [ ] Mobile responsiveness polish
- [ ] Add onboarding flow

**Deliverable:** Complete MVP ready for user testing.

---

## 11. Success Metrics

### Quantitative Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Setup time (first scan) | < 3 minutes | Time from signup to first inventory |
| Manual edits per scan | < 5 items | Corrections needed post-AI detection |
| AI detection accuracy | > 80% | Correct items / total items |
| Weekly active usage | > 60% | Users scanning weekly |
| Shopping list usage | > 40% | Users generating lists |
| Food waste reduction | ≥ 30% | User survey after 1 month |

### Qualitative Metrics

- User satisfaction (NPS > 50)
- Mental load reduction (user survey)
- Time saved per week (user estimate)

---

## 12. Future Roadmap

### Phase 4: Calendar Integration
- Google Calendar sync
- Auto-adjust meal counts based on events
- "Dinner party" detection → larger portions

### Phase 5: Advanced Features
- Voice shortcuts: "What's left in the fridge?"
- Recipe suggestions based on inventory
- Nutrition tracking
- Multi-user household sharing

### Phase 6: Ecosystem
- Auto grocery ordering (Instacart, Amazon Fresh)
- Smart home integration (notify when item removed)
- Community recipes/meal plans

---

## Appendix A: AI Prompt for Vision Processing

```
You are a food inventory assistant. Analyze the provided image(s) of a refrigerator/freezer/pantry and identify all visible food items.

For each item, provide:
1. Name (be specific: "2% milk" not just "milk")
2. Category: produce, dairy, protein, pantry, beverage, condiment, frozen
3. Estimated quantity and unit
4. Estimated days until expiry (based on typical shelf life)
5. Confidence score (0.0-1.0)

Output format: JSON array of items.

Be thorough but only include items you can clearly identify. For partially visible or unclear items, lower the confidence score and provide your best guess with alternatives.

Special considerations:
- Distinguish between similar items (cheddar vs mozzarella)
- Note if containers appear nearly empty
- Identify produce freshness (fresh, wilting, etc.)
```

---

## Appendix B: Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google AI
GOOGLE_AI_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Appendix C: File Structure

```
fridgemind/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx           # Dashboard home
│   │   │   ├── inventory/
│   │   │   ├── scan/
│   │   │   ├── meal-plan/
│   │   │   ├── shopping-list/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   ├── inventory/
│   │   │   ├── meal-plans/
│   │   │   └── shopping-lists/
│   │   ├── layout.tsx
│   │   └── page.tsx               # Landing page
│   ├── components/
│   │   ├── ui/                    # Shared UI components
│   │   ├── inventory/
│   │   ├── scan/
│   │   ├── meal-plan/
│   │   └── shopping-list/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── types.ts
│   │   ├── gemini/
│   │   │   └── vision.ts
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── useInventory.ts
│   │   ├── useMealPlan.ts
│   │   └── useShoppingList.ts
│   ├── stores/
│   │   └── inventoryStore.ts
│   └── types/
│       └── index.ts
├── docs/
│   ├── FRIDGEMIND-PRD.md
│   └── plans/
├── public/
├── supabase/
│   └── migrations/
├── .env.local
├── .env.example
└── README.md
```

---

**Document Status:** Living document, will be updated as development progresses.

**Next Steps:**
1. Set up Supabase project and apply migrations
2. Obtain Google AI API key for Gemini Vision
3. Begin Phase 1 implementation following superpowers workflow
