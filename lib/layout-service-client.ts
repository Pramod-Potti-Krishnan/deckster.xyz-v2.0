/**
 * Layout Service Client
 *
 * Client for the Layout Service (v7.5) that handles slide operations.
 * This service manages slide CRUD operations, layout changes, and reordering.
 *
 * Aligned with SLIDE_TYPES.md documentation
 */

import { SlideLayoutType, SLIDE_LAYOUT_DEFAULTS } from '@/types/elements'

// Layout Service API Base URL
export const LAYOUT_SERVICE_URL = process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL || 'https://web-production-f0d13.up.railway.app'

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

// ============================================================================
// PRESENTATION OPERATIONS
// ============================================================================

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

  getViewerUrl(presentationId: string): string {
    return getPresentationViewerUrl(presentationId)
  }
}

// Export a default instance
export const slideManager = new SlideManager()
