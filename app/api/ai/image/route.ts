import { NextRequest, NextResponse } from 'next/server'

/**
 * Mock AI Image Generation API
 *
 * TODO: Replace with actual AI image generation service
 * (DALL-E, Midjourney, Stable Diffusion, etc.)
 */

// Sample placeholder images based on style
const STYLE_IMAGES: Record<string, string> = {
  realistic: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop',
  illustration: 'https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=800&h=600&fit=crop',
  abstract: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&h=600&fit=crop',
  minimal: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop',
  photographic: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
}

// Fallback placeholder
const DEFAULT_PLACEHOLDER = 'https://placehold.co/800x600/3b82f6/white'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, style, aspectRatio, elementId } = body

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 800))

    // Get image based on style, or use placeholder with prompt text
    let imageUrl: string

    if (style && STYLE_IMAGES[style]) {
      imageUrl = STYLE_IMAGES[style]
    } else {
      // Generate placeholder with prompt text
      const text = encodeURIComponent(prompt.slice(0, 30))
      const [width, height] = getAspectRatioDimensions(aspectRatio || '16:9')
      imageUrl = `${DEFAULT_PLACEHOLDER}?text=${text}&font=roboto`
    }

    console.log(`[AI Image] Generated for prompt: "${prompt.slice(0, 50)}..."`)

    return NextResponse.json({
      success: true,
      result: {
        imageUrl,
        alt: prompt,
        prompt,
        style: style || 'default',
        aspectRatio: aspectRatio || '16:9'
      }
    })
  } catch (error) {
    console.error('[AI Image] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate image' },
      { status: 500 }
    )
  }
}

function getAspectRatioDimensions(ratio: string): [number, number] {
  switch (ratio) {
    case '16:9': return [800, 450]
    case '4:3': return [800, 600]
    case '1:1': return [600, 600]
    case '9:16': return [450, 800]
    default: return [800, 600]
  }
}
