/**
 * PASS2-PAGES shared shell row (INT-15 = DET-12 = SB-17, streams/ops/PASS2-PAGES/*.md): on the library pages the top bar carries the mock's
 * "+ Presentation" (a fresh Studio session, /builder?session_id=new), and the rail marks the current destination with a teal bar at its left
 * edge plus a hairline under the brand tile.
 *
 * Flag NEXT_PUBLIC_STUDIO_P2_LIBRARY_SHELL: exact "true" and the literal Studio shell. Off: the button and the rail attribute are absent and the
 * CSS matches nothing. Import-free on purpose, so scripts/test-studio-p2-library-shell.mjs can run the real file in a bare vm.
 */
export const STUDIO_P2_LIBRARY_SHELL_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_LIBRARY_SHELL === 'true'

/** Where "+ Presentation" goes: the same fresh-session URL Studio's own New presentation uses (lib/studio-session-hygiene.ts). */
export const NEW_PRESENTATION_HREF = '/builder?session_id=new'

/** The library pages that show it (the same set as the top bar's "Back to Studio"). */
export function showsNewPresentation(enabled: boolean, pathname: string | null | undefined, libraryPaths: readonly string[]): boolean {
  return enabled && typeof pathname === 'string' && libraryPaths.includes(pathname)
}
