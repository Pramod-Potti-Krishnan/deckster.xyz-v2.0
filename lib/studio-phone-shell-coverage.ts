// STUDIO PHONE SHELL COVERAGE (FRONTEND-2; B58; FRONTEND-1's pre-promotion UX pass of 4 Nov, blockers UX-03 and UX-04). Flag NEXT_PUBLIC_STUDIO_PHONE_SHELL_COVERAGE (exact "true", default off, read at build time), only active together with the phone shell
// (NEXT_PUBLIC_STUDIO_PHONE_SHELL, exact "true") and so with the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL, exact "true"). Import-free: the flag. No I/O. lib/studio-phone-shell.ts is not edited: it is pinned.
//
// What the flag does on a phone (640 px and narrower): the two Studio pages that draw the desktop rail but not the phone shell's bottom tab bar draw the bar too, as a direct child of the page's shell root, next to the rail: Help
// (components/help/studio-help.tsx, signed in) and the Builder's "session not found / deleted / could not load" screen (components/builder/studio-session-hygiene.tsx). components/layout/studio-phone-shell.css then does the rest, as on every other page that
// holds the bar: the rail steps aside (its brand tile stays at the top left) and the page gets the bar's height of bottom room. Flag off, nothing here is drawn and the two files are their base, byte for byte.

/** Exact "true" for the flag AND the phone shell AND the Studio shell; anything else (unset, "false", "TRUE", " true", "1") is off. The caller passes the three `process.env` values (Next inlines them at build time). */
export function studioPhoneShellCoverageOn(flag: string | null | undefined, phoneShell: string | null | undefined, studioShell: string | null | undefined): boolean {
  return flag === 'true' && phoneShell === 'true' && studioShell === 'true'
}

/** The flag, resolved once at build time. Every element this change adds is drawn only when it is true. */
export const STUDIO_PHONE_SHELL_COVERAGE_ENABLED = studioPhoneShellCoverageOn(process.env.NEXT_PUBLIC_STUDIO_PHONE_SHELL_COVERAGE, process.env.NEXT_PUBLIC_STUDIO_PHONE_SHELL, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL)
