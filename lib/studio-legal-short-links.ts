// FRONTEND-2 (PROGRAM-1 decision D16 a, 25 Oct): the two short legal links `uat` redirects, brought into the Studio dev tree. Flag NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS (exact "true", default off, build-time). Import-free.
// `uat` has, in next.config.mjs, { source: '/terms', destination: '/legal/terms', permanent: false } and the same for /privacy: sign-in and sign-up, external links and the Google sign-in consent screen use the short paths, the pages live
// under /legal. The dev tree serves /legal/terms and /legal/privacy but not the short paths (they are a 404), and when the dev tree is carried into `uat` its next.config.mjs replaces uat's, so the two redirects would go. next.config.mjs is held
// byte for byte by older proofs, so the redirects are two small pages instead (app/terms/page.tsx, app/privacy/page.tsx): flag on, the page redirects (HTTP 307, the same as a non-permanent config redirect); flag off, it is the not-found page,
// which is what an unknown path gives today. The query string is carried through, as a config redirect does.

/** Exact "true" turns it on. Anything else (unset, "false", "TRUE", " true", "1") is off. The callers pass `process.env.NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS` (Next inlines it at build time). */
export function studioLegalShortLinksOn(value: string | null | undefined): boolean {
  return value === 'true'
}

/** The short path and where it goes: the same two pairs `uat`'s next.config.mjs redirects. */
export const STUDIO_LEGAL_SHORT_LINKS = {
  terms: { source: '/terms', destination: '/legal/terms' },
  privacy: { source: '/privacy', destination: '/legal/privacy' },
} as const

export type StudioLegalShortLinkPage = keyof typeof STUDIO_LEGAL_SHORT_LINKS

/** What a Next page receives as `searchParams` once awaited. */
export type StudioLegalShortLinkSearchParams = Record<string, string | string[] | undefined>

/**
 * The query string to carry to the legal page, "?a=1&b=2", or "" when there is none. A config redirect (uat's) passes the query string through; this page does the same, with nothing but the request's own search parameters:
 * only own, string-valued entries (a repeated parameter keeps every value, in order), each name and value percent-encoded by URLSearchParams, so nothing in a value can end the query, start a path, a host or a fragment, or add a header line.
 */
export function studioLegalShortLinkQuery(searchParams: StudioLegalShortLinkSearchParams | null | undefined): string {
  if (!searchParams) return ''
  const query = new URLSearchParams()
  for (const [name, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') query.append(name, value)
    else if (Array.isArray(value)) for (const item of value) if (typeof item === 'string') query.append(name, item)
  }
  const text = query.toString()
  return text === '' ? '' : `?${text}`
}

/** Where the short path goes with the flag on (the destination, then the request's own query string); null with it off (the page is then the not-found page, whatever the query). */
export function studioLegalShortLinkTarget(page: StudioLegalShortLinkPage, value: string | null | undefined, searchParams?: StudioLegalShortLinkSearchParams | null): string | null {
  return studioLegalShortLinksOn(value) ? `${STUDIO_LEGAL_SHORT_LINKS[page].destination}${studioLegalShortLinkQuery(searchParams)}` : null
}
