// AUDIT P-32 (production frontend audit, "Completed Presentations naming"): the Decks page's first tab reads "Completed Presentations (30)" while the in-progress filter returns 5 of those decks.
// Flag NEXT_PUBLIC_STUDIO_DECK_TABS_HONEST (exact "true", default off, build-time). Off, the tab reads exactly as before.
//
// ROOT CAUSE (app/(app)/dashboard/page.tsx). The tab holds every session that has a built deck (finalPresentationUrl), whatever its status; a card's status badge comes from the session's stage
// (stage 6 = completed, stage 4 and 5 = in progress). So a deck that is built but not finished is in the "Completed" tab, and the count says "completed" for all of them. The grouping is right for what the page
// does with it (built decks here, outline previews in the other tab); the word "Completed" is not.
//
// FIX. The tab is named for what it holds: "Built decks (N)". Nothing about which deck sits in which tab, the counts, the filters or the status badges changes.
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-audit-console.mjs transpiles this file into a bare function scope with a fake `process`.

export function deckTabsHonestOn(value: string | undefined): boolean {
  return value === 'true'
}

/** The flag (a literal process.env read, so Next inlines it at build time). */
export const STUDIO_DECK_TABS_HONEST_ENABLED = deckTabsHonestOn(process.env.NEXT_PUBLIC_STUDIO_DECK_TABS_HONEST)

/** The first Decks tab's label for `count` decks: "Completed Presentations (N)" as before, or "Built decks (N)" with the flag on. */
export function deckBuiltTabLabel(honest: boolean, count: number): string {
  return honest === true ? `Built decks (${count})` : `Completed Presentations (${count})`
}
