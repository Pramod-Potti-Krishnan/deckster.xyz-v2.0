/**
 * Studio v4 Count control: leave `count` out of the request until the user touches it
 * (J3.0 finding J3-F4). Pure helpers, no imports, no side effects.
 *
 * Context (J3.0, 7 Oct): the add-element panel's Count control (structured text box
 * and METRICS) defaults to 1 and the panel always sent `count`. Text Labs resolves
 * `request.count or <count stated in the prompt> or 1`, so the always-sent 1 beat
 * "Five rollout steps" (1 card, not 5) and "4 KPIs" (1 card, not 4). With this flag on,
 * a Count the user never touched is omitted from the request, so Text Labs uses the
 * number in the prompt (pairs with text-labs MR !70). A Count the user touched is sent
 * exactly as before, and so is every other field.
 *
 * Only the wire field changes. The form keeps count 1 locally, so compose, elements,
 * layout and the geometry preflight are exactly what an untouched Count produces today.
 * A plain body text box (structure Auto) keeps sending count 1: Text Labs' stated-count
 * logic reads its bullet count from the prompt and needs the panel's 1 to stay.
 * A refine is always a single element and keeps sending count 1.
 *
 * The flag is build-time: both public values are inlined into the client bundle, so
 * switching it needs a rebuild. Only the literal string "true" for BOTH turns the
 * feature on; anything else (including unset) is OFF.
 */

export function studioCountOmitUntouchedFlagOn(shell: string | undefined, flag: string | undefined): boolean {
  return shell === 'true' && flag === 'true'
}

/** Literal `process.env.NEXT_PUBLIC_*` reads so Next inlines them at build time. */
export const STUDIO_COUNT_OMIT_UNTOUCHED_ENABLED = studioCountOmitUntouchedFlagOn(
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL,
  process.env.NEXT_PUBLIC_STUDIO_COUNT_OMIT_UNTOUCHED_ENABLED,
)

export interface UntouchedCountInput {
  flagOn: boolean
  /** The user chose a Count (changed the control), or it was restored from a chosen one. */
  touched: boolean
  /** The count the form would send today (already 1 for roles that cannot repeat). */
  count: number
  /** The form is a kind whose count may come from the prompt: METRICS, or a structured body text box. */
  eligible: boolean
}

/** Mark the submitted form so the request leaves `count` out. Never for a touched Count or a count above 1. */
export function shouldOmitUntouchedCount(input: UntouchedCountInput): boolean {
  return input.flagOn && input.eligible && !input.touched && input.count === 1
}

/**
 * Was a Count restored from a draft or a saved generation config a chosen one?
 * An explicit mark wins; without one (older drafts and configs), any count above 1 was chosen.
 */
export function restoredCountTouched(count: number | null | undefined, mark: unknown): boolean {
  if (typeof mark === 'boolean') return mark
  return typeof count === 'number' && count > 1
}

/** Wire decision in `buildApiPayload`: only a flagged form's own mark, and never a refine. */
export function requestCountOmitted(
  flagOn: boolean,
  form: { countOmitted?: boolean; refine?: boolean },
): boolean {
  return flagOn && form.countOmitted === true && form.refine !== true
}
