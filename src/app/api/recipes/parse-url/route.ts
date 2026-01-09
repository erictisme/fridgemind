import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractRecipeFromInstagram, extractRecipeFromYouTube } from '@/lib/gemini/recipes'

interface RequestBody {
  url: string
  save?: boolean
}

interface OEmbedResponse {
  title?: string
  author_name?: string
  thumbnail_url?: string
  html?: string
}

interface YouTubeOEmbedResponse {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

interface YouTubeDataAPIResponse {
  items?: Array<{
    snippet?: {
      title: string
      description: string
      channelTitle: string
      thumbnails?: {
        high?: { url: string }
        medium?: { url: string }
      }
    }
  }>
}

// Extract Instagram post ID from URL
function extractInstagramPostId(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/)
  return match ? match[1] : null
}

// Extract YouTube video ID from URL
function extractYouTubeVideoId(url: string): string | null {
  // Match patterns like:
  // https://www.youtube.com/watch?v=VIDEO_ID
  // https://youtu.be/VIDEO_ID
  // https://www.youtube.com/embed/VIDEO_ID
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Fetch YouTube video data via oEmbed (no API key needed)
async function fetchYouTubeOEmbed(url: string): Promise<YouTubeOEmbedResponse | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const response = await fetch(oembedUrl)

    if (!response.ok) {
      console.log('YouTube oEmbed failed with status:', response.status)
      return null
    }

    return await response.json()
  } catch (error) {
    console.log('YouTube oEmbed fetch error:', error)
    return null
  }
}

// Fetch YouTube video data via Data API (requires API key, gets full description)
async function fetchYouTubeDataAPI(videoId: string): Promise<{
  title: string
  description: string
  channelTitle: string
  thumbnailUrl: string | null
} | null> {
  const apiKey = process.env.YOUTUBE_API_KEY

  if (!apiKey) {
    console.log('YOUTUBE_API_KEY not configured')
    return null
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`
    )

    if (!response.ok) {
      console.log('YouTube Data API failed with status:', response.status)
      return null
    }

    const data: YouTubeDataAPIResponse = await response.json()
    const video = data.items?.[0]?.snippet

    if (!video) {
      return null
    }

    return {
      title: video.title,
      description: video.description,
      channelTitle: video.channelTitle,
      thumbnailUrl: video.thumbnails?.high?.url || video.thumbnails?.medium?.url || null,
    }
  } catch (error) {
    console.log('YouTube Data API fetch error:', error)
    return null
  }
}

// Try to fetch Instagram post data via oEmbed
async function fetchInstagramOEmbed(url: string): Promise<OEmbedResponse | null> {
  try {
    const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}&omitscript=true`
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      console.log('oEmbed failed with status:', response.status)
      return null
    }

    return await response.json()
  } catch (error) {
    console.log('oEmbed fetch error:', error)
    return null
  }
}

// Extract caption from oEmbed HTML
function extractCaptionFromHtml(html: string): string {
  // The oEmbed HTML contains the caption in a blockquote
  // Try to extract text content
  const captionMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/)
  if (captionMatch) {
    // Remove HTML tags and decode entities
    return captionMatch[1]
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
  }
  return ''
}

// Fallback: Try to fetch page directly and extract data
async function fetchInstagramDirect(url: string): Promise<{ caption: string; imageUrl: string | null } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })

    if (!response.ok) {
      return null
    }

    const html = await response.text()

    // Try to extract from meta tags
    const descriptionMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/)
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/)

    const caption = descriptionMatch ? descriptionMatch[1] : ''
    const imageUrl = imageMatch ? imageMatch[1] : null

    if (caption) {
      return { caption, imageUrl }
    }

    return null
  } catch (error) {
    console.log('Direct fetch error:', error)
    return null
  }
}

// Determine URL type
function getUrlType(url: string): 'instagram' | 'youtube' | 'website' {
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  return 'website' // Any other URL is a recipe website
}

// Fetch and clean recipe from any website URL
async function fetchRecipeFromWebsite(url: string): Promise<{
  content: string
  title: string | null
  imageUrl: string | null
  siteName: string
} | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FridgeClue/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      console.log('Website fetch failed with status:', response.status)
      return null
    }

    const html = await response.text()

    // Extract metadata from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/)
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/)
    const ogSiteMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]*)"/)

    // Clean HTML: remove scripts, styles, nav, footer, ads
    const cleanedHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()

    // Get domain name for site reference
    let siteName = 'Unknown'
    try {
      const urlObj = new URL(url)
      siteName = ogSiteMatch?.[1] || urlObj.hostname.replace('www.', '')
    } catch {
      // Ignore URL parsing errors
    }

    return {
      content: cleanedHtml.slice(0, 20000), // Limit to 20k chars
      title: ogTitleMatch?.[1] || titleMatch?.[1] || null,
      imageUrl: ogImageMatch?.[1] || null,
      siteName,
    }
  } catch (error) {
    console.log('Website fetch error:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as RequestBody
    const { url, save = false } = body

    if (!url || url.trim().length === 0) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const urlType = getUrlType(url)

    // ==========================================
    // Handle YouTube URLs
    // ==========================================
    if (urlType === 'youtube') {
      const videoId = extractYouTubeVideoId(url)
      if (!videoId) {
        return NextResponse.json({ error: 'Could not extract YouTube video ID from URL' }, { status: 400 })
      }

      let title = ''
      let description = ''
      let channelName: string | null = null
      let thumbnailUrl: string | null = null

      // Try YouTube Data API first (if API key is available)
      const apiData = await fetchYouTubeDataAPI(videoId)
      if (apiData) {
        title = apiData.title
        description = apiData.description
        channelName = apiData.channelTitle
        thumbnailUrl = apiData.thumbnailUrl
      } else {
        // Fallback to oEmbed (limited data, no description)
        const oembedData = await fetchYouTubeOEmbed(url)
        if (oembedData) {
          title = oembedData.title || ''
          channelName = oembedData.author_name || null
          thumbnailUrl = oembedData.thumbnail_url || null
        }
      }

      if (!description) {
        return NextResponse.json({
          success: false,
          error: 'Could not fetch YouTube video description. Add YOUTUBE_API_KEY to your environment for full support.',
          suggestion: 'Try copying the recipe from the video description and using "Paste Recipe" instead.',
          has_api_key: !!process.env.YOUTUBE_API_KEY,
        }, { status: 400 })
      }

      // Use Gemini to extract recipe from description
      const parsedRecipe = await extractRecipeFromYouTube(description, title)

      if (!parsedRecipe.is_recipe) {
        return NextResponse.json({
          success: false,
          is_recipe: false,
          message: 'This YouTube video does not appear to contain a recipe in its description',
          video_title: title,
          parsed: parsedRecipe,
        })
      }

      // If save is true, store the recipe
      if (save) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: savedRecipe, error } = await (supabase as any)
          .from('saved_recipes')
          .insert({
            user_id: user.id,
            name: parsedRecipe.name,
            description: parsedRecipe.description,
            source_type: 'youtube',
            source_url: url,
            source_account: channelName,
            image_url: thumbnailUrl,
            ingredients: parsedRecipe.ingredients,
            instructions: parsedRecipe.instructions,
            estimated_time_minutes: parsedRecipe.estimated_time_minutes,
            servings: parsedRecipe.servings || 2,
            cuisine_type: parsedRecipe.cuisine_type,
            tags: parsedRecipe.tags,
            is_favorite: false,
            times_cooked: 0,
          })
          .select()
          .single()

        if (error) {
          console.error('Failed to save recipe:', error)
          return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          is_recipe: true,
          parsed: parsedRecipe,
          source: {
            type: 'youtube',
            url,
            author: channelName,
            image_url: thumbnailUrl,
            video_title: title,
          },
          saved: true,
          recipe: savedRecipe,
        })
      }

      // Return parsed recipe for preview
      return NextResponse.json({
        success: true,
        is_recipe: true,
        parsed: parsedRecipe,
        source: {
          type: 'youtube',
          url,
          author: channelName,
          image_url: thumbnailUrl,
          video_title: title,
        },
        saved: false,
      })
    }

    // ==========================================
    // Handle Instagram URLs
    // ==========================================
    if (urlType === 'instagram') {
      const postId = extractInstagramPostId(url)
      if (!postId) {
        return NextResponse.json({ error: 'Could not extract Instagram post ID from URL' }, { status: 400 })
      }

      let caption = ''
      let imageUrl: string | null = null
      let authorName: string | null = null

      // Try oEmbed first (most reliable for public posts)
      const oembedData = await fetchInstagramOEmbed(url)
      if (oembedData) {
        authorName = oembedData.author_name || null
        imageUrl = oembedData.thumbnail_url || null

        if (oembedData.html) {
          caption = extractCaptionFromHtml(oembedData.html)
        }
      }

      // Fallback to direct fetch if oEmbed didn't get caption
      if (!caption) {
        const directData = await fetchInstagramDirect(url)
        if (directData) {
          caption = directData.caption
          imageUrl = imageUrl || directData.imageUrl
        }
      }

      if (!caption) {
        return NextResponse.json({
          success: false,
          error: 'Could not fetch Instagram post content. The post may be private or unavailable.',
          suggestion: 'Try copying the caption text directly and using "Paste Recipe" instead.',
        }, { status: 400 })
      }

      // Use Gemini to extract recipe from caption
      const parsedRecipe = await extractRecipeFromInstagram(caption)

      if (!parsedRecipe.is_recipe) {
        return NextResponse.json({
          success: false,
          is_recipe: false,
          message: 'This Instagram post does not appear to contain a recipe',
          raw_caption: caption,
          parsed: parsedRecipe,
        })
      }

      // If save is true, store the recipe
      if (save) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: savedRecipe, error } = await (supabase as any)
          .from('saved_recipes')
          .insert({
            user_id: user.id,
            name: parsedRecipe.name,
            description: parsedRecipe.description,
            source_type: 'instagram',
            source_url: url,
            source_account: authorName,
            image_url: imageUrl,
            ingredients: parsedRecipe.ingredients,
            instructions: parsedRecipe.instructions,
            estimated_time_minutes: parsedRecipe.estimated_time_minutes,
            servings: parsedRecipe.servings || 2,
            cuisine_type: parsedRecipe.cuisine_type,
            tags: parsedRecipe.tags,
            is_favorite: false,
            times_cooked: 0,
          })
          .select()
          .single()

        if (error) {
          console.error('Failed to save recipe:', error)
          return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          is_recipe: true,
          parsed: parsedRecipe,
          source: {
            type: 'instagram',
            url,
            author: authorName,
            image_url: imageUrl,
          },
          saved: true,
          recipe: savedRecipe,
        })
      }

      // Return parsed recipe for preview
      return NextResponse.json({
        success: true,
        is_recipe: true,
        parsed: parsedRecipe,
        source: {
          type: 'instagram',
          url,
          author: authorName,
          image_url: imageUrl,
          raw_caption: caption,
        },
        saved: false,
      })
    }

    // ==========================================
    // Handle any recipe website URL
    // ==========================================
    if (urlType === 'website') {
      const websiteData = await fetchRecipeFromWebsite(url)

      if (!websiteData || !websiteData.content) {
        return NextResponse.json({
          success: false,
          error: 'Could not fetch recipe from this website. The page may be blocked or unavailable.',
          suggestion: 'Try copying the recipe text and using "Paste Recipe" instead.',
        }, { status: 400 })
      }

      // Use Gemini to extract recipe from the cleaned page content
      const { parseRecipeText } = await import('@/lib/gemini/recipes')
      const parsedRecipe = await parseRecipeText(websiteData.content)

      if (!parsedRecipe.is_recipe) {
        return NextResponse.json({
          success: false,
          is_recipe: false,
          message: 'This page does not appear to contain a recipe',
          page_title: websiteData.title,
          parsed: parsedRecipe,
        })
      }

      // Use the page title as recipe name if Gemini didn't extract one
      if (parsedRecipe.name === 'Untitled Recipe' && websiteData.title) {
        parsedRecipe.name = websiteData.title
          .replace(/ - .*$/, '') // Remove site name suffix
          .replace(/ \| .*$/, '')
          .trim()
      }

      // If save is true, store the recipe
      if (save) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: savedRecipe, error } = await (supabase as any)
          .from('saved_recipes')
          .insert({
            user_id: user.id,
            name: parsedRecipe.name,
            description: parsedRecipe.description,
            source_type: 'url',
            source_url: url,
            source_account: websiteData.siteName,
            image_url: websiteData.imageUrl,
            ingredients: parsedRecipe.ingredients,
            instructions: parsedRecipe.instructions,
            estimated_time_minutes: parsedRecipe.estimated_time_minutes,
            servings: parsedRecipe.servings || 2,
            cuisine_type: parsedRecipe.cuisine_type,
            tags: parsedRecipe.tags,
            is_favorite: false,
            times_cooked: 0,
          })
          .select()
          .single()

        if (error) {
          console.error('Failed to save recipe:', error)
          return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          is_recipe: true,
          parsed: parsedRecipe,
          source: {
            type: 'website',
            url,
            author: websiteData.siteName,
            image_url: websiteData.imageUrl,
            page_title: websiteData.title,
          },
          saved: true,
          recipe: savedRecipe,
        })
      }

      // Return parsed recipe for preview
      return NextResponse.json({
        success: true,
        is_recipe: true,
        parsed: parsedRecipe,
        source: {
          type: 'website',
          url,
          author: websiteData.siteName,
          image_url: websiteData.imageUrl,
          page_title: websiteData.title,
        },
        saved: false,
      })
    }

    // Fallback (shouldn't reach here)
    return NextResponse.json({
      error: 'Unsupported URL format.',
    }, { status: 400 })

  } catch (error) {
    console.error('Parse URL error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse URL' },
      { status: 500 }
    )
  }
}
