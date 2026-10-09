// J2 v2, DEC-P5: NON-DESTRUCTIVE regenerate, scaffolded behind the option id `regenerate` (opt-in: off unless
// NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED_OPTIONS names it; see lib/studio-add-slide-v2.ts).
//
// The Add Slide panel does not offer regenerate-in-place yet; the existing Refine (slide thumbnail menu, page
// handleOpenSlideRefine -> /api/slides/refine) is the live path and already replaces only after the new slide
// exists. This module is the rule any regenerate offered from the panel must follow, pure so it is testable:
//
//   - the old slide stays, untouched, while the new one is building (an overlay marks it, nothing is removed);
//   - the old slide may be deleted ONLY after the new one is ready, and the new one then takes its place;
//   - a failed run keeps the old slide exactly as it was and says why.
//
// Import-free on purpose (node-testable).

export type AddSlideV2RegenerateState =
  | { status: 'idle' }
  | { status: 'building'; jobId: string; oldSlideId: string }
  | { status: 'ready'; jobId: string; oldSlideId: string; newSlideId: string }
  | { status: 'failed'; jobId: string; oldSlideId: string; message: string }

export type AddSlideV2RegenerateAction =
  | { type: 'start'; jobId: string; oldSlideId: string }
  | { type: 'ready'; jobId: string; newSlideId: string }
  | { type: 'fail'; jobId: string; message: string }
  | { type: 'dismiss' }

export const ADD_SLIDE_V2_REGENERATE_IDLE: AddSlideV2RegenerateState = { status: 'idle' }

export function reduceAddSlideV2Regenerate(
  state: AddSlideV2RegenerateState,
  action: AddSlideV2RegenerateAction,
): AddSlideV2RegenerateState {
  switch (action.type) {
    case 'start':
      // One run at a time: a second start never replaces a building one.
      if (state.status === 'building' || !action.jobId || !action.oldSlideId) return state
      return { status: 'building', jobId: action.jobId, oldSlideId: action.oldSlideId }
    case 'ready':
      // Only the running job can finish it, and the new slide must be a different, real slide.
      if (state.status !== 'building' || state.jobId !== action.jobId) return state
      if (!action.newSlideId || action.newSlideId === state.oldSlideId) return state
      return { status: 'ready', jobId: state.jobId, oldSlideId: state.oldSlideId, newSlideId: action.newSlideId }
    case 'fail':
      if (state.status !== 'building' || state.jobId !== action.jobId) return state
      return { status: 'failed', jobId: state.jobId, oldSlideId: state.oldSlideId, message: action.message || 'The slide could not be regenerated.' }
    case 'dismiss':
      return state.status === 'ready' || state.status === 'failed' ? ADD_SLIDE_V2_REGENERATE_IDLE : state
    default:
      return state
  }
}

/** The old slide may be removed only once the new one is ready. */
export function mayDeleteOldSlide(state: AddSlideV2RegenerateState): boolean {
  return state.status === 'ready'
}

/** The slide the overlay sits on while a run is building. */
export function overlaySlideId(state: AddSlideV2RegenerateState): string | null {
  return state.status === 'building' ? state.oldSlideId : null
}

/**
 * The deck order after the run. Building or failed: unchanged, nothing deleted. Ready: the new slide takes the
 * old slide's place and only then is the old one deleted (a ready state whose slides are not both in the deck
 * changes nothing).
 */
export function planAddSlideV2RegenerateSwap(
  slideIds: ReadonlyArray<string>,
  state: AddSlideV2RegenerateState,
): { order: string[]; deleteIds: string[] } {
  const unchanged = { order: [...slideIds], deleteIds: [] as string[] }
  if (state.status !== 'ready') return unchanged
  const oldIndex = slideIds.indexOf(state.oldSlideId)
  if (oldIndex < 0 || !slideIds.includes(state.newSlideId)) return unchanged
  const order = slideIds.filter(id => id !== state.newSlideId)
  order.splice(order.indexOf(state.oldSlideId), 1, state.newSlideId)
  return { order, deleteIds: [state.oldSlideId] }
}
