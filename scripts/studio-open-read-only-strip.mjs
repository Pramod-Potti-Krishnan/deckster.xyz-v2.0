// Studio session open read-only (flag NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY): the lines this change adds to app/builder/page.tsx, which other pins hold to a base commit
// ("without the added lines the file is <base>'s"). Sibling pins call stripOpenReadOnly(rel, text) first and then do what they always did, the way they already strip the
// J2-04 status lines (scripts/studio-add-slide-status-strip.mjs). scripts/test-studio-open-read-only.mjs proves the strip and that every addition is inert with the flag off.

export const PAGE = 'app/builder/page.tsx'

import { DECK_MUTATION_DEDUPE_PAGE_ADDITION } from './studio-deck-mutation-dedupe-strip.mjs'
const PAGE_ADDITIONS = [
  ["persistenceRef.current.updateMetadata(updates, { passive: true }) // NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: Director's own state frame\n", 'persistenceRef.current.updateMetadata(updates)\n'],
  ["persistenceRef.current.updateMetadata(updates, { passive: true }) // NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: the page's own count reconcile\n", 'persistenceRef.current.updateMetadata(updates)\n'],
  DECK_MUTATION_DEDUPE_PAGE_ADDITION, // FRONTEND-2 #469 (NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE): its page lines come out too (scripts/studio-deck-mutation-dedupe-strip.mjs)
]

/** `text` is the file at `rel`; only app/builder/page.tsx has lines of this change, any other file is returned as it is. */
export function stripOpenReadOnly(rel, text) {
  if (rel !== PAGE) return text
  return PAGE_ADDITIONS.reduce((result, [added, original]) => result.replace(added, original), text)
}
