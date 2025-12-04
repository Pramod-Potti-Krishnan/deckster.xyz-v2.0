/**
 * Elementor Client
 *
 * Client for the Visual Elements Orchestrator (Elementor) service.
 * Elementor generates AI content AND auto-injects it into Layout Service.
 * Frontend just needs to refresh the iframe after generation completes.
 *
 * Aligned with ELEMENTOR_FRONTEND_INTEGRATION_SPEC.md v1.0.0
 */

import {
  ChartType,
  ChartTheme,
  ChartDataFormat,
  DiagramType,
  DiagramStyle,
  DiagramDirection,
  InfographicType,
  InfographicColorScheme,
  InfographicIconStyle,
  ImageStyle,
  AspectRatio,
  ImageQuality,
  TextFormat,
  TextTone,
  BulletStyle,
  TableStyle,
  HeroType,
  HeroVisualStyle,
  SlideLayoutType,
} from '@/types/elements'

const ELEMENTOR_BASE_URL = process.env.NEXT_PUBLIC_ELEMENTOR_URL || 'https://web-production-3b42.up.railway.app'

export interface ElementorContext {
  presentation_id: string
  presentation_title: string
  slide_id: string
  slide_index: number
  slide_title?: string
}

export interface ElementorPosition {
  grid_row: string
  grid_column: string
}

export interface ElementorBaseRequest {
  element_id: string
  context: ElementorContext
  position: ElementorPosition
  prompt: string
}

export interface ElementorResponse {
  success: boolean
  element_id?: string
  injected?: boolean
  error?: {
    code: string
    message: string
  }
}

// ============================================================================
// CHART GENERATION (18 types)
// ============================================================================
export interface ChartRequest extends ElementorBaseRequest {
  chart_type?: ChartType
  theme?: ChartTheme
  data_format?: ChartDataFormat
  use_synthetic?: boolean
  palette?: string
}

export async function generateChart(params: ChartRequest): Promise<ElementorResponse> {
  return elementorRequest('/api/generate/chart', params)
}

// ============================================================================
// DIAGRAM GENERATION (34 types)
// ============================================================================
export interface DiagramRequest extends ElementorBaseRequest {
  diagram_type?: DiagramType
  style?: DiagramStyle
  primary_color?: string
  direction?: DiagramDirection
  theme?: string
}

export async function generateDiagram(params: DiagramRequest): Promise<ElementorResponse> {
  return elementorRequest('/api/generate/diagram', params)
}

// ============================================================================
// IMAGE GENERATION (5 styles, 5 ratios)
// ============================================================================
export interface ImageRequest extends ElementorBaseRequest {
  style?: ImageStyle
  aspect_ratio?: AspectRatio
  quality?: ImageQuality
  remove_background?: boolean
  negative_prompt?: string
}

export async function generateImage(params: ImageRequest): Promise<ElementorResponse> {
  return elementorRequest('/api/generate/image', params)
}

// ============================================================================
// INFOGRAPHIC GENERATION (14 types)
// ============================================================================
export interface InfographicRequest extends ElementorBaseRequest {
  infographic_type?: InfographicType
  item_count?: number
  color_scheme?: InfographicColorScheme
  icon_style?: InfographicIconStyle
  include_descriptions?: boolean
}

export async function generateInfographic(params: InfographicRequest): Promise<ElementorResponse> {
  return elementorRequest('/api/generate/infographic', params)
}

// ============================================================================
// TABLE GENERATION (6 styles)
// ============================================================================
export interface TableRequest extends ElementorBaseRequest {
  rows?: number
  columns?: number
  has_header?: boolean
  table_style?: TableStyle
}

export async function generateTable(params: TableRequest): Promise<ElementorResponse> {
  return elementorRequest('/api/generate/table', params)
}

// ============================================================================
// TEXT GENERATION (6 formats, 6 tones)
// ============================================================================
export interface TextRequest extends ElementorBaseRequest {
  format?: TextFormat
  tone?: TextTone
  bullet_style?: BulletStyle
  include_emoji?: boolean
  max_length?: number
}

export async function generateText(params: TextRequest): Promise<ElementorResponse> {
  return elementorRequest('/api/generate/text', params)
}

// ============================================================================
// HERO SLIDE GENERATION (Supports both legacy HeroType and new SlideLayoutType)
// ============================================================================

// Legacy HeroRequest for backward compatibility
export interface HeroRequest {
  context: ElementorContext
  prompt: string
  hero_type: HeroType
  visual_style?: HeroVisualStyle
}

// New SlideHeroRequest using SlideLayoutType
export interface SlideHeroRequest {
  context: ElementorContext
  prompt: string
  layout: SlideLayoutType  // H1-generated, H1-structured, H2-section, H3-closing
  visual_style?: HeroVisualStyle
}

// Map new SlideLayoutType to legacy HeroType for backend compatibility
function mapLayoutToHeroType(layout: SlideLayoutType): HeroType {
  switch (layout) {
    case 'H1-generated':
      return 'title_with_image' // AI-generated uses image variant
    case 'H1-structured':
      return 'title'
    case 'H2-section':
      return 'section'
    case 'H3-closing':
      return 'closing'
    default:
      return 'title'
  }
}

// Generate hero slide using legacy HeroType
export async function generateHero(params: HeroRequest): Promise<ElementorResponse> {
  return elementorRequest('/api/generate/hero', params as unknown as ElementorBaseRequest)
}

// Generate hero slide using new SlideLayoutType
export async function generateSlideHero(params: SlideHeroRequest): Promise<ElementorResponse> {
  // Map to legacy format for backend
  const legacyParams: HeroRequest = {
    context: params.context,
    prompt: params.prompt,
    hero_type: mapLayoutToHeroType(params.layout),
    visual_style: params.visual_style,
  }
  return elementorRequest('/api/generate/hero', legacyParams as unknown as ElementorBaseRequest)
}

// ============================================================================
// SLIDE BACKGROUND
// ============================================================================
export interface SlideBackgroundRequest {
  context: ElementorContext
  background_color?: string
  gradient?: string
  opacity?: number
}

export async function setSlideBackground(params: SlideBackgroundRequest): Promise<ElementorResponse> {
  return elementorRequest('/api/slide/background', params as unknown as ElementorBaseRequest)
}

// ============================================================================
// GENERIC REQUEST HANDLER
// ============================================================================
async function elementorRequest(endpoint: string, params: ElementorBaseRequest): Promise<ElementorResponse> {
  try {
    const response = await fetch(`${ELEMENTOR_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorData.error?.message || `Request failed with status ${response.status}`
        }
      }
    }

    return await response.json()
  } catch (error) {
    console.error('[Elementor] Request failed:', error)
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed'
      }
    }
  }
}

// ============================================================================
// ENDPOINT MAPPING FOR COMMAND ROUTING
// ============================================================================
export const ELEMENTOR_ENDPOINTS: Record<string, string> = {
  // Element generation
  'generateImage': '/api/generate/image',
  'generateChartData': '/api/generate/chart',
  'generateInfographic': '/api/generate/infographic',
  'generateDiagram': '/api/generate/diagram',
  'generateTableData': '/api/generate/table',
  'generateText': '/api/generate/text',
  // Hero/Slide generation (legacy and new)
  'generateHero': '/api/generate/hero',
  'generateHeroSlide': '/api/generate/hero',
  'generateSlideHero': '/api/generate/hero',
  'setSlideBackground': '/api/slide/background',
}

export function getElementorEndpoint(action: string): string | null {
  return ELEMENTOR_ENDPOINTS[action] || null
}

export { ELEMENTOR_BASE_URL }
