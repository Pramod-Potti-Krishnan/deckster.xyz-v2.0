// NEXT_PUBLIC_STUDIO_PASS3_POLISH (FRONTEND-2, Pass 3 polish set, PR B; the SAME flag as PR A: default off, exact "true", read at build time). Import-free, so a plain-node test can load it.
//
// PR B holds the two findings of the static audit (POLISH-AUDIT.md) that change WORDS or SWAP A BROWSER DIALOG for the Studio shell's own:
//   #7  the browser's native confirm() / alert() in Studio flows: the viewer's "discard all changes" confirm and its "Failed to save changes" alert (components/presentation-viewer.tsx), and the two
//       "Failed to create session" alerts (app/builder/page.tsx). With the flag on they are the Studio dialog (components/studio-pass3-polish/studio-discard-edits-dialog.tsx, the same look as the
//       slide-delete dialog) and the Studio toast (hooks/use-toast, which both files already use). The behaviour is the same: a discard happens ONLY after a confirm.
//   #5  the Decks page's empty state still said "Complete a strawman preview ..." while the tab says "Outline previews": with this flag AND NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS on it says it in plain words.
// Flag off, none of it runs: every call site is behind STUDIO_PASS3_POLISH_B_ENABLED and the native calls stay exactly where they were.

/**
 * Exact "true" only, read at build time (Next inlines NEXT_PUBLIC_ values), and only with the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL, exact "true"): the same rule as PR A's STUDIO_PASS3_POLISH_ENABLED
 * (lib/studio-pass3-polish.ts). Defined here until PR A is merged; then this line becomes `export const STUDIO_PASS3_POLISH_B_ENABLED = STUDIO_PASS3_POLISH_ENABLED` (imported from PR A) and nothing else changes.
 */
export const STUDIO_PASS3_POLISH_B_ENABLED = process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

/**
 * The words, in plain language. The native messages they replace, so that a reader (and the proof) can see what each one says now:
 *   viewer discard confirm  "Are you sure you want to discard all changes?"
 *   viewer save alert       "Failed to save changes. Please try again."
 *   builder alert 1         "Failed to create session. Please check your connection and try again."
 *   builder alert 2         "Failed to create session: <message>. Please try refreshing the page."
 */
export const STUDIO_POLISH_COPY = {
  discard: { title: 'Discard all changes?', description: 'Your edits will be lost.', keep: 'Keep editing', confirm: 'Discard changes' },
  saveFailed: { title: 'Your changes were not saved', description: 'Something went wrong while saving. Please try again.' },
  deckStartFailed: { title: 'Could not start your deck', description: 'Please check your connection and try again.' },
  deckStartError: { title: 'Could not start your deck' },
} as const

/** The description of the second builder alert: the error's own message (or "Unknown error", as before), then the same advice. */
export function deckStartErrorDescription(error: unknown): string {
  return `${error instanceof Error ? error.message : 'Unknown error'}. Please try refreshing the page.`
}

/** The Decks page's empty state in plain words (audit #5): the heading and the sentence under it, for the "completed" tab and the second ("Outline previews") tab. */
export const STUDIO_DECKS_EMPTY_COPY = {
  completed: { title: 'No decks yet', description: 'Start a new deck and it will appear here.' },
  strawman: { title: 'No outline previews yet', description: 'Start a new deck to see its outline here.' },
} as const

/** The plain empty-state copy, or null (the page then says what it always said). Needs this flag AND the plain navigation labels (NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS), both read by the caller. */
export function studioDecksEmptyCopy(polish: boolean, plainNavLabels: boolean): typeof STUDIO_DECKS_EMPTY_COPY | null {
  return polish === true && plainNavLabels === true ? STUDIO_DECKS_EMPTY_COPY : null
}
