import { ownedRestoredThumbnailUrl, type SlideThumbnailUrlsByPresentation } from './stage-f-thumbnails'

/** Existing Final-deck metadata only. The active viewer version is deliberately
 * absent: Publish snapshots the session's Final deck even while viewing Custom
 * or Strawman. The caller must supply the owner of the held deck metadata. */
export interface StudioPublishPreviewSource {
  sessionId: string | null
  ownerSessionId: string | null
  finalPresentationId: string | null
  thumbnailUrlsByPresentation?: SlideThumbnailUrlsByPresentation
  thumbnailOwnerSessionId?: string | null
  firstSlide?: Record<string, unknown> | null
  loading?: boolean
}

export type StudioPublishPreview =
  | { status: 'ready'; ownerKey: string; thumbnailUrl: string }
  | { status: 'loading' | 'unavailable' }

function nonempty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isFirstSlide(slide: Record<string, unknown>): boolean {
  // Array order is the viewer's fallback only when no canonical index was
  // supplied. Contradictory or invalid explicit indices cannot depict slide 1.
  for (const field of ['actual_slide_index', 'real_slide_index', 'slide_index', 'actualSlideIndex', 'slideIndex']) {
    if (!Object.prototype.hasOwnProperty.call(slide, field)) continue
    const value = slide[field]
    if ((typeof value !== 'number' && typeof value !== 'string') || value === '' ||
        (typeof value === 'string' && !value.trim()) || Number(value) !== 0) return false
  }
  return true
}

/** No URL parsing, resource-id guessing or thumbnail generation. Live StageF
 * images are keyed by presentation; restored images must explicitly declare
 * that same presentation owner through the existing authoritative helper. */
export function resolveStudioPublishPreview(
  publishSessionId: string | null,
  source?: StudioPublishPreviewSource | null,
): StudioPublishPreview {
  const session = nonempty(publishSessionId)
  const sourceSession = nonempty(source?.sessionId)
  const ownerSession = nonempty(source?.ownerSessionId)
  const presentation = nonempty(source?.finalPresentationId)
  if (!session || sourceSession !== session || ownerSession !== session || !presentation) {
    return { status: 'unavailable' }
  }
  if (source?.loading) return { status: 'loading' }
  // Cache lineage is separate from the held deck owner: an old session
  // cache must never become a new session preview merely by retaining IDs.
  const liveUrl = nonempty(source?.thumbnailOwnerSessionId) === session
    ? nonempty(source?.thumbnailUrlsByPresentation?.[presentation]?.[0])
    : null
  const restoredUrl = source?.firstSlide && isFirstSlide(source.firstSlide)
    ? ownedRestoredThumbnailUrl(source.firstSlide, presentation)
    : undefined
  const thumbnailUrl = liveUrl ?? restoredUrl
  if (!thumbnailUrl) return { status: 'unavailable' }
  return { status: 'ready', ownerKey: JSON.stringify([session, presentation, 'final', thumbnailUrl]), thumbnailUrl }
}
