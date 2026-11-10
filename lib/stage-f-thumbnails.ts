export type SlideThumbnailUrlsByIndex = Record<number, string>
export type SlideThumbnailUrlsByPresentation = Record<string, SlideThumbnailUrlsByIndex>

export const STAGE_F_THUMBNAIL_CACHE_VERSION = 1
export const STAGE_F_THUMBNAIL_CACHE_TTL = 24 * 60 * 60 * 1000
const MAX_CACHED_PRESENTATIONS = 32
const MAX_CACHED_THUMBNAILS = 500
const MAX_CACHED_URL_LENGTH = 8192
export const STAGE_F_THUMBNAIL_CACHE_MAX_BYTES = 512 * 1024

export interface StageFThumbnailCache {
  version: typeof STAGE_F_THUMBNAIL_CACHE_VERSION
  ownerUserId: string
  sessionId: string
  savedAt: number
  thumbnailUrlsByPresentation: SlideThumbnailUrlsByPresentation
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Optional tab cache for already received images, never an image-generation
 * source. Owner and session are checked in both the storage key and payload.
 */
export function stageFThumbnailCacheKey(ownerUserId: unknown, sessionId: unknown): string | null {
  const owner = normalizedPresentationId(ownerUserId)
  const session = normalizedPresentationId(sessionId)
  if (!owner || !session || session === 'new') return null
  return `deckster_stage_f_thumbnails_v1_${encodeURIComponent(owner)}:${encodeURIComponent(session)}`
}

function boundedThumbnailUrls(value: unknown): SlideThumbnailUrlsByPresentation {
  if (!record(value)) return {}
  const presentations: Array<[string, SlideThumbnailUrlsByIndex]> = []
  let count = 0
  // Bound optional storage without trimming/rekeying presentation identities.
  for (const [presentationId, candidate] of Object.entries(value)) {
    if (presentations.length >= MAX_CACHED_PRESENTATIONS || count >= MAX_CACHED_THUMBNAILS) break
    if (!presentationId || presentationId.trim() !== presentationId || !record(candidate)) continue
    const urls: Array<[number, string]> = []
    for (const [key, rawUrl] of Object.entries(candidate)) {
      if (count >= MAX_CACHED_THUMBNAILS) break
      if (!/^(0|[1-9]\d*)$/.test(key)) continue
      const index = Number(key)
      const url = normalizedUrl(rawUrl)
      if (!Number.isSafeInteger(index) || !url || url.length > MAX_CACHED_URL_LENGTH) continue
      // Object URLs die with the creating document; retaining one cannot
      // provide a preview after reload. Live rendering remains unaffected.
      if (/^blob:/i.test(url)) continue
      urls.push([index, url])
      count++
    }
    if (urls.length) presentations.push([presentationId, Object.fromEntries(urls)])
  }
  return Object.fromEntries(presentations)
}

export function createStageFThumbnailCache(
  thumbnails: SlideThumbnailUrlsByPresentation,
  ownerUserId: unknown,
  sessionId: unknown,
  now = Date.now(),
): StageFThumbnailCache | null {
  if (!stageFThumbnailCacheKey(ownerUserId, sessionId) || !Number.isFinite(now) || now < 0) return null
  const cache: StageFThumbnailCache = {
    version: STAGE_F_THUMBNAIL_CACHE_VERSION,
    ownerUserId: normalizedPresentationId(ownerUserId)!,
    sessionId: normalizedPresentationId(sessionId)!,
    savedAt: now,
    thumbnailUrlsByPresentation: boundedThumbnailUrls(thumbnails),
  }
  if (!Object.keys(cache.thumbnailUrlsByPresentation).length) return null
  // Storage is optional. An oversized snapshot is unavailable; callers clear
  // it rather than retaining an older mapping. The live map is unaffected.
  return JSON.stringify(cache).length * 2 <= STAGE_F_THUMBNAIL_CACHE_MAX_BYTES ? cache : null
}

export function restoreStageFThumbnailCache(
  cached: unknown,
  ownerUserId: unknown,
  sessionId: unknown,
  now = Date.now(),
): SlideThumbnailUrlsByPresentation {
  if (!stageFThumbnailCacheKey(ownerUserId, sessionId) || !record(cached)) return {}
  if (cached.version !== STAGE_F_THUMBNAIL_CACHE_VERSION
    || cached.ownerUserId !== normalizedPresentationId(ownerUserId)
    || cached.sessionId !== normalizedPresentationId(sessionId)
    || typeof cached.savedAt !== 'number'
    || !Number.isFinite(cached.savedAt)
    || !Number.isFinite(now)
    || cached.savedAt < 0
    || now < cached.savedAt
    || now - cached.savedAt > STAGE_F_THUMBNAIL_CACHE_TTL) return {}
  const thumbnails = boundedThumbnailUrls(cached.thumbnailUrlsByPresentation)
  return JSON.stringify(thumbnails).length * 2 <= STAGE_F_THUMBNAIL_CACHE_MAX_BYTES ? thumbnails : {}
}

/** Restored images can fill missing entries; admitted live frames win. */
export function mergeRestoredStageFThumbnailUrls(
  restored: SlideThumbnailUrlsByPresentation,
  live: SlideThumbnailUrlsByPresentation,
): SlideThumbnailUrlsByPresentation {
  const presentations = new Set([...Object.keys(restored), ...Object.keys(live)])
  return Object.fromEntries(Array.from(presentations, presentationId => [
    presentationId,
    { ...restored[presentationId], ...live[presentationId] },
  ]))
}

const STABLE_SLIDE_INDEX_KEYS = [
  'actualSlideIndex',
  'actual_slide_index',
  'insertedAtIndex',
  'inserted_at_index',
  'slideIndex',
  'slide_index',
  'layoutIndex',
  'layout_index',
] as const

function normalizedSlideIndex(value: unknown): number | null {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 0) return null
  return numeric
}

function normalizedUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function mergeStageFThumbnailUrl(
  current: SlideThumbnailUrlsByIndex,
  slideIndex: unknown,
  thumbnailUrl: unknown,
): SlideThumbnailUrlsByIndex {
  const index = normalizedSlideIndex(slideIndex)
  const url = normalizedUrl(thumbnailUrl)
  if (index === null || url === null) return current
  if (current[index] === url) return current
  return { ...current, [index]: url }
}

function normalizedPresentationId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Optional restored image metadata must declare the presentation it depicts.
 * Session slideStructure is shared by Final/Strawman/Custom and cannot by
 * itself establish image ownership. Live StageF images remain authoritative.
 */
export function ownedRestoredThumbnailUrl(
  slide: Record<string, unknown>,
  presentationId: unknown,
): string | undefined {
  const presentation = normalizedPresentationId(presentationId)
  const owner = normalizedPresentationId(slide.thumbnail_presentation_id)
  if (!presentation || owner !== presentation) return undefined
  return normalizedUrl(slide.thumbnail_url ?? slide.thumbnailUrl) ?? undefined
}

export function mergeStageFPresentationThumbnailUrl(
  current: SlideThumbnailUrlsByPresentation,
  presentationId: unknown,
  slideIndex: unknown,
  thumbnailUrl: unknown,
): SlideThumbnailUrlsByPresentation {
  const presentation = normalizedPresentationId(presentationId)
  if (presentation === null) return current
  const previous = current[presentation] ?? {}
  const next = mergeStageFThumbnailUrl(previous, slideIndex, thumbnailUrl)
  if (next === previous) return current
  return { ...current, [presentation]: next }
}

export function mergeStageFInsertedThumbnailUrl(
  current: SlideThumbnailUrlsByPresentation,
  presentationId: unknown,
  insertedSlideIndex: unknown,
  thumbnailUrl: unknown,
): SlideThumbnailUrlsByPresentation {
  const presentation = normalizedPresentationId(presentationId)
  const insertedIndex = normalizedSlideIndex(insertedSlideIndex)
  if (presentation === null || insertedIndex === null) return current

  const existing = current[presentation] ?? {}
  const url = normalizedUrl(thumbnailUrl)
  if (url !== null && existing[insertedIndex] === url) return current

  const shifted: SlideThumbnailUrlsByIndex = {}
  for (const [rawIndex, existingUrl] of Object.entries(existing)) {
    const index = normalizedSlideIndex(rawIndex)
    if (index === null) continue
    shifted[index >= insertedIndex ? index + 1 : index] = existingUrl
  }
  if (url !== null) shifted[insertedIndex] = url
  return { ...current, [presentation]: shifted }
}

/** Native slide_ready distinguishes replacement (refine) from insertion. */
export function mergeStageFReadyThumbnailUrl(
  current: SlideThumbnailUrlsByPresentation,
  presentationId: unknown,
  slideIndex: unknown,
  thumbnailUrl: unknown,
  kind: 'compose' | 'refine' = 'compose',
): SlideThumbnailUrlsByPresentation {
  if (kind !== 'refine') return mergeStageFInsertedThumbnailUrl(current, presentationId, slideIndex, thumbnailUrl)
  if (normalizedUrl(thumbnailUrl)) return mergeStageFPresentationThumbnailUrl(current, presentationId, slideIndex, thumbnailUrl)
  // A confirmed replacement without a new image must not keep the image of
  // the old slide. Other indices still depict the same unchanged slides.
  const presentation = normalizedPresentationId(presentationId)
  const index = normalizedSlideIndex(slideIndex)
  if (!presentation || index === null || !Object.prototype.hasOwnProperty.call(current[presentation] ?? {}, index)) return current
  const unchanged = { ...current[presentation] }
  delete unchanged[index]
  return { ...current, [presentation]: unchanged }
}

function thumbnailLookupIndex(slide: object, fallbackIndex: number): number {
  const candidate = slide as Record<string, unknown>
  for (const key of STABLE_SLIDE_INDEX_KEYS) {
    const index = normalizedSlideIndex(candidate[key])
    if (index !== null) return index
  }
  return fallbackIndex
}

export function applyStageFThumbnailUrls<T extends object>(
  slides: T[],
  thumbnailUrlsBySlide: SlideThumbnailUrlsByIndex,
): Array<T & { thumbnailUrl?: string }> {
  if (Object.keys(thumbnailUrlsBySlide).length === 0) return slides
  return slides.map((slide, index) => {
    const thumbnailUrl = thumbnailUrlsBySlide[thumbnailLookupIndex(slide, index)]
    return thumbnailUrl ? { ...slide, thumbnailUrl } : slide
  })
}
