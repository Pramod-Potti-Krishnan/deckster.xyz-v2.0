// PASS2 LAND-01 / LAND-05 / LAND-06 (flag NEXT_PUBLIC_STUDIO_P2_LANDING, default off). Import-free: the flag, the words and the menu's open / close rules only.
//
// LAND-01  the page's <html> gets the night colour (the mockup's `html{background:var(--night)}`), so the rubber-band overscroll and a short window do not flash white
//          above the dark header. The tokens live on `.mv3`, which <html> sits outside of, so the rule carries the literal value (the same one as `--night`).
// LAND-05  the Present chips: Publish & share, Viewers ask and Narration are all "Live" (all three ship today); Zoom / Meet stays "Next".
// LAND-06  a small menu on phones for Bring / Present / Experts / Pricing, with the same links the desktop header has.

/** Exact "true" turns it on. Anything else (unset, "false", "TRUE", " true") is off. The caller passes `process.env.NEXT_PUBLIC_STUDIO_P2_LANDING` (Next inlines it at build time). */
export function studioP2LandingOn(value: string | null | undefined): boolean {
  return value === 'true'
}

/** The marker class on <html> that LAND-01's rule is scoped to; it exists only with the flag on. */
export const STUDIO_P2_NIGHT_CLASS = 'mv3-p2-night'

/** `--night` of styles/marketing-v3.css (declared on .mv3, so not visible on <html>). */
export const STUDIO_P2_NIGHT_COLOR = '#0C0D13'

/** The wrapper's marker attribute: every rule of styles/marketing-v3-p2.css is scoped to it (or to the html marker above). */
export const STUDIO_P2_MENU_ATTR = 'data-p2-landing-menu'

export interface StudioP2LadderItem { status: 'live' | 'build' | 'next'; statusLabel: string; text: string }

/** LAND-05, the home page's ladder: a "build" chip becomes "Live". Off, it returns the very same array. */
export function studioP2Ladder<T extends StudioP2LadderItem>(ladder: readonly T[], on: boolean): readonly T[] {
  if (!on) return ladder
  return ladder.map(item => (item.status === 'build' ? { ...item, status: 'live' as const, statusLabel: 'Live' } : item))
}

export type StudioP2Status = 'Live' | 'In build' | 'Next'

/** LAND-05, the /present page's four cards: "In build" becomes "Live". Off, every status is as written. */
export function studioP2Status(value: StudioP2Status, on: boolean): StudioP2Status {
  return on && value === 'In build' ? 'Live' : value
}

/** LAND-06: the four pages the phone menu lists, in this order. Build is not in it (the header's own "Build a deck" button is). */
export const STUDIO_P2_MENU_LABELS = ['Bring', 'Present', 'Experts', 'Pricing'] as const

export interface StudioP2NavLink { label: string; href: string }

/** The menu's links: the desktop header's own entries (same label, same href) for the four pages, in the menu's order. An entry the header does not have is left out. */
export function studioP2MenuLinks(nav: readonly StudioP2NavLink[]): StudioP2NavLink[] {
  return STUDIO_P2_MENU_LABELS.flatMap(label => {
    const item = nav.find(entry => entry.label === label)
    return item ? [{ label: item.label, href: item.href }] : []
  })
}

/** The menu's words (the visible label is the page's own; the button has no text, so its name is this). */
export const STUDIO_P2_MENU_WORDS = { open: 'Open menu', close: 'Close menu', navLabel: 'Site menu' } as const

export type StudioP2MenuEvent = 'toggle' | 'escape' | 'outside' | 'choose'

/** Open / closed after an event: the button toggles; Escape, a press outside and choosing a link close. Closed stays closed on the closing events. */
export function studioP2MenuNext(open: boolean, event: StudioP2MenuEvent): boolean {
  if (event === 'toggle') return !open
  if (event === 'escape' || event === 'outside' || event === 'choose') return false
  return open
}

/** Only Escape hands the focus back to the menu button (a press outside or a chosen link moves it on its own). */
export function studioP2MenuRestoresFocus(event: StudioP2MenuEvent): boolean {
  return event === 'escape'
}

/** The key that closes an open menu. */
export function studioP2MenuKeyEvent(key: string | null | undefined): StudioP2MenuEvent | null {
  return key === 'Escape' ? 'escape' : null
}
