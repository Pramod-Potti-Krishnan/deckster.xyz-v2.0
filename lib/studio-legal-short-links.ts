// FRONTEND-2 (PROGRAM-1 decision D16 a, 25 Oct): the two short legal links `uat` redirects, brought into the Studio dev tree. Flag NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS (exact "true", default off, build-time). Import-free.
// `uat` has, in next.config.mjs, { source: '/terms', destination: '/legal/terms', permanent: false } and the same for /privacy: sign-in and sign-up, external links and the Google sign-in consent screen use the short paths, the pages live
// under /legal. The dev tree serves /legal/terms and /legal/privacy but not the short paths (they are a 404), and when the dev tree is carried into `uat` its next.config.mjs replaces uat's, so the two redirects would go. next.config.mjs is held
// byte for byte by older proofs, so the redirects are two small pages instead (app/terms/page.tsx, app/privacy/page.tsx): flag on, the page redirects (HTTP 307, the same as a non-permanent config redirect); flag off, it is the not-found page,
// which is what an unknown path gives today.

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

/** Where the short path goes with the flag on; null with it off (the page is then the not-found page). */
export function studioLegalShortLinkTarget(page: StudioLegalShortLinkPage, value: string | null | undefined): string | null {
  return studioLegalShortLinksOn(value) ? STUDIO_LEGAL_SHORT_LINKS[page].destination : null
}
