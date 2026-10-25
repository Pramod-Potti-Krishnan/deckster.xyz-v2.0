// NEXT_PUBLIC_STUDIO_PASS3_POLISH (FRONTEND-2, Pass 3 polish set, PR B; the SAME flag as PR A: default off, exact "true", read at build time). Its only import is PR A's lib (the flag).
//
// PR B holds the finding #7 of the static audit (POLISH-AUDIT.md) that is reachable: the browser's native alert() in Studio flows. With the flag on, the viewer's "Failed to save changes" alert
// (components/presentation-viewer.tsx) and the two "Failed to create session" alerts (app/builder/page.tsx) are the Studio toast (hooks/use-toast, which both files already use), in plain words, and the
// code that follows is the same. (The viewer's discard-edits confirm is not here: handleCancelEdits has no caller at the dev head, so the dialog could never appear.)
// Flag off, none of it runs: every call site is behind STUDIO_PASS3_POLISH_B_ENABLED and the native calls stay exactly where they were.

import { STUDIO_PASS3_POLISH_ENABLED } from './studio-pass3-polish'

/**
 * PR A's flag rule (lib/studio-pass3-polish.ts): exact "true", read at build time (Next inlines NEXT_PUBLIC_ values), and only with the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL, exact "true"). PR B stacks on
 * PR A and uses ITS constant; the name below is only the alias the call sites in this PR already use, so that nothing else has to change.
 */
export const STUDIO_PASS3_POLISH_B_ENABLED = STUDIO_PASS3_POLISH_ENABLED

/**
 * The words, in plain language. The native messages they replace, so that a reader (and the proof) can see what each one says now:
 *   viewer save alert       "Failed to save changes. Please try again."
 *   builder alert 1         "Failed to create session. Please check your connection and try again."
 *   builder alert 2         "Failed to create session: <message>. Please try refreshing the page."
 */
export const STUDIO_POLISH_COPY = {
  saveFailed: { title: 'Your changes were not saved', description: 'Something went wrong while saving. Please try again.' },
  deckStartFailed: { title: 'Could not start your deck', description: 'Please check your connection and try again.' },
  deckStartError: { title: 'Could not start your deck' },
} as const

/** The description of the second builder alert: the error's own message (or "Unknown error", as before), then the same advice. */
export function deckStartErrorDescription(error: unknown): string {
  return `${error instanceof Error ? error.message : 'Unknown error'}. Please try refreshing the page.`
}
