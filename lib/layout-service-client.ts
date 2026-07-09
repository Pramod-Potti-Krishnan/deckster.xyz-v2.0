/**
 * Layout Service Client
 *
 * Client for the Layout Service (v7.5) that handles slide operations.
 * This service manages slide CRUD operations, layout changes, and reordering.
 *
 * Aligned with SLIDE_TYPES.md documentation
 */

import { SlideLayoutType, SLIDE_LAYOUT_DEFAULTS } from '@/types/elements'
import { createLayoutViewerUrlPolicy } from '@/lib/layout-viewer-url-policy'

// Layout Service API Base URL
export const LAYOUT_SERVICE_URL = process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL || 'https://web-production-f0d13.up.railway.app'

export const LAYOUT_VIEWER_URL_POLICY = createLayoutViewerUrlPolicy(
  LAYOUT_SERVICE_URL,
  process.env.NEXT_PUBLIC_LAYOUT_VIEWER_ALLOWED_ORIGINS,
)

// ============================================================================
// TYPES
// ============================================================================

export interface LayoutServiceResponse {
  success: boolean
  message?: string
  slide_index?: number
  slide?: {
    layout: SlideLayoutType
    content: Record<string, unknown>
  }
  slide_count?: number
  detail?: string
  error?: {
    code: string
    message: string
  }
}

export interface AddSlideOptions {
  position?: number
  content?: Record<string, unknown>
  background_color?: string
  background_image?: string
}

export interface ChangeLayoutOptions {
  preserve_content?: boolean
  content_mapping?: Record<string, string>
}

// Slide-level narration fields (Script | Notes | References panel).
// All live at the slide top level on the Layout Service Slide model.
export interface SlideNarrationFields {
  script?: string
  speaker_notes?: string
  references?: string[]
}

// ============================================================================
// SLIDE OPERATIONS
// ============================================================================

/**
 * Add a new slide to a presentation
 *
 * @param presentationId - The presentation UUID
 * @param layout - The slide layout type (e.g., 'C1-text', 'H1-structured')
 * @param options - Optional parameters (position, content, background)
 * @returns Promise with the operation result
 *
 * @example
 * await addSlide('abc123', 'C1-text', {
 *   position: 2,
 *   content: { slide_title: 'My Title', body: '<p>Content</p>' }
 * })
 */
export async function addSlide(
  presentationId: string,
  layout: SlideLayoutType,
  options: AddSlideOptions = {}
): Promise<LayoutServiceResponse> {
  try {
    const response = await fetch(
      `${LAYOUT_SERVICE_URL}/api/presentations/${presentationId}/slides`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout,
          position: options.position,
          content: options.content || SLIDE_LAYOUT_DEFAULTS[layout],
          background_color: options.background_color,
          background_image: options.background_image,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorData.detail || `Request failed with status ${response.status}`,
        },
      }
    }

    return await response.json()
  } catch (error) {
    console.error('[LayoutService] addSlide failed:', error)
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    }
  }
}

/**
 * Delete a slide from a presentation
 *
 * @param presentationId - The presentation UUID
 * @param slideIndex - The 0-based index of the slide to delete
 * @returns Promise with the operation result
 *
 * @note Cannot delete the last remaining slide
 */
export async function deleteSlide(
  presentationId: string,
  slideIndex: number
): Promise<LayoutServiceResponse> {
  try {
    const response = await fetch(
      `${LAYOUT_SERVICE_URL}/api/presentations/${presentationId}/slides/${slideIndex}`,
      {
        method: 'DELETE',
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorData.detail || `Request failed with status ${response.status}`,
        },
      }
    }

    return await response.json()
  } catch (error) {
    console.error('[LayoutService] deleteSlide failed:', error)
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    }
  }
}

/**
 * Duplicate a slide in a presentation
 *
 * @param presentationId - The presentation UUID
 * @param slideIndex - The 0-based index of the slide to duplicate
 * @param insertAfter - Whether to insert after the source slide (default: true)
 * @returns Promise with the operation result
 */
export async function duplicateSlide(
  presentationId: string,
  slideIndex: number,
  insertAfter: boolean = true
): Promise<LayoutServiceResponse> {
  try {
    const response = await fetch(
      `${LAYOUT_SERVICE_URL}/api/presentations/${presentationId}/slides/${slideIndex}/duplicate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insert_after: insertAfter }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorData.detail || `Request failed with status ${response.status}`,
        },
      }
    }

    return await response.json()
  } catch (error) {
    console.error('[LayoutService] duplicateSlide failed:', error)
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    }
  }
}

/**
 * Reorder slides in a presentation
 *
 * @param presentationId - The presentation UUID
 * @param fromIndex - The current 0-based index of the slide
 * @param toIndex - The target 0-based index for the slide
 * @returns Promise with the operation result
 */
export async function reorderSlides(
  presentationId: string,
  fromIndex: number,
  toIndex: number
): Promise<LayoutServiceResponse> {
  try {
    const response = await fetch(
      `${LAYOUT_SERVICE_URL}/api/presentations/${presentationId}/slides/reorder`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_index: fromIndex,
          to_index: toIndex,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorData.detail || `Request failed with status ${response.status}`,
        },
      }
    }

    return await response.json()
  } catch (error) {
    console.error('[LayoutService] reorderSlides failed:', error)
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    }
  }
}

/**
 * Change the layout of an existing slide
 *
 * @param presentationId - The presentation UUID
 * @param slideIndex - The 0-based index of the slide
 * @param newLayout - The new layout type to apply
 * @param options - Optional parameters (preserve_content, content_mapping)
 * @returns Promise with the operation result
 */
export async function changeSlideLayout(
  presentationId: string,
  slideIndex: number,
  newLayout: SlideLayoutType,
  options: ChangeLayoutOptions = {}
): Promise<LayoutServiceResponse> {
  try {
    const response = await fetch(
      `${LAYOUT_SERVICE_URL}/api/presentations/${presentationId}/slides/${slideIndex}/layout`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_layout: newLayout,
          preserve_content: options.preserve_content ?? true,
          content_mapping: options.content_mapping,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorData.detail || `Request failed with status ${response.status}`,
        },
      }
    }

    return await response.json()
  } catch (error) {
    console.error('[LayoutService] changeSlideLayout failed:', error)
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    }
  }
}

/**
 * Update top-level fields of an existing slide (script, speaker notes, references)
 *
 * @param presentationId - The presentation UUID
 * @param slideIndex - The 0-based index of the slide
 * @param fields - Slide-level fields to update (script, speaker_notes, references)
 * @returns Promise with the operation result
 *
 * @note The Layout Service lifts these fields to the slide top level;
 *       anything else in the body would be treated as slide content.
 */
export async function updateSlideFields(
  presentationId: string,
  slideIndex: number,
  fields: SlideNarrationFields
): Promise<LayoutServiceResponse> {
  try {
    const response = await fetch(
      `${LAYOUT_SERVICE_URL}/api/presentations/${presentationId}/slides/${slideIndex}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorData.detail || `Request failed with status ${response.status}`,
        },
      }
    }

    return await response.json()
  } catch (error) {
    console.error('[LayoutService] updateSlideFields failed:', error)
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    }
  }
}

// Result of a concurrency-guarded narration PATCH.
export interface SlideNarrationUpdateResult {
  success: boolean
  /** HTTP status (200 on success, 409 on optimistic conflict) */
  status?: number
  /** deck updated_at echoed back on a 200 — thread this into the next save */
  updatedAt?: string
  /** deck updated_at the server currently holds, returned on a 409 */
  currentUpdatedAt?: string
  error?: {
    code: string
    message: string
  }
}

/**
 * Update a slide's narration (script / speaker_notes / references) by STABLE
 * slide_id, guarded by optimistic concurrency.
 *
 * PATCH /api/presentations/{id}/slides/{slide_id}/narration
 * Body: { script?, speaker_notes?, references?, expected_updated_at }
 *   - 200 { ok, updated_at }        — saved; updated_at advances
 *   - 409 { current_updated_at }    — the deck changed since the caller's read;
 *                                     the write was rejected to avoid a clobber
 *
 * `expected_updated_at` is REQUIRED — pass the deck updated_at captured from the
 * last authoritative GET (or the previous save's response).
 */
export async function updateSlideNarration(
  presentationId: string,
  slideId: string,
  fields: SlideNarrationFields,
  expectedUpdatedAt: string
): Promise<SlideNarrationUpdateResult> {
  try {
    const response = await fetch(
      `${LAYOUT_SERVICE_URL}/api/presentations/${presentationId}/slides/${encodeURIComponent(
        slideId
      )}/narration`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, expected_updated_at: expectedUpdatedAt }),
      }
    )

    if (response.status === 409) {
      const data = await response.json().catch(() => ({}))
      return {
        success: false,
        status: 409,
        currentUpdatedAt:
          typeof data?.current_updated_at === 'string' ? data.current_updated_at : undefined,
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        status: response.status,
        error: {
          code: `HTTP_${response.status}`,
          message: errorData.detail || `Request failed with status ${response.status}`,
        },
      }
    }

    const data = await response.json().catch(() => ({}))
    return {
      success: true,
      status: 200,
      updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : undefined,
    }
  } catch (error) {
    console.error('[LayoutService] updateSlideNarration failed:', error)
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    }
  }
}

// ============================================================================
// PRESENTATION OPERATIONS
// ============================================================================

/**
 * Get the full presentation JSON (title, slides[], theme, …)
 *
 * @param presentationId - The presentation UUID
 * @returns Promise with the presentation JSON, or null on failure
 */
export async function getPresentation(
  presentationId: string
): Promise<Record<string, any> | null> {
  try {
    const response = await fetch(
      `${LAYOUT_SERVICE_URL}/api/presentations/${presentationId}`,
      {
        method: 'GET',
      }
    )

    if (!response.ok) {
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('[LayoutService] getPresentation failed:', error)
    return null
  }
}

/**
 * Get the presentation viewer URL
 *
 * @param presentationId - The presentation UUID
 * @returns The URL to view the presentation
 */
export function getPresentationViewerUrl(presentationId: string): string {
  return `${LAYOUT_SERVICE_URL}/p/${presentationId}`
}

/**
 * List version history for a presentation
 *
 * @param presentationId - The presentation UUID
 * @returns Promise with version list
 */
export async function listVersions(
  presentationId: string
): Promise<LayoutServiceResponse & { versions?: Array<{ id: string; timestamp: string }> }> {
  try {
    const response = await fetch(
      `${LAYOUT_SERVICE_URL}/api/presentations/${presentationId}/versions`,
      {
        method: 'GET',
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorData.detail || `Request failed with status ${response.status}`,
        },
      }
    }

    return await response.json()
  } catch (error) {
    console.error('[LayoutService] listVersions failed:', error)
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    }
  }
}

/**
 * Restore a specific version of a presentation
 *
 * @param presentationId - The presentation UUID
 * @param versionId - The version ID to restore
 * @returns Promise with the operation result
 */
export async function restoreVersion(
  presentationId: string,
  versionId: string
): Promise<LayoutServiceResponse> {
  try {
    const response = await fetch(
      `${LAYOUT_SERVICE_URL}/api/presentations/${presentationId}/restore/${versionId}`,
      {
        method: 'POST',
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorData.detail || `Request failed with status ${response.status}`,
        },
      }
    }

    return await response.json()
  } catch (error) {
    console.error('[LayoutService] restoreVersion failed:', error)
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    }
  }
}

// ============================================================================
// UTILITY CLASS
// ============================================================================

/**
 * SlideManager class for managing slides in a presentation
 *
 * @example
 * const manager = new SlideManager('https://layout-service.com')
 * await manager.addSlide('presentation-uuid', 'C1-text', { position: 2 })
 */
export class SlideManager {
  private baseUrl: string

  constructor(baseUrl: string = LAYOUT_SERVICE_URL) {
    this.baseUrl = baseUrl
  }

  async addSlide(
    presentationId: string,
    layout: SlideLayoutType,
    options: AddSlideOptions = {}
  ): Promise<LayoutServiceResponse> {
    return addSlide(presentationId, layout, options)
  }

  async deleteSlide(
    presentationId: string,
    slideIndex: number
  ): Promise<LayoutServiceResponse> {
    return deleteSlide(presentationId, slideIndex)
  }

  async duplicateSlide(
    presentationId: string,
    slideIndex: number,
    insertAfter: boolean = true
  ): Promise<LayoutServiceResponse> {
    return duplicateSlide(presentationId, slideIndex, insertAfter)
  }

  async reorderSlides(
    presentationId: string,
    fromIndex: number,
    toIndex: number
  ): Promise<LayoutServiceResponse> {
    return reorderSlides(presentationId, fromIndex, toIndex)
  }

  async changeLayout(
    presentationId: string,
    slideIndex: number,
    newLayout: SlideLayoutType,
    options: ChangeLayoutOptions = {}
  ): Promise<LayoutServiceResponse> {
    return changeSlideLayout(presentationId, slideIndex, newLayout, options)
  }

  async updateSlideFields(
    presentationId: string,
    slideIndex: number,
    fields: SlideNarrationFields
  ): Promise<LayoutServiceResponse> {
    return updateSlideFields(presentationId, slideIndex, fields)
  }

  getViewerUrl(presentationId: string): string {
    return getPresentationViewerUrl(presentationId)
  }
}

// Export a default instance
export const slideManager = new SlideManager()
