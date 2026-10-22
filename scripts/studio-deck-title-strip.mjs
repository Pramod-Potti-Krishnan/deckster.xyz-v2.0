// Studio deck titles (flag NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES): the lines this change adds to app/(app)/dashboard/page.tsx, which other pins hold to a base commit
// ("without the added lines the file is <base>'s"). Sibling pins call stripDeckTitle(text) on the Decks page first and then do what they always did, the way they already
// strip the J2-04 status lines (scripts/studio-add-slide-status-strip.mjs). scripts/test-studio-deck-title.mjs proves the strip against the merge parent of this change and that every
// addition is inert with the flag off.

import { stripDuplicateDeck } from './studio-duplicate-deck-strip.mjs'

export const PAGE = 'app/(app)/dashboard/page.tsx'

const PAGE_ADDITIONS = [
  ["import { studioDeckShownTitle, studioDeckTitleProps } from \"@/lib/studio-deck-title\"\nimport { studioTemplateDisplayName } from \"@/lib/studio-template-display-name\"\n", ""],
  ["// PASS2D T (NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES, default off): a deck titled with a stored upload name (\"Deck03_Northwind_QBR.pptx — upload 2026-10-12 22:53 UTC [id]\") is drawn by\n// its clean name (\"Deck03 Northwind QBR\"); the stored title stays in a tooltip and in search, and any other title is drawn as it is. Off, this returns the stored title.\nconst DECK_TITLE_NAMES = process.env.NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES === \"true\"\nconst deckTitle = (presentation: { title: string }) => DECK_TITLE_NAMES ? studioDeckShownTitle(presentation.title, studioTemplateDisplayName) : presentation.title\n\n", ""],
  ["        title={deckTitle(presentation)}\n", "        title={presentation.title}\n"],
  ["        alt={deckTitle(presentation)}\n", "        alt={presentation.title}\n"],
  ["aria-label={`Open ${deckTitle(presentation)} in Studio`}", "aria-label={`Open ${presentation.title} in Studio`}"],
  ["<Link href={href} onClick={event => event.stopPropagation()} {...(DECK_TITLE_NAMES ? studioDeckTitleProps(presentation.title, deckTitle(presentation)) : {})}>{deckTitle(presentation)}</Link></CardTitle>", "<Link href={href} onClick={event => event.stopPropagation()}>{presentation.title}</Link></CardTitle>"],
  ["aria-label={`Manage ${deckTitle(presentation)}`}", "aria-label={`Manage ${presentation.title}`}"],
  ["setDeleteNotice(`“${deckTitle(target.presentation)}” was removed", "setDeleteNotice(`“${target.presentation.title}” was removed"],
  ["<strong>{deleteTarget ? deckTitle(deleteTarget.presentation) : undefined}</strong>", "<strong>{deleteTarget?.presentation.title}</strong>"],
]

/** The Decks page without PASS2D T's lines: two imports, one constant block and seven title reads put back to the stored title. */
export function stripDeckTitle(text) {
  // FRONTEND-2 Pass 3 (NEXT_PUBLIC_STUDIO_DUPLICATE_DECK): that flag's lines come out first (scripts/studio-duplicate-deck-strip.mjs), so every pin that holds this page to a base commit still sees the base.
  return PAGE_ADDITIONS.reduce((result, [added, original]) => result.replace(added, original), stripDuplicateDeck(PAGE, text))
}

export const DECK_TITLE_ADDITIONS = PAGE_ADDITIONS
