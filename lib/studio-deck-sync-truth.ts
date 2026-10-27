/**
 * FRONTEND-2 (B26, E2E-2's finding of 27 Oct, Studio dev): after chat deletes and a page reload, the Builder said "Slides 3" over a 2-slide
 * deck and drew "This deck changed in another tab" with no other tab open.
 *
 * Flag NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH (exact "true", default off, build-time). Off, nothing here changes anything: every call site keeps its
 * own original expression, and the controller deps below are never passed.
 *
 * Root cause (max-count, not the preview id): the number is only ever raised, and nothing writes a lower one after a chat delete.
 *   1. app/builder/page.tsx onSessionStateChange saves Math.max(Director's slide_count, the page's count) into the session row; a chat delete goes
 *      to Layout, never to the row, so the row keeps the build's count (3) and a reload restores it (use-builder-session -> restoreMessages).
 *   2. components/presentation-viewer.tsx's poll floors the viewer's own answer at max(totalSlides, slideCount prop): the iframe says "1 / 2", and the
 *      rail header and the footer, which read totalSlides / visualTotalSlides, keep the restored 3 (the viewer's `total`, never lowered).
 *   3. lib/studio-deck-changed-notice.ts compares Layout's inventory (2) with that inflated viewer count (3), and components/builder/
 *      studio-deck-changed-notice.tsx has one wording for a count found different on a focus or visibility check: "in another tab".
 * The rail list (2 thumbnails) and the notice read the same deck's inventory (effectivePresentationId = the final deck); the strawman preview
 * (3 slides, never changed, E2E-2's own reads of it) is not what any of the three shows.
 *
 * What the flag does (the viewer, the notice controller, the hook, the notice component and, for the session row, a few marked lines in the Builder page):
 *   - after each poll the viewer commits the count the viewer itself reports, unless a build is in progress (isGenerating, a partial artifact, which also carries the
 *     rail's mid-build plan, compose jobs) or the viewer is outside the Studio shell: there the grow-only floor stays, as a build adds slides one at a time
 *     and the viewer may report fewer than Director has built;
 *   - a difference found on a focus or visibility check within DIRECTOR_CHANGE_WINDOW_MS of a change announced on this tab (Director's
 *     deck_mutation reaches the page, which reports it; so does the tab's own viewer ack) refreshes the deck quietly when nothing is unsaved,
 *     and is never called "another tab";
 *   - a difference that is not explained that way is shown only if it is still there NOTICE_CONFIRM_DELAY_MS later (a viewer restored with an old count
 *     corrects itself on its first poll; the strip is for a deck that really differs), and reads "This deck was updated". "In another tab" stays for a
 *     message another tab sent on the BroadcastChannel; "while you were reconnecting" stays for a reconnect;
 *   - the SESSION ROW (the Decks page card and the session list read its slideCount): after a chat change to the deck (Director's deck_mutation, which an undo's deck_restored also
 *     arrives as) on a settled deck, the page writes the deck's real slide count (Layout's slide inventory, the read the rail list and the notice use) to the row through its
 *     existing session write (persistence.updateMetadata), instead of leaving the larger count the build wrote; a build in progress keeps today's rule (the row is raised only).
 *     See createSettledRowCountWriter below.
 *
 * Import-free so scripts/test-studio-deck-sync-truth.mjs can run it under plain node. The Next build inlines the flag.
 */

/** Read as a literal so the Next build inlines it into client bundles. */
export const STUDIO_DECK_SYNC_TRUTH_ENABLED = process.env.NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH === 'true'

/** A difference found this soon after a change was announced on this tab (Director's deck_mutation, or the tab's own viewer ack) is that change, not another tab's. */
export const DIRECTOR_CHANGE_WINDOW_MS = 15_000

/** A difference nobody announced is shown only if it is still there this long after it was found (longer than the viewer's 3 s poll, which corrects a restored count). */
export const NOTICE_CONFIRM_DELAY_MS = 4_000

/** The words of the notice for a difference nobody announced (a focus or visibility check). */
export const DECK_UPDATED_NOTICE_TEXT = 'This deck was updated'

function wholeCount(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(n) && Number.isInteger(n) && n >= 1 ? n : null
}

/** The slide count a viewer reply states (composeGetState: real_slide_count; getCurrentSlideInfo: total), or null when it states none. */
export function viewerRealCount(data: unknown): number | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  return wholeCount(record.real_slide_count) ?? wholeCount(record.total)
}

/**
 * The totals the viewer commits after each poll reply once the base code has committed its floored ones (the floor is max(totalSlides state, slideCount prop), so a count restored too
 * high never comes down). Flag on and no build in progress: the count the viewer itself reported, as both the real and the visual total (the visual one never below the reply's own).
 * null = leave the base's: a build is in progress, or the reply states no usable count.
 */
export function syncTruthSettledTotals(input: { data: unknown; resolvedVisualTotal: number; building: boolean }): { total: number; visualTotal: number } | null {
  if (input.building) return null
  const reported = viewerRealCount(input.data)
  if (reported === null) return null
  const visual = Number.isFinite(input.resolvedVisualTotal) ? Math.floor(input.resolvedVisualTotal) : 0
  return { total: reported, visualTotal: Math.max(visual, reported) }
}

/**
 * The words of the notice by what caused it. 'broadcast' = another tab sent a message on the BroadcastChannel (the one cause that IS another tab);
 * 'reconnect' = the socket reconnected; anything else = a focus or visibility check found the deck different and nobody announced it.
 */
export function deckChangedNoticeText(source: string): string {
  if (source === 'reconnect') return 'This deck changed while you were reconnecting'
  if (source === 'broadcast') return 'This deck changed in another tab'
  return DECK_UPDATED_NOTICE_TEXT
}

/** A deck on screen, as far as the row writer needs to know it (the page's slideComposerPresentationRef.current). */
export interface SettledRowCountDisplayed {
  presentationId: string | null
  activeVersion?: string | null
}

export interface SettledRowCountDeps {
  /** Layout's slide count for the deck (its slide inventory: the read the rail list and the deck-changed notice use), or null when Layout cannot answer. */
  readLayoutCount: (presentationId: string) => Promise<number | null>
  /** The deck on screen now. */
  getDisplayed: () => SettledRowCountDisplayed | null | undefined
  /** A build is in progress (the viewer's rule: outside the Studio shell, a build running, the partial artifact, template mode, compose jobs). Asked again after Layout answers. */
  isBuilding: () => boolean
  /** The page's existing session-row write (persistence.updateMetadata): the row's slideCount becomes `count`. */
  writeRowCount: (count: number) => void
}

/**
 * Returns persist(presentationId, ownerIsCurrent): writes the count Layout reports for the deck to the session row, and resolves with the count written, or null when nothing was written.
 * Nothing is written when a build is in progress (asked before and after Layout answers: the build's rule, a count that is only raised, stays), when the owner retired, when another deck
 * (or not the final deck) is on screen by then, when Layout cannot answer or reports no slides, or when a newer call has started (the newest call writes, whatever order Layout answers in).
 */
export function createSettledRowCountWriter(deps: SettledRowCountDeps) {
  let sequence = 0
  return async function persistSettledRowCount(presentationId: string, ownerIsCurrent: () => boolean): Promise<number | null> {
    const mine = ++sequence
    if (typeof presentationId !== 'string' || !presentationId || deps.isBuilding()) return null
    let layoutCount: number | null = null
    try { layoutCount = await deps.readLayoutCount(presentationId) } catch { return null }
    if (mine !== sequence || !ownerIsCurrent() || deps.isBuilding()) return null
    const displayed = deps.getDisplayed()
    if (!displayed || displayed.presentationId !== presentationId || displayed.activeVersion !== 'final') return null
    const count = wholeCount(layoutCount)
    if (count === null) return null
    deps.writeRowCount(count)
    return count
  }
}
