-- Saved recipes from any source (Instagram, manual, AI suggestions)
CREATE TABLE saved_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL, -- 'instagram', 'manual', 'ai_suggestion', 'url'
  source_url TEXT, -- Instagram post URL, blog URL, etc.
  source_account TEXT, -- Instagram handle if applicable
  image_url TEXT, -- Stored image or original URL
  ingredients JSONB DEFAULT '[]', -- [{name, quantity, unit, optional}]
  instructions TEXT, -- Flexible recipe text
  estimated_time_minutes INTEGER,
  servings INTEGER DEFAULT 2,
  cuisine_type TEXT,
  tags JSONB DEFAULT '[]', -- ['vegetarian', 'quick', 'one-pot']
  is_favorite BOOLEAN DEFAULT false,
  times_cooked INTEGER DEFAULT 0,
  last_cooked_at TIMESTAMPTZ,
  notes TEXT, -- "recipes are guides, not gods" notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Instagram accounts the user follows for recipes
CREATE TABLE followed_recipe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform TEXT DEFAULT 'instagram', -- Future: 'youtube', 'tiktok'
  account_handle TEXT NOT NULL, -- '@charlottemei'
  account_name TEXT, -- 'Charlotte Mei'
  profile_image_url TEXT,
  last_fetched_at TIMESTAMPTZ,
  fetch_frequency_hours INTEGER DEFAULT 24,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, account_handle)
);

-- Fetched posts from followed accounts (cache)
CREATE TABLE fetched_recipe_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES followed_recipe_accounts(id) ON DELETE CASCADE NOT NULL,
  platform_post_id TEXT NOT NULL, -- Instagram post ID
  post_url TEXT NOT NULL,
  image_urls JSONB DEFAULT '[]',
  caption TEXT,
  posted_at TIMESTAMPTZ,
  is_recipe BOOLEAN, -- AI-determined if this looks like a recipe
  parsed_recipe JSONB, -- If is_recipe, AI-extracted recipe data
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, platform_post_id)
);

-- Frequently bought items for quick re-add
CREATE TABLE frequently_bought_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  default_quantity INTEGER DEFAULT 1,
  default_unit TEXT DEFAULT 'pc',
  purchase_count INTEGER DEFAULT 1,
  last_purchased_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, LOWER(name))
);

-- User actions log for smart feed context
CREATE TABLE user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL, -- 'scan', 'log_meal', 'add_shopping', 'upload_receipt', 'cook_recipe'
  action_data JSONB, -- Contextual data about the action
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add recipe grouping and item type to shopping list items
ALTER TABLE shopping_list_items
ADD COLUMN IF NOT EXISTS recipe_source_id UUID REFERENCES saved_recipes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'food'; -- 'food', 'household'

-- Enable RLS
ALTER TABLE saved_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE followed_recipe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fetched_recipe_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE frequently_bought_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for saved_recipes
CREATE POLICY "Users can manage own recipes" ON saved_recipes
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for followed_recipe_accounts
CREATE POLICY "Users can manage own followed accounts" ON followed_recipe_accounts
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for fetched_recipe_posts (access through account ownership)
CREATE POLICY "Users can view posts from their followed accounts" ON fetched_recipe_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM followed_recipe_accounts
      WHERE followed_recipe_accounts.id = fetched_recipe_posts.account_id
      AND followed_recipe_accounts.user_id = auth.uid()
    )
  );

-- RLS policies for frequently_bought_items
CREATE POLICY "Users can manage own frequently bought items" ON frequently_bought_items
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for user_activity_log
CREATE POLICY "Users can manage own activity log" ON user_activity_log
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_saved_recipes_user_id ON saved_recipes(user_id);
CREATE INDEX idx_saved_recipes_source_type ON saved_recipes(source_type);
CREATE INDEX idx_saved_recipes_is_favorite ON saved_recipes(is_favorite);
CREATE INDEX idx_followed_accounts_user_id ON followed_recipe_accounts(user_id);
CREATE INDEX idx_fetched_posts_account_id ON fetched_recipe_posts(account_id);
CREATE INDEX idx_fetched_posts_is_recipe ON fetched_recipe_posts(is_recipe);
CREATE INDEX idx_frequently_bought_user_id ON frequently_bought_items(user_id);
CREATE INDEX idx_activity_log_user_id ON user_activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON user_activity_log(created_at DESC);
CREATE INDEX idx_shopping_items_recipe_source ON shopping_list_items(recipe_source_id);
