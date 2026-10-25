// STUDIO PHONE SHELL (FRONTEND-2; PK's phone review, 25 Oct, decision A). Flag NEXT_PUBLIC_STUDIO_PHONE_SHELL (exact "true", default off, read at build time), only with the Studio shell
// (NEXT_PUBLIC_STUDIO_V4_SHELL, exact "true"). Import-free: the flag, the bar's tabs and the routes of the More sheet. No I/O.
//
// What the flag does on a phone (640 px and narrower): the left icon rail gives way to a bottom tab bar (Studio, Decks, Templates, Themes, More); More opens a sheet with every other rail destination
// (Second brain, Intelligence, Your details), Help and the account menu; the rail's brand tile stays, at the top left of the page's top bar. Tablets and desktops keep the rail. Flag off, nothing here is drawn.

/** Exact "true" for the flag AND the Studio shell; anything else (unset, "false", "TRUE", " true", "1") is off. The caller passes the two `process.env` values (Next inlines them at build time). */
export function studioPhoneShellOn(flag: string | null | undefined, shell: string | null | undefined): boolean {
  return flag === 'true' && shell === 'true'
}

/** The flag, resolved once at build time. Every element this change adds is drawn only when it is true. */
export const STUDIO_PHONE_SHELL_ENABLED = studioPhoneShellOn(process.env.NEXT_PUBLIC_STUDIO_PHONE_SHELL, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL)

export type StudioPhoneTab = 'studio' | 'decks' | 'templates' | 'themes' | 'more'

/** The four tabs PK chose, in his order, with the routes the rail uses for them (the Studio tab is the rail's Studio entry: the Builder). */
export const STUDIO_PHONE_TABS: ReadonlyArray<{ tab: Exclude<StudioPhoneTab, 'more'>; href: string }> = [
  { tab: 'studio', href: '/builder' },
  { tab: 'decks', href: '/dashboard' },
  { tab: 'templates', href: '/studio/templates' },
  { tab: 'themes', href: '/studio/themes' },
]

/** Every other rail destination, with the rail's own words and routes (the Second brain label comes from studioNavLabels, as in the rail), then Help (the account menu's route). The account menu itself is the sheet's last row. */
export const STUDIO_PHONE_MORE_LINKS: ReadonlyArray<{ key: 'knowledge' | 'intelligence' | 'details' | 'help'; label: string | null; href: string }> = [
  { key: 'knowledge', label: null, href: '/knowledge' },
  { key: 'intelligence', label: 'Intelligence', href: '/studio/intelligence' },
  { key: 'details', label: 'Your details', href: '/studio/details' },
  { key: 'help', label: 'Help', href: '/help' },
]

/** The tab that is highlighted for a route: the four tabs by the rail's own tests (the Builder by prefix, the others exactly); every other page the bar is drawn on is reached through More. */
export function studioPhoneActiveTab(pathname: string | null | undefined): StudioPhoneTab {
  const route = typeof pathname === 'string' ? pathname : ''
  if (route === '/builder' || route.startsWith('/builder/')) return 'studio'
  if (route === '/dashboard') return 'decks'
  if (route === '/studio/templates') return 'templates'
  if (route === '/studio/themes') return 'themes'
  return 'more'
}

/** The Director prompt: while it has focus (the phone keyboard is open) the bar steps aside, and it comes back on blur. */
export const STUDIO_PHONE_COMPOSER_SELECTOR = '[data-studio-composer-prompt="true"] textarea'
