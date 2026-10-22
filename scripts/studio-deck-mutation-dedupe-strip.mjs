// FRONTEND-2 #469 (flag NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE): the lines this change adds to app/builder/page.tsx, which other pins hold to a base
// commit ("without the added lines the file is <base>'s"). scripts/studio-open-read-only-strip.mjs carries DECK_MUTATION_DEDUPE_PAGE_ADDITION in its
// table, so every pin that already calls stripOpenReadOnly(rel, text) also drops these lines. scripts/test-studio-deck-mutation-dedupe.mjs proves the
// strip (the page with these lines removed is byte-for-byte its base) and that every addition is inert with the flag off.

export const PAGE = 'app/builder/page.tsx'

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const FRAGMENTS = [
  escape("import { createDeckMutationCountSettler } from '@/lib/studio-deck-mutation-dedupe'\n"),
  escape("import { fetchSlideInventory } from '@/lib/slide-rail-identity'\n"),
  // the settler ref: its comment lines through `}) : null)`
  " {2}// NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE: a deck_mutation's count comes from Layout[\\s\\S]*?\\}\\) : null\\)\\n",
  escape('        if (deckMutationCountSettlerRef.current) { void deckMutationCountSettlerRef.current(plan.override, owner.isCurrent); return } // NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE\n'),
]

/** One [added, original] pair in the shape of studio-open-read-only-strip.mjs's PAGE_ADDITIONS: a global pattern that removes every addition. */
export const DECK_MUTATION_DEDUPE_PAGE_ADDITION = [new RegExp(FRAGMENTS.join('|'), 'g'), '']

/** `text` of repo file `rel` without this change's additions (any other file comes back as it is). */
export function stripDeckMutationDedupe(rel, text) {
  return rel === PAGE ? text.replace(...DECK_MUTATION_DEDUPE_PAGE_ADDITION) : text
}
