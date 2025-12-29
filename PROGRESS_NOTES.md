# FridgeMind Progress Notes

## Session: Dec 30, 2024 (12:15 AM)

### Completed Today

#### 1. Recipe Parsing Accuracy Fix
**Problem:** Gemini was being "flexible" with quantities, causing major errors:
- `1/4 cup fish sauce` → `1 cup` (4x too much!)
- `1/2 red onion` → `1 red onion` (doubled)

**Solution:** Updated all prompts in `/src/lib/gemini/recipes.ts`:
- Added **CRITICAL** warning: "Be EXACT with quantities. Copy verbatim."
- Include prep details in ingredient names: `"red onion, very finely sliced"`
- Added `prep_time_minutes`, `cook_time_minutes`, `notes` fields

#### 2. Recipe Search Reliability
**Problem:** DuckDuckGo rate limiting returns 0 results after many searches.

**Solution:** Added fallback in `/src/app/api/recipes/search/route.ts`:
- `searchDirectOnSites()` - searches recipe sites directly when DDG fails
- Strict URL filtering: requires query words in URL, excludes index/archive pages
- Extracts recipe URLs from href attributes

#### 3. YouTube Quality Filter
**Problem:** YouTube returning Shorts and low-view AI-generated videos.

**Solution:**
- Minimum 10K views required
- Videos under 2 minutes filtered out
- Results sorted by view count (highest first)

#### 4. Minor Fixes
- HTML entity decoding (`&#39;` → `'`)
- Error feedback when YouTube save fails (many videos don't have recipes in description)

---

### Known Issues / TODO

#### DuckDuckGo Rate Limiting
- Still happens after ~20-30 searches
- Fallback works but less reliable
- **Potential fix:** Add delay between searches, or use different search backend

#### YouTube "Save to Library" Often Fails
- Many cooking videos don't have written recipes in descriptions
- Gemini can't extract recipe → save fails
- **Potential fix:**
  - Use YouTube transcript API to extract from spoken words
  - Or just show "Watch Video" button instead of "Save"

#### Recipe Scraping Still Imperfect
- Some recipe sites have non-standard HTML structure
- Direct site search can miss good results
- **Potential fix:** Add more sites to trusted list, improve URL pattern matching

---

### Files Changed This Session

```
src/lib/gemini/recipes.ts
  - Updated PARSE_RECIPE_TEXT_PROMPT (strict quantity extraction)
  - Updated INSTAGRAM_RECIPE_PROMPT
  - Updated YOUTUBE_RECIPE_PROMPT
  - Updated BULK_RECIPE_PARSE_PROMPT
  - Added prep_time_minutes, cook_time_minutes, notes to ParsedRecipe

src/app/api/recipes/search/route.ts
  - Added decodeHtmlEntities() function
  - Added searchDirectOnSites() fallback function
  - Updated processYouTubeResults() with 10K view minimum
  - Applied HTML entity decoding to recipe data

src/app/(dashboard)/dashboard/inspire/components/RecipeSearchSection.tsx
  - Added error alert when save fails
```

---

### Quick Test Commands

```bash
# Start dev server
npm run dev -- -p 1234

# Test recipe parsing (need to be logged in via browser)
# Go to: http://localhost:1234/dashboard/inspire
# Search: "vietnamese chicken salad"
# Try saving a web result
```

---

### Commits Today
- `84df3d2` - Improve recipe parsing accuracy and search reliability
- `2015654` - Fix YouTube Shorts and ingredient modal

---

### Next Session Ideas
1. Consider alternative search API (Brave Search has free tier)
2. Add YouTube transcript parsing for better recipe extraction
3. Test recipe quantity accuracy with more URLs
4. Deploy to Vercel and test production
