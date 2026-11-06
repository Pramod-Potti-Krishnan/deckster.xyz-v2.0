/**
 * J2-F7 (R-20261007-frontend-11): after a synchronous Slide Composer insert the viewer lands on
 * slide 1 instead of the new slide.
 *
 * Why: a sync "built" result reloads the viewer iframe (new `sc_refresh` URL), which starts at
 * slide 1. The Studio then restores a selection only when it captured a native-order
 * `StudioComposeSelectionContext` at request start (`handleStudioSyncSelectionRequestStart`).
 * That capture returns null while the viewer is in edit mode or has unsaved changes
 * (`getStudioIntroductionSafety().dirty = nativeSnapshotDirty || isEditMode || saveStatus !== 'saved'`),
 * which is the state a manual Add leaves behind (J2 steps 2.1-2.5, then 2.6 Generate). With no
 * context, `restoreSelection` is false, nothing is selected after the reload and the viewer
 * stays on slide 1.
 *
 * With the flag on, that case gets one more step after the reload: read the viewer's native slide
 * order, find the inserted slide (by the result's real_slide_id when it has one, else by the
 * result's slide_index) and navigate to it through the existing verified go-to path.
 */
export const STUDIO_GOTO_NEW_SLIDE_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_GOTO_NEW_SLIDE_ENABLED === 'true'

export interface GoToNewSlideIntent {
  /** The inserted slide's Layout id when the compose result carried one. */
  slideId: string | null
  /** The compose result's slide_index (0-based, the insert acknowledgement). */
  slideIndex: number
}

/**
 * Arm the go-to only where nothing else will select the generated slide: the flag is on, this is a
 * compose (not refine) insert into the deck on stage, the panel draft was not changed while the
 * request ran, the identity restore has no context to run from, and the user did not move to a
 * different slide while the request was running.
 */
export function shouldArmGoToNewSlide(input: {
  enabled: boolean
  lane: 'compose' | 'refine'
  existingDeck: boolean
  draftStillCurrent: boolean
  restoreSelection: boolean
  startVisualIndex: number | undefined
  currentVisualIndex: number
}): boolean {
  return input.enabled
    && input.lane === 'compose'
    && input.existingDeck
    && input.draftStillCurrent
    && !input.restoreSelection
    && input.startVisualIndex !== undefined
    && input.startVisualIndex === input.currentVisualIndex
}

export function goToNewSlideIntent(result: {
  slide_index: unknown
  real_slide_id?: unknown
  slide_id?: unknown
}): GoToNewSlideIntent | null {
  const index = result.slide_index
  if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0) return null
  const id = result.real_slide_id ?? result.slide_id
  return { slideId: typeof id === 'string' && id.trim() && id === id.trim() ? id : null, slideIndex: index }
}

/**
 * Where to navigate, from the viewer's own native order. A result that names a slide id is only
 * honoured by that id (never by a stale position); a result with no id falls back to its
 * acknowledged index when the deck is long enough to contain it.
 */
export function resolveGoToNewSlideTarget(
  order: { nativeCount: number; slideIds: readonly string[] },
  intent: GoToNewSlideIntent,
): { visualIndex: number; by: 'identity' | 'index' } | null {
  if (intent.slideId) {
    const visualIndex = order.slideIds.indexOf(intent.slideId)
    return visualIndex >= 0 ? { visualIndex, by: 'identity' } : null
  }
  return intent.slideIndex < order.nativeCount ? { visualIndex: intent.slideIndex, by: 'index' } : null
}
