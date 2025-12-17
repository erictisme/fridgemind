import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseBulkRecipes } from '@/lib/gemini/recipes'

interface RequestBody {
  text?: string
  url?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as RequestBody
    const { text, url } = body

    let contentToParse = text || ''

    // If URL provided, fetch the page content
    if (url) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FridgeMind/1.0)',
          },
        })

        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 400 })
        }

        const html = await response.text()

        // Extract text content from HTML (basic extraction)
        // Remove script and style tags, then strip HTML tags
        contentToParse = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, '\n')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n\s*\n/g, '\n\n')
          .trim()
      } catch (err) {
        console.error('URL fetch error:', err)
        return NextResponse.json({ error: 'Failed to fetch URL content' }, { status: 400 })
      }
    }

    if (!contentToParse || contentToParse.trim().length === 0) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    }

    // Parse the content for multiple recipes
    const result = await parseBulkRecipes(contentToParse)

    if (result.recipes.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No recipes found in the content',
        recipes: [],
        total_found: 0,
      })
    }

    return NextResponse.json({
      success: true,
      recipes: result.recipes,
      total_found: result.total_found,
      confidence: result.confidence,
    })
  } catch (error) {
    console.error('Bulk recipe parse error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse recipes' },
      { status: 500 }
    )
  }
}
