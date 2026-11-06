/**
 * REDEEM-V4 (FRONTEND-2, B60; FRONTEND-1's UX pass finding UX-15). Flag NEXT_PUBLIC_STUDIO_REDEEM_V4 (exact "true", build-time, default off).
 *
 * Off, nothing in this module is consulted and /redeem is exactly the page it was: the purple gradient, the old wordmark image and the purple button.
 * On, the page draws the same words, the same field and the same request in the Studio v4 frame instead (components/studio-redeem.tsx): the
 * shell's tokens (light and dark), the Studio brand tile with "Deckster", and the v4 primary button. Only the look changes.
 *
 * The page tests the flag itself, inline, around its import() (app/(auth)/redeem/page.tsx), because only a literal test lets the build drop the
 * view and its stylesheet when the flag is off (the 404 page does the same). This module is the one place that names and reads the flag; the proof
 * (scripts/test-studio-redeem-v4.mjs) pins the page's inline test to it.
 */

/** The environment variable that turns the Studio /redeem page on. */
export const STUDIO_REDEEM_V4_FLAG = 'NEXT_PUBLIC_STUDIO_REDEEM_V4'

/** Read as a literal so the Next build inlines it into client bundles. */
export const STUDIO_REDEEM_V4_ENABLED = process.env.NEXT_PUBLIC_STUDIO_REDEEM_V4 === 'true'

/** The same test on any environment object: exactly "true" turns it on; unset, "TRUE", "1", " true" and the rest stay off. */
export function studioRedeemV4Enabled(env: Record<string, string | undefined>): boolean {
  return env[STUDIO_REDEEM_V4_FLAG] === 'true'
}
