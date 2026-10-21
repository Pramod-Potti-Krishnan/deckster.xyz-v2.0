// PASS2D R1 (flag NEXT_PUBLIC_STUDIO_BLANK_DECK_LEGACY_ROWS, default off). Standalone and import-free: pure decisions only, no React, no clock, no network.
//
// Before #389 (NEXT_PUBLIC_STUDIO_BLANK_DECK_RELOAD_FIX) the Layout slide-count reconcile saved Director's untouched one-slide blank deck into the session row's FINAL slots as well as
// its blank slots (count 1, stage 0). On the next open the restore preferred the final slots, took the blank deck for a finished one, and the first-run welcome gave way to "What would you
// like to change? · 1 slide" over a bare navy slide (PASS2 re-score 1, follow-up 1). #389 stops writing such rows; it does not repair the ones already saved ("No repair of existing rows").
//
// This is the read-side repair, in memory only (an open writes nothing, see NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY): a row is the legacy blank-deck row when
//   - it has a blank deck (URL and id);
//   - its final slots hold that same deck (the id, or the URL, equal; neither may name another deck) and nothing else;
//   - it has no strawman, was never advanced past stage 0, and counts at most one slide.
// Such a row is restored as the blank deck it is: the final slots are read as empty. Any row that has real content in any other way (a strawman, a stage, a second slide, a final deck that is
// not the blank deck, no blank deck at all) is not touched.

/** Read as a literal so the Next build inlines it into client bundles. */
export const STUDIO_BLANK_DECK_LEGACY_ROWS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_BLANK_DECK_LEGACY_ROWS === 'true'

export interface LegacyBlankDeckRowInput {
  currentStage?: number | null
  slideCount?: number | null
  blankPresentationUrl?: string | null
  blankPresentationId?: string | null
  strawmanPreviewUrl?: string | null
  strawmanPresentationId?: string | null
  finalPresentationUrl?: string | null
  finalPresentationId?: string | null
}

const text = (value: unknown): string | null => typeof value === 'string' && value.trim() !== '' ? value : null

/** True for a row that holds Director's untouched blank deck in its final slots too. */
export function isLegacyBlankDeckRow(row: LegacyBlankDeckRowInput | null | undefined): boolean {
  if (!row || typeof row !== 'object') return false
  const blankUrl = text(row.blankPresentationUrl), blankId = text(row.blankPresentationId)
  if (!blankUrl || !blankId) return false
  if (text(row.strawmanPreviewUrl) || text(row.strawmanPresentationId)) return false
  const finalUrl = text(row.finalPresentationUrl), finalId = text(row.finalPresentationId)
  if (!finalUrl && !finalId) return false
  if (finalUrl && finalUrl !== blankUrl) return false
  if (finalId && finalId !== blankId) return false
  const stage = row.currentStage
  if (stage !== undefined && stage !== null && stage !== 0) return false
  const count = row.slideCount
  if (count !== undefined && count !== null && !(typeof count === 'number' && count >= 0 && count <= 1)) return false
  return true
}
