// FRONTEND-1 UX polish 2 (frontend1/ux-polish-2, 4 Nov), flag NEXT_PUBLIC_STUDIO_UX_POLISH_2 (the string "true", default off, build-time).
//   UX-20 one accent: the Studio accent tokens that were purple take the shell teal (Studio surfaces only; not the marketing site, not the brand logo). UX-16: Docs in the Studio frame on that accent.
//   UX-14: Intelligence's replay button gets its own gutter; the docked "Models" bar is hidden when the catalog could not load.
// Every line this change adds to an existing file carries the marker UX-POLISH-2 (a whole token): app/layout.tsx (two imports and the mount). No existing line is rewritten.
// Strip the marked lines and the file is its base, byte for byte. How the older pins reach it: registered in scripts/studio-later-changes.mjs (three lines). Plain node, nothing read from disk or git here.

export const BASE_COMMIT = '12dadbc16ff94095c4e71b849c1be18c51bf1b3b' // frontend1/page-consistency at the start of this change
export const UX_POLISH_2_FLAG = 'NEXT_PUBLIC_STUDIO_UX_POLISH_2'
export const UX_POLISH_2_MARKER_RE = /(?<![\w-])UX-POLISH-2(?![\w-])/

/** Existing files with marked lines. */
export const UX_POLISH_2_FILES = ['app/layout.tsx']

/** New files. */
export const UX_POLISH_2_NEW_FILES = ['lib/studio-ux-polish-2.ts', 'components/studio-ux-polish-2/studio-ux-polish-2-mount.tsx', 'components/studio-ux-polish-2/studio-ux-polish-2.css', 'scripts/studio-ux-polish-2-strip.mjs', 'scripts/test-studio-ux-polish-2.mjs']

export const UX_POLISH_2_ENV_BLOCK = "# STUDIO UX POLISH 2 (FRONTEND-1 UX review, UX-20 / UX-16 / UX-14). On only for the string \"true\"; default off, and then nothing changes. Build-time value: change it on Vercel and redeploy.\n# On: one accent on Studio surfaces (the accent tokens that were purple take the shell teal; the marketing site and the brand logo are untouched), Docs in the Studio frame on that accent, and on\n# Intelligence the replay button gets its own gutter and the docked \"Models\" bar is hidden when the catalog is unavailable or not available (a load error keeps its bar, its message and \"Try again\").\n# This flag changes styles only: routes, handlers and words are unchanged. G-06 (the Docs \"Exporting & Sharing\" article lists only PowerPoint and PDF at one fixed quality) is NOT behind this flag: it is an always-on\n# honesty edit, the same class as the Google Slides cut.\nNEXT_PUBLIC_STUDIO_UX_POLISH_2=\"false\"\n"

/** Every file this change's commit touches. */
export const UX_POLISH_2_SCOPE_FILES = new Set([...UX_POLISH_2_FILES, ...UX_POLISH_2_NEW_FILES, 'scripts/studio-later-changes.mjs', '.env.example'])

/** The file as it was before this change. Any other file is returned as it is. */
export function stripUxPolish2(rel, text) {
  if (typeof text !== 'string' || !UX_POLISH_2_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !UX_POLISH_2_MARKER_RE.test(line)).join('\n')
}
