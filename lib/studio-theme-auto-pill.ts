// PASS2D (flag NEXT_PUBLIC_STUDIO_THEME_AUTO_NO_PILL, exact "true"; default off): the deck Theme dialog shows no "Applied" pill while the deck's theme is Auto.
//
// What the J4 run saw (PASS2-J4-FINDINGS item 4c, THEME-2 look-and-feel rank 4): the dialog header said "Applied" next to "Current theme Auto (Director's choice)",
// while the preview underneath said "there is nothing to preview yet". Nothing had been applied: Auto means Director picks when it builds. The pill is the page's
// theme-sync state (components/theme-panel.tsx SyncBadge), and an Auto deck reaches `applied` without the user doing anything (the restore of a never-picked session,
// the socket-ready sync of the Auto fingerprint), so the pill was true to the sync and wrong to the person.
//
// #405 already removed the composer's "Theme selected" chip for a never-picked session; this is the same rule for the dialog header. Only the `applied` pill is
// hidden, and only while the theme the deck has now is Auto: `syncing` and `failed` still show (they say something is happening or went wrong), a preset or custom
// theme still shows "Applied", and nothing about Apply, the draft or the payload changes.
//
// This file imports nothing, so a node test can load it on its own.

// Literal property access so Next inlines the value into the client bundle.
export const STUDIO_THEME_AUTO_NO_PILL_ENABLED = process.env.NEXT_PUBLIC_STUDIO_THEME_AUTO_NO_PILL === 'true'

/** True when the header must not draw the pill: the flag is on, the deck's current theme is Auto, and the sync state is `applied`. */
export function themeAppliedPillHidden(enabled: boolean, status: string, currentIsAuto: boolean): boolean {
  return enabled === true && currentIsAuto === true && status === 'applied'
}
