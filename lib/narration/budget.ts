/**
 * The narration time budget.
 *
 * A deck has a slot — "this is a 20-minute presentation" — and that slot has to
 * cover both the talking and the questions. Everything else in rung 2 is
 * downstream of this arithmetic: how long the script may be, when the
 * compressed variant takes over, and what the publisher is quoted to render.
 *
 * Deliberately pure and deliberately tiny. It is the one place the numbers are
 * decided, so the picker, the script drafter and the player cannot disagree
 * about how long a deck is allowed to speak for.
 */

/** Share of the slot held back for questions when the publisher hasn't chosen.
 *  PK's rule: a fifth of the time, whatever the length. */
export const DEFAULT_QA_RESERVE_RATIO = 0.2

/**
 * The compressed variant's share of the full script.
 *
 * Roughly half, which is what makes it a genuine fallback rather than a trim —
 * when questions have eaten the clock, shaving 10% off would not recover the
 * deck. Being able to finish in half the remaining time is what lets the
 * session say "let me bring this home" and mean it.
 */
export const COMPRESSED_RATIO = 0.55

/** No slot may reserve everything: a deck that never speaks is not a deck. */
export const MIN_NARRATION_MINUTES = 1

export interface NarrationBudget {
  /** The whole slot. */
  totalMinutes: number
  /** Held back for questions. */
  qaReserveMinutes: number
  /** What the full script has to fit inside. */
  narrationMinutes: number
  /** What the compressed variant should come to. */
  compressedMinutes: number
  /** True when the reserve was derived rather than chosen by the publisher. */
  reserveIsDefault: boolean
}

export function suggestedReserveMinutes(totalMinutes: number): number {
  if (!(totalMinutes > 0)) return 0
  // Rounded, not floored: a 15-minute slot suggests 3, not 2.
  return Math.max(1, Math.round(totalMinutes * DEFAULT_QA_RESERVE_RATIO))
}

/**
 * Resolve the budget.
 *
 * `qaReserveMinutes` null means "not chosen" and gets the 20% suggestion. A
 * chosen value is honoured as given, except that it can never consume the whole
 * slot — a publisher who types a reserve larger than the deck should still get
 * a deck, and clamping is friendlier than an error on a number they can see and
 * fix.
 */
export function resolveBudget(
  totalMinutes: number | null | undefined,
  qaReserveMinutes: number | null | undefined
): NarrationBudget | null {
  if (!totalMinutes || !(totalMinutes > 0)) return null

  const total = Math.round(totalMinutes)
  const chosen = typeof qaReserveMinutes === 'number' && Number.isFinite(qaReserveMinutes)
  const raw = chosen ? Math.round(qaReserveMinutes as number) : suggestedReserveMinutes(total)

  const reserve = Math.min(Math.max(0, raw), Math.max(0, total - MIN_NARRATION_MINUTES))
  const narration = Math.max(MIN_NARRATION_MINUTES, total - reserve)

  return {
    totalMinutes: total,
    qaReserveMinutes: reserve,
    narrationMinutes: narration,
    compressedMinutes: Math.max(1, Math.round(narration * COMPRESSED_RATIO * 10) / 10),
    reserveIsDefault: !chosen,
  }
}

/**
 * Words a script may run to for a given number of minutes.
 *
 * 140 wpm rather than a conversational 160: presentation narration carries
 * figures and proper nouns, which are read slower than prose, and a script that
 * overruns its slot is a worse failure than one that finishes early. The real
 * number replaces this the moment a segment is rendered and measured.
 */
export const NARRATION_WORDS_PER_MINUTE = 140

export function wordBudget(minutes: number): number {
  if (!(minutes > 0)) return 0
  return Math.round(minutes * NARRATION_WORDS_PER_MINUTE)
}
