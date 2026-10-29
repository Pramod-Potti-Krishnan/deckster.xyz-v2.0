/**
 * FRONTEND-2 (B46, 29 Oct; the Studio half of Layout MR !263, LAYOUT_SLIDES_PUT_STALE_GUARD_ENABLED): when Layout refuses a stale whole-deck save,
 * Studio shows its EXISTING "This deck was updated · Reload deck" notice instead of counting the refusal as this tab's own edit.
 *
 * Flag NEXT_PUBLIC_STUDIO_DECK_SAVE_REFUSED_NOTICE (exact "true", default off, build-time). Off, nothing here runs: the viewer's save-status handler is exactly
 * as before, no listener is added and no notice is raised.
 *
 * What Layout sends. With its flag on, a whole-deck save of a deck that changed on the server (Director's add / duplicate / delete / undo / refine) answers 409
 * DECK_CHANGED and stores nothing. The viewer's auto-save.js does not retry: it keeps the change pending and posts `saveStatusChanged` with status "error" and
 * `deckChanged: true` (the message reads "This deck was updated (DECK_CHANGED) Request reference: ..."). Once refused, every later status carries `deckChanged: true`
 * until Layout stores a save, so only the "error" status is the refusal itself; "unsaved" and "saving" are the user's own edit and stay as they are.
 *
 * What Studio did. components/presentation-viewer.tsx counted every non-"saved" status as this tab's own autosave (reportOwnDeckEdit: a 5 s quiet window in which
 * the deck-changed notice does not look), then set the save status to "error": a generic "Save failed". Nothing said the deck had moved on, and a Retry is refused again.
 *
 * What the flag does, in the viewer's handler: a status that is a refusal (isDeckSaveRefused) is NOT counted as an own edit and raises the notice instead
 * (reportDeckSaveRefused -> the notice hook -> the controller's noteSaveRefused -> the same notice a focus or visibility check raises: "This deck was updated" with
 * "Reload deck" and "Dismiss"). The save status is unchanged ("error": the header keeps its own save-failed wording). The pending change is never dropped: the viewer's
 * save status is "error", which the notice hook reads as unsaved edits, so Reload deck first asks "This tab has changes that are not saved yet. Reloading drops them."
 * with "Reload anyway" and "Keep editing"; nothing here reloads. No new string, no new request.
 *
 * It acts only with NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE (the notice exists) AND NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH (the notice's words by cause: without it every
 * notice that is not a reconnect says "This deck changed in another tab", which would be false here). With either off this flag does nothing at all and a refusal
 * is exactly what it is today.
 *
 * Import-free so scripts/test-studio-deck-save-refused-notice.mjs can run it under plain node. The Next build inlines the three flags.
 */

/** Read as literals so the Next build inlines them into client bundles. */
export const STUDIO_DECK_SAVE_REFUSED_NOTICE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_DECK_SAVE_REFUSED_NOTICE === 'true'
/** This flag, the notice and the notice's honest wording: one without the others does nothing. */
export const STUDIO_DECK_SAVE_REFUSED_ACTIVE = STUDIO_DECK_SAVE_REFUSED_NOTICE_ENABLED
  && process.env.NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE === 'true'
  && process.env.NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH === 'true'

/** Layout's refusal of a stale whole-deck save, as the viewer posts it: status "error" and `deckChanged: true`. Always false while the flag is not active. */
export function isDeckSaveRefused(data: unknown): boolean {
  if (!STUDIO_DECK_SAVE_REFUSED_ACTIVE) return false
  if (typeof data !== 'object' || data === null) return false
  const message = data as Record<string, unknown>
  return message.status === 'error' && message.deckChanged === true
}

// The viewer (components/presentation-viewer.tsx) sees the status; the notice hook owns the notice. Same bridge pattern as lib/studio-deck-changed-notice.ts.
type DeckSaveRefusedListener = () => void
const refusedListeners = new Set<DeckSaveRefusedListener>()

/** The notice hook subscribes. Not active: nothing is added. */
export function onDeckSaveRefused(listener: DeckSaveRefusedListener): () => void {
  if (!STUDIO_DECK_SAVE_REFUSED_ACTIVE) return () => {}
  refusedListeners.add(listener)
  return () => { refusedListeners.delete(listener) }
}

/** The viewer saw a refusal (isDeckSaveRefused). Returns at once while the flag is not active. */
export function reportDeckSaveRefused(): void {
  if (!STUDIO_DECK_SAVE_REFUSED_ACTIVE) return
  for (const listener of Array.from(refusedListeners)) {
    try { listener() } catch { /* a listener never breaks the caller */ }
  }
}
