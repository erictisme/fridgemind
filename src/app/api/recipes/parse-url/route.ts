import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractRecipeFromInstagram } from '@/lib/gemini/recipes'

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

// Extract Instagram post ID from URL
function extractInstagramPostId(url: string): string | null {
  // Match patterns like:
  // https://www.instagram.com/p/ABC123/
  // https://www.instagram.com/reel/ABC123/
  // https://instagram.com/p/ABC123
  const match = url.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/)
  return match ? match[1] : null
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

    // Validate it's an Instagram URL
    if (!url.includes('instagram.com')) {
      return NextResponse.json({ error: 'Please provide an Instagram URL' }, { status: 400 })
    }

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
        url,
        author: authorName,
        image_url: imageUrl,
        raw_caption: caption,
      },
      saved: false,
    })
  } catch (error) {
    console.error('Parse Instagram URL error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse Instagram URL' },
      { status: 500 }
    )
  }
}
