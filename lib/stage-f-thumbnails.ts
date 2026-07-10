export type SlideThumbnailUrlsByIndex = Record<number, string>
export type SlideThumbnailUrlsByPresentation = Record<string, SlideThumbnailUrlsByIndex>

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
