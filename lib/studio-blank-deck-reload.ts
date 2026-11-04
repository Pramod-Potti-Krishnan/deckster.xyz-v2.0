/**
 * MULTITAB J1 P1a: a reload at the outline-approval step left the canvas on "Loading your selected deck…" for good.
 *
 * Flag NEXT_PUBLIC_STUDIO_BLANK_DECK_RELOAD_FIX (exact "true", default off). Off, nothing here changes behaviour: the slot
 * helper returns exactly the fields the four inline branches wrote before, the write gate always says "save", and the page's
 * restore-commit effect and first-message flush return before doing anything.
 *
 * Cause (app/builder/page.tsx): the Layout slide-count reconcile effect read the untouched Director blank deck (one slide),
 * found 1 > (slideCount ?? 0), set a page-level override and saved the blank deck into the session's FINAL slots. On a reload
 * right after the first message, the session restore read the row before that write landed (no deck, no owner) while the
 * override survived as "the deck while Director has none" (lib/builder-presentation-ownership.ts): a selected deck with no
 * owner, which the canvas lifecycle shows as awaiting_owner forever. Later loads restored final = blank: the blank canvas
 * looked like a finished deck.
 *
 * On:
 *  1. deckSlotUpdates: a blank deck's slide-count write goes to the BLANK slots, never the final ones (all four page sites).
 *  2. shouldPersistLayoutCount: the reconcile never saves Director's untouched one-slide blank deck to the row (its display
 *     override is unchanged, so the canvas looks exactly as before).
 *  3. restoreOwnsOverride: when the session restore commits, an override it did not restore is retired.
 *  4. (page) the blank-deck metadata held while the session was unsaved is sent with the first-message save, so a reload
 *     restores the owned blank canvas.
 *
 * Pure policy only: no React, no network. The Next build inlines the flag below.
 */
import { presentationIdFromViewerUrl, type BuilderDeckVersion } from '@/lib/builder-presentation-ownership'

/** Read as a literal so the Next build inlines it into client bundles. */
export const STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED = process.env.NEXT_PUBLIC_STUDIO_BLANK_DECK_RELOAD_FIX === 'true'

/**
 * The session-row slots a slide-count write targets for the displayed deck version. Key order is the order the inline branches
 * assigned them (URL, then id), so the PATCH body is byte-identical with the flag off.
 *  - strawman                -> strawmanPreviewUrl / strawmanPresentationId (unchanged)
 *  - blank, flag on          -> blankPresentationUrl / blankPresentationId
 *  - anything else (flag off: blank included) -> finalPresentationUrl / finalPresentationId (unchanged)
 */
export function deckSlotUpdates<TUrl, TId>(
  enabled: boolean,
  activeVersion: BuilderDeckVersion | null | undefined,
  presentationUrl: TUrl,
  presentationId: TId,
):
  | { strawmanPreviewUrl: TUrl; strawmanPresentationId: TId }
  | { blankPresentationUrl: TUrl; blankPresentationId: TId }
  | { finalPresentationUrl: TUrl; finalPresentationId: TId } {
  if (activeVersion === 'strawman') return { strawmanPreviewUrl: presentationUrl, strawmanPresentationId: presentationId }
  if (enabled && activeVersion === 'blank') return { blankPresentationUrl: presentationUrl, blankPresentationId: presentationId }
  return { finalPresentationUrl: presentationUrl, finalPresentationId: presentationId }
}

/**
 * Whether the reconcile effect saves Layout's count to the session row. Flag off: always, as before. Flag on: never for Director's
 * untouched blank deck (a blank deck Layout reports with at most one slide: that slide is not "new slides", and the deck is not a
 * final deck); slides added on the blank canvas are saved (to the blank slots, see deckSlotUpdates). The override itself is set as
 * before, so what the canvas shows does not change.
 */
export function shouldPersistLayoutCount(
  enabled: boolean,
  activeVersion: BuilderDeckVersion | null | undefined,
  layoutSlideCount: number,
): boolean {
  return !(enabled && activeVersion === 'blank' && layoutSlideCount <= 1)
}

function identity(id: string | null | undefined, url: string | null | undefined): string | null {
  const trimmed = id?.trim()
  return trimmed || presentationIdFromViewerUrl(url)
}

/**
 * Whether the deck the session restore just committed owns a local override: only when the restore restored that same Layout
 * presentation. A restore with no deck owns no override (that override would be selected with no owner: awaiting_owner).
 */
export function restoreOwnsOverride(
  override: { presentationId: string | null; presentationUrl: string | null } | null,
  restored: { presentationId: string | null | undefined; presentationUrl: string | null | undefined },
): boolean {
  if (!override) return true
  const restoredIdentity = identity(restored.presentationId, restored.presentationUrl)
  return Boolean(restoredIdentity) && identity(override.presentationId, override.presentationUrl) === restoredIdentity
}
