// STUDIO NEW LOGO (flag NEXT_PUBLIC_STUDIO_NEW_LOGO, default off). Import-free: the flag and the one image the Studio rail's brand tile shows. No I/O.
//
// What the flag does: the tile at the top left of the Studio rail (the Builder, the library pages, Help and the session-problem view all render it) shows the L-B mark of the new Deckster logo, the same
// file the account header and the sign-in pages use, in place of the purple square holding a Layers icon. With it off the tile is exactly as before. The tile keeps its link ("Deckster home"), its
// accessible name, its tooltip, its 32px box and the hairline the details pass draws under it; only what it paints changes (components/layout/studio-new-logo.css).

/** Exact "true" turns it on. Anything else (unset, "false", "TRUE", " true") is off. The caller passes `process.env.NEXT_PUBLIC_STUDIO_NEW_LOGO` (Next inlines it at build time). */
export function studioNewLogoOn(value: string | null | undefined): boolean {
  return value === 'true'
}

/** The mark: public/logo-icon-sm.png, 160x160, the same artwork as public/logo-icon.png (1254x1254) at a weight that suits a 32px tile (5x the pixels it is drawn at, so it stays sharp on a 3x phone). */
export const STUDIO_NEW_LOGO_SRC = '/logo-icon-sm.png'

/** The tile's side in CSS pixels (studio-shell.css: `.studio-rail-brand { height: 32px; width: 32px }`), the width and height the image is drawn at. The test holds it equal to the CSS. */
export const STUDIO_NEW_LOGO_SIZE = 32
