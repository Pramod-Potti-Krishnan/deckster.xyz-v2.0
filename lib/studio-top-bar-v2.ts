// PASS2-PK-FOUR #1: the Studio builder top bar as in the accepted mockup (sidebar toggle, "Workspace / <deck name>" breadcrumb and
// saved status on the left; "+ New deck", "Export" menu and Publish on the right).
// Flag NEXT_PUBLIC_STUDIO_TOP_BAR_V2: exact "true", Studio shell only (NEXT_PUBLIC_STUDIO_V4_SHELL), default off. Off: the top bar
// is exactly as before and nothing here is read.
export const STUDIO_TOP_BAR_V2_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TOP_BAR_V2 === 'true'

/** The deck's existing save state as the viewer already tracks it (Layout autosave `saveStatusChanged` messages and the
 *  viewer's own force save), or null while no settled deck is on stage. */
export type StudioDeckSaveState = 'saved' | 'saving' | 'unsaved' | 'error' | null

// A read-only mirror of the viewer's state for the top bar, which renders in another subtree. No save, retry or request
// logic lives here: the viewer publishes what it already knows and the top bar only reads it.
let current: StudioDeckSaveState = null
const listeners = new Set<() => void>()

export function publishStudioDeckSaveState(next: StudioDeckSaveState): void {
  if (next === current) return
  current = next
  listeners.forEach(listener => listener())
}

export function subscribeStudioDeckSaveState(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getStudioDeckSaveState(): StudioDeckSaveState {
  return current
}

/** The top bar says "Saved" only when the viewer reports the deck saved. Saving, unsaved and failed saves keep showing
 *  where they always did (the toolbar's save control, with its "save now" action), so the top bar shows nothing then. */
export function studioTopBarSavedLabel(state: StudioDeckSaveState): 'Saved' | null {
  return state === 'saved' ? 'Saved' : null
}
