// UX-07 / UX-10 / one New label (FRONTEND-1 UX review, 4 Nov): NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY, exact "true", default off, read at build time, and only with the Studio shell. Import-free.
// On: Settings and Billing get the Studio top bar the library pages have (their own title, "Back to Studio", "+ Presentation") and the rail marks "Your details" as current there (the account
// pages are reached from it); Billing's cards take the Studio shell tokens and the "Your details" section heading style (components/studio-page-consistency/studio-page-consistency.css,
// every rule scoped to data-studio-page-consistency="true" on <html>); and every create button reads "+ Presentation", the label of the newest Studio shell (Pass 2 DET-12, the accepted v4 mockup).
// Off: nothing here is read and every page renders as before.

export const STUDIO_PAGE_CONSISTENCY_ENABLED = process.env.NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

export const STUDIO_PAGE_CONSISTENCY_ATTR = 'data-studio-page-consistency'

/** The one create label (shown after a + icon). */
export const STUDIO_PRESENTATION_LABEL = 'Presentation'
/** Its accessible name. */
export const STUDIO_PRESENTATION_NAME = 'New presentation'

/** The top bar title of an account page, or null for a route that is not one. */
export function studioAccountPageTitle(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  if (pathname === '/billing' || pathname.startsWith('/billing/')) return 'Billing'
  if (pathname === '/settings' || pathname.startsWith('/settings/')) return 'Settings'
  return null
}

/** The rail item that is current on an account page ("Your details": Settings and Billing are its account half). */
export function studioRailDetailsCurrent(enabled: boolean, pathname: string | null | undefined): boolean {
  return enabled === true && studioAccountPageTitle(pathname) !== null
}
