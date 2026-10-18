// PASS2D W (flag NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560, default off; PK decision #6, 16 Oct). Standalone and import-free: pure decisions only, no React, no clock, no network.
//
// The first-run welcome is one centred column: the head, Director's greeting, the starters, the stage actions and the composer. Today the head and the
// starters are 620 px wide and the composer 668 px, so the column and the box under it do not line up, and the accepted v4 mockup's column is narrower.
// With the flag on every block of the column is 560 px (capped by the space there is). The widths themselves are CSS (components/builder/studio-first-run.css,
// rules keyed to the attribute below); this module only says whether the welcome carries the marker those rules need, so with the flag off the welcome's markup
// has no extra attribute at all.

/** The column width, in CSS pixels, that the marked welcome uses. The stylesheet's `560px` must stay equal to it (scripts/test-studio-welcome-width.mjs checks). */
export const STUDIO_WELCOME_WIDTH_PX = 560

/** The attribute the welcome head carries when the narrower column is on. */
export const STUDIO_WELCOME_WIDTH_ATTRIBUTE = 'data-studio-first-run-width'

/** Props to spread on the welcome head: the marker with the flag on, `{}` (no key at all) otherwise. Only the exact boolean `true` turns it on. */
export function studioWelcomeWidthProps(enabled: boolean): { 'data-studio-first-run-width'?: string } {
  return enabled === true ? { 'data-studio-first-run-width': String(STUDIO_WELCOME_WIDTH_PX) } : {}
}
