// PASS2 POLISH PP-1..PP-8 (FRONTEND-1; ops/program/cards/FE-P2-POLISH-FROM-SHOTS.md): seven gaps seen in the mock | before | after shots of the merged Pass 2 pages, and PP-8 (PK's note on the account menu).
// ONE flag, NEXT_PUBLIC_STUDIO_P2_POLISH: exact "true", default off. Every fix also needs its page's own Pass 2 flag, so with this flag on and a page's flag off that page is untouched.
//   PP-1  Publish   the wizard's "What viewers get" panel is no longer clipped under the sticky footer: the step body and the panel scroll in the room between the steps and the footer
//   PP-2  Publish   "View as a viewer" is the shell's action colour (--ss-action), not the violet primary the anchor fell back to
//   PP-3  Publish   the manage view ends with the mock's Done button (it closes the dialog the way the X does)
//   PP-4  Landing   the open phone menu is a sheet under the header on phones (and dims the page behind it) instead of a card over the headline
//   PP-5  Intelligence  the model comparison's note is no longer cut mid-line above "Use this model": the panel scrolls above the button
//   PP-6  Profile menu  a failed (or unreadable) quota read keeps the plan badge (the session's tier) and says "Usage unavailable" instead of showing nothing
//   PP-7  Intelligence  "Managed by Deckster" is four columns from 1200px, as in the mock
//   PP-8  Profile menu  the vertical rhythm is tighter: 32px rows (were 38), 8px between sections with ONE hairline (were three), a tighter capacity card; the menu is 540px tall, was 640 (the Appearance control is untouched)
// Import-free on purpose, so scripts/test-studio-p2-polish.mjs can run the real file in a bare vm.

/** Exact "true" turns it on ("false", "TRUE", " true", "1" and unset are off). Next inlines the read at build time. This is the flag alone: each fix is also gated by its page's own Pass 2 flag,
 *  either because the component that holds it is only mounted with that flag on (the landing menu, the Intelligence chooser, the Pass 2 account menu) or because the use site combines the two
 *  (the publish wizard and dialog: the page flag AND this one). */
export const STUDIO_P2_POLISH_ENABLED = process.env.NEXT_PUBLIC_STUDIO_P2_POLISH === 'true'

/** The marker every polish rule of the stylesheets is scoped to; it is rendered only with the page's polish constant on. */
export const STUDIO_P2_POLISH_ATTR = 'data-p2-polish'

// ---- PP-6: the plan badge without the quota read, and the card's words when the read gave nothing ---------------------------------------------

/** The labels of lib/quota/quota.ts TIER_LABELS (server code that reaches the database, so not imported here); scripts/test-studio-p2-polish.mjs holds the two equal. */
export const POLISH_TIER_LABELS: Readonly<Record<string, string>> = { free: 'Free', starter: 'Starter', pro: 'Pro', premium: 'Max' }

/** The plan badge's text: the quota read's own label when it returned one, else the session's tier (the value /api/usage/quota itself reads), else nothing (no badge, nothing invented). */
export function polishTierLabel(quotaLabel: unknown, sessionTier: unknown): string | undefined {
  if (typeof quotaLabel === 'string' && quotaLabel.trim() !== '') return quotaLabel
  return typeof sessionTier === 'string' && Object.prototype.hasOwnProperty.call(POLISH_TIER_LABELS, sessionTier) ? POLISH_TIER_LABELS[sessionTier] : undefined
}

export const POLISH_USAGE_UNAVAILABLE = {
  line: 'Usage unavailable',
  hint: 'We could not read your usage just now. Open this menu again to retry.',
} as const

export type PolishUsageState = 'meters' | 'unavailable' | 'pending'

/** What the capacity card shows. `meters` is how many readable shares the read had; `hasQuota` that a read returned a body; `failed` that the last read errored (or answered with an error status).
 *  Readable shares always win; no shares and a read that returned or failed is "unavailable"; no read yet is "pending" (nothing, as the menu has always done while it waits). */
export function polishUsageState(input: { meters: number; hasQuota: boolean; failed: boolean }): PolishUsageState {
  if (input.meters > 0) return 'meters'
  return input.hasQuota || input.failed ? 'unavailable' : 'pending'
}
