// UX findings E (FRONTEND-2, B64; PROGRAM-1's item E from FRONTEND-1's 4 Nov UX pass): NEXT_PUBLIC_STUDIO_UX_FINDINGS_E, exact "true", default off, read at build time, and only with the Studio shell. Import-free.
// On: a client mount (components/studio-ux-findings-e/studio-ux-findings-e-mount.tsx) sets data-studio-ux-findings-e="true" on <html>; components/studio-ux-findings-e/studio-ux-findings-e.css (every rule scoped to it) does UX-12 / UX-19 / UX-22 / UX-26 / UX-27.
// Two findings are not CSS: UX-08 (the workspace intro plays once on a browser, then never again; a browser that already holds any intro mark plays none; FRONTEND-1's own seen-store is reused, nothing in the intro changes) and UX-11 (/settings/profile goes to "Your details").
// Off: nothing here is read, no attribute is set, no store is touched and no redirect is made, so every page renders as before.

export const STUDIO_UX_FINDINGS_E_ENABLED = process.env.NEXT_PUBLIC_STUDIO_UX_FINDINGS_E === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
/** The rail's new logo (NEXT_PUBLIC_STUDIO_NEW_LOGO, exact "true"): the Builder skeleton follows it, so the two tiles match. */
export const STUDIO_UX_FINDINGS_E_NEW_LOGO = process.env.NEXT_PUBLIC_STUDIO_NEW_LOGO === 'true'
/** The plain nav labels (NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS, exact "true"): only then does the top bar say "Your decks", the Decks page's own H1. */
export const STUDIO_UX_FINDINGS_E_PLAIN_NAV = process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS === 'true'

export const STUDIO_UX_FINDINGS_E_ATTR = 'data-studio-ux-findings-e'
export const STUDIO_UX_FINDINGS_E_LOGO_ATTR = 'data-studio-ux-findings-e-logo'
export const STUDIO_UX_FINDINGS_E_NAV_ATTR = 'data-studio-ux-findings-e-nav'

/** UX-11: the one profile page. */
export const STUDIO_UX_FINDINGS_E_PROFILE_FROM = '/settings/profile'
export const STUDIO_UX_FINDINGS_E_PROFILE_TO = '/studio/details'
/** Where /settings/profile goes, or null for any other route. */
export function studioUxFindingsEProfileTarget(pathname: string | null | undefined): string | null {
  if (pathname === STUDIO_UX_FINDINGS_E_PROFILE_FROM || pathname === `${STUDIO_UX_FINDINGS_E_PROFILE_FROM}/`) return STUDIO_UX_FINDINGS_E_PROFILE_TO
  return null
}

// ---- UX-08: the workspace intro, once ------------------------------------------------------------------------------------------------------------------
/** FRONTEND-1's own store (components/workspace-intro/workspace-intro.tsx STORAGE): a JSON array of the screens whose intro has played on this browser. Reused as it is. */
export const STUDIO_UX_FINDINGS_E_INTRO_STORE = 'deckster-studio-workspace-intros-v2'
/** The screens the intro knows (its COPY keys). */
export const STUDIO_UX_FINDINGS_E_INTRO_SCREENS = ['builder', 'decks', 'templates', 'brand', 'knowledge', 'models', 'details'] as const
/** The intro's own window event, sent when an intro opens (before it records its screen). */
export const STUDIO_UX_FINDINGS_E_INTRO_OPEN_EVENT = 'deckster:workspace-intro-open'
/** The intro's in-memory twin of the store (a Set on window). */
export const STUDIO_UX_FINDINGS_E_INTRO_MEMORY = '__decksterWorkspaceIntrosV2'
/** This user's "the intro has played for me on this browser" mark (the user id is in the key). */
export const studioUxFindingsEIntroKey = (userId: string) => `deckster-studio-ux-e-intro-once:${userId}`

interface IntroStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface StudioUxFindingsEIntroHost { localStorage?: IntroStorage; __decksterWorkspaceIntrosV2?: Set<string> }

/** Every screen is marked as played (the store and its in-memory twin), so no intro starts by itself; "Replay intro" still works (an explicit replay skips the check). */
function markEveryScreenSeen(host: StudioUxFindingsEIntroHost): void {
  const memory = host[STUDIO_UX_FINDINGS_E_INTRO_MEMORY]
  if (memory) STUDIO_UX_FINDINGS_E_INTRO_SCREENS.forEach(screen => memory.add(screen))
  try { host.localStorage?.setItem(STUDIO_UX_FINDINGS_E_INTRO_STORE, JSON.stringify([...STUDIO_UX_FINDINGS_E_INTRO_SCREENS])) } catch { /* Storage unavailable: the intro's own memory set keeps this page quiet. */ }
}

/** An intro has opened for `userId`: record it, and mark every screen seen, so the next page does not open another. */
export function studioUxFindingsEIntroPlayed(host: StudioUxFindingsEIntroHost, userId: string): void {
  if (!userId) return
  try { host.localStorage?.setItem(studioUxFindingsEIntroKey(userId), '1') } catch { /* Storage unavailable: the memory set below still holds for this page. */ }
  markEveryScreenSeen(host)
}

/** Some intro has already played on this browser: any mark in FRONTEND-1's store, or in the intro's in-memory twin. */
export function studioUxFindingsEIntroHasMark(host: StudioUxFindingsEIntroHost): boolean {
  if ((host[STUDIO_UX_FINDINGS_E_INTRO_MEMORY]?.size ?? 0) > 0) return true
  try {
    const stored: unknown = JSON.parse(host.localStorage?.getItem(STUDIO_UX_FINDINGS_E_INTRO_STORE) || '[]')
    return Array.isArray(stored) && stored.some(value => typeof value === 'string')
  } catch { return false }
}

/** A browser that already holds a mark plays no intro by itself: every screen is marked seen and nothing is emptied. Needs no user id, so it can run before the session has loaded. Returns whether it marked. */
export function studioUxFindingsEIntroSettle(host: StudioUxFindingsEIntroHost): boolean {
  if (!studioUxFindingsEIntroHasMark(host)) return false
  markEveryScreenSeen(host)
  return true
}

/**
 * `userId` is known (`openedEarly` is true when an intro opened before the id was known: that one was this user's).
 * Played for this user already: every screen is marked seen. No mark for this user but the browser already holds one (the old per-page rule, an earlier visit, another account): the user's mark is written and every screen
 * is marked seen, so nothing plays; the marks are never emptied. A browser with no mark at all: nothing is done, so exactly one intro plays, and its open event records it. Returns what it found.
 */
export function studioUxFindingsEIntroReconcile(host: StudioUxFindingsEIntroHost, userId: string, openedEarly: boolean): 'played' | 'returning' | 'first' {
  if (!userId) return 'first'
  let played = openedEarly
  try { played = played || host.localStorage?.getItem(studioUxFindingsEIntroKey(userId)) === '1' } catch { /* Storage unavailable: only what this page saw counts. */ }
  if (played) { studioUxFindingsEIntroPlayed(host, userId); return 'played' }
  if (studioUxFindingsEIntroHasMark(host)) { studioUxFindingsEIntroPlayed(host, userId); return 'returning' }
  return 'first'
}
