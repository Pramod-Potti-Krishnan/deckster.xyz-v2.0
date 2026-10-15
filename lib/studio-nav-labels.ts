// PASS2B G43 + G54 (flag NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS, default off). Import-free: words only.
//
// G43: the Studio rail and top bar name the destinations the way the accepted v4 mockup does: "Your decks" and "Second brain" (the Knowledge
//      page's own heading already says "Second Brain"). Tooltip, accessible name and top-bar title only; the routes (/dashboard, /knowledge)
//      and every other label are untouched.
// G54 (the Decks page's tab "Strawman Previews" -> "Outline previews") is a literal in the page itself, so that page imports nothing from here.

export interface StudioNavLabels {
  /** The /dashboard destination: the rail's tooltip and accessible name, and the top bar's title. */
  decks: string
  /** The /knowledge destination: the same three places. */
  knowledge: string
}

const ORIGINAL: StudioNavLabels = { decks: 'Decks', knowledge: 'Knowledge' }
const PLAIN: StudioNavLabels = { decks: 'Your decks', knowledge: 'Second brain' }

/** The labels for a flag already resolved (and Studio-shell-qualified) by the caller: only a real `true` gives the plain words. */
export function studioNavLabels(plain: boolean): StudioNavLabels {
  return plain === true ? PLAIN : ORIGINAL
}
