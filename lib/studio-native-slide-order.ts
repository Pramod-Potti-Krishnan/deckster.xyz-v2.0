export interface StudioNativeSlideOrder {
  nativeCount: number
  currentVisualIndex: number
  slideIds: string[]
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

/** Validates an identity-bearing receipt; does not prove its frame/owner or DOM scope. */
export function parseStudioNativeSlideOrder(receipt: unknown): StudioNativeSlideOrder | null {
  const value = record(receipt)
  if (!value || value.success !== true || value.action !== 'composeGetState'
    || !Number.isSafeInteger(value.real_slide_count) || (value.real_slide_count as number) < 1
    || value.visual_section_count !== value.real_slide_count
    || value.total_visual_sections !== value.real_slide_count
    || !Array.isArray(value.placeholders) || value.placeholders.length !== 0
    || value.current_placeholder_job_id !== null
    || !Number.isSafeInteger(value.current_visual_index) || (value.current_visual_index as number) < 0
    || (value.current_visual_index as number) >= (value.real_slide_count as number)
    || !Array.isArray(value.slides) || value.slides.length !== value.real_slide_count) return null

  const slideIds: string[] = []
  for (let index = 0; index < value.slides.length; index += 1) {
    const slide = record(value.slides[index])
    if (!slide || slide.visual_index !== index || slide.layout_index !== index
      || !validId(slide.slide_id)) return null
    slideIds.push(slide.slide_id)
  }
  if (new Set(slideIds).size !== slideIds.length) return null
  return { nativeCount: value.real_slide_count as number,
    currentVisualIndex: value.current_visual_index as number, slideIds }
}

/** Add-only identity match. A single null slot has no preview/title provenance. */
export function matchStudioNativeAddSlideOrder(
  mappedOldSlideIds: ReadonlyArray<string | null>,
  observed: StudioNativeSlideOrder,
): { slideIds: string[]; addedSlideId: string; addedVisualIndex: number } | null {
  if (!Array.isArray(mappedOldSlideIds) || mappedOldSlideIds.length < 2
    || !observed || !Array.isArray(observed.slideIds)
    || !Number.isSafeInteger(observed.nativeCount) || observed.nativeCount !== mappedOldSlideIds.length
    || observed.slideIds.length !== observed.nativeCount
    || !Number.isSafeInteger(observed.currentVisualIndex) || observed.currentVisualIndex < 0
    || observed.currentVisualIndex >= observed.nativeCount
    || !Array.from(observed.slideIds).every(validId)
    || new Set(observed.slideIds).size !== observed.slideIds.length) return null

  const addedSlots = mappedOldSlideIds.flatMap((id, index) => id === null ? [index] : [])
  if (addedSlots.length !== 1) return null
  for (let index = 0; index < mappedOldSlideIds.length; index += 1) {
    const oldId = mappedOldSlideIds[index]
    if (oldId !== null && (!validId(oldId) || oldId !== observed.slideIds[index])) return null
  }
  const addedVisualIndex = addedSlots[0]
  return { slideIds: [...observed.slideIds], addedSlideId: observed.slideIds[addedVisualIndex], addedVisualIndex }
}
