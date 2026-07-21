import type { TextLabsComponentType } from '@/types/textlabs'

interface BlankElementRequestLike {
  elementId: string
  componentType?: string
  elementType?: string
  isBlank?: boolean
  content?: unknown
}

function hasMatchingPlaceholderMarker(content: unknown, elementId: string): boolean {
  if (typeof content !== 'string') return false
  const escapedId = elementId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`data-blank-element=(?:"|')${escapedId}(?:"|')`, 'i').test(content)
}

/**
 * Layout's legacy text renderer used empty textContent as a blank heuristic,
 * which misclassified completed SVG icons and shapes. Frontend placeholder
 * tracking (or the explicit placeholder marker after a reload) is the
 * authoritative signal; `isBlank` alone is deliberately insufficient.
 */
export function shouldOpenAsBlankPlaceholder(
  payload: BlankElementRequestLike,
  trackedComponentType?: TextLabsComponentType | null,
): boolean {
  if (trackedComponentType) return true
  return Boolean(payload.isBlank && hasMatchingPlaceholderMarker(payload.content, payload.elementId))
}
