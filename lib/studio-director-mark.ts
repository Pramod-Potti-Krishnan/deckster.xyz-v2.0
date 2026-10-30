// FRONTEND-2 (B51, 30 Oct; PK's UAT feedback F-02): the four-pointed star beside "Director · Connected" (header) and above the first-run welcome is the old logo. Flag NEXT_PUBLIC_STUDIO_DIRECTOR_MARK_TRIM (exact "true",
// build-time, default off). With it on, the star is not drawn in either place; PK has not picked yet, so the alternative, the real Deckster mark, is ONE LINE away: change STUDIO_DIRECTOR_MARK below from "none" to "deckster".
// Plain TypeScript, no React. components/builder/chat/studio-director-header.tsx and studio-welcome.tsx carry the lines marked STUDIO-DIRECTOR-MARK-TRIM that ask it.
import { STUDIO_NEW_LOGO_SRC } from '@/lib/studio-new-logo'

export const STUDIO_DIRECTOR_MARK_TRIM_FLAG = 'NEXT_PUBLIC_STUDIO_DIRECTOR_MARK_TRIM'
export const STUDIO_DIRECTOR_MARK_TRIM_MARKER = 'STUDIO-DIRECTOR-MARK-TRIM'

/** WHICH mark replaces the star while the flag is on: "none" draws nothing (the recommendation), "deckster" draws the real Deckster mark (STUDIO_DIRECTOR_MARK_SRC) at the star's size, in both places. The one line to change. */
export const STUDIO_DIRECTOR_MARK: 'none' | 'deckster' = 'none'

/** The real Deckster mark: public/logo-icon-sm.png, the L-B mark of the new Deckster logo (frontend1's "Logo and app icons", 3eaa39e6), 160x160 and the same artwork as public/logo-icon.png (1254x1254, the account header's icon), which is sharp at the
 *  star's 22 px / 13 px sizes. The one path lib/studio-new-logo.ts already holds for the Studio rail's brand tile, reused rather than spelled again. */
export const STUDIO_DIRECTOR_MARK_SRC = STUDIO_NEW_LOGO_SRC

/** True only for the exact string "true". Read when called (see lib/studio-welcome-trim.ts). */
export function studioDirectorMarkTrimOn(): boolean {
  return process.env.NEXT_PUBLIC_STUDIO_DIRECTOR_MARK_TRIM === 'true'
}

/**
 * What to draw in place of the star: null with the flag off (the star, as today); { src: null } for "none" (nothing); { src } for "deckster" (an image at the star's size).
 * `mark` is a parameter only so a proof can ask for both values; the components pass nothing and so read the constant above.
 */
export function studioDirectorMark(mark: 'none' | 'deckster' = STUDIO_DIRECTOR_MARK): { src: string | null } | null {
  if (!studioDirectorMarkTrimOn()) return null
  return { src: mark === 'deckster' ? STUDIO_DIRECTOR_MARK_SRC : null }
}
