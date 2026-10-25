// FRONTEND-2 (PK's phone review, 25 Oct, decision B: PR 2 of 2, "Phone shell 2", stacked on PR 1). Flag NEXT_PUBLIC_STUDIO_PHONE_SHELL (exact "true", default off, build-time; it also needs NEXT_PUBLIC_STUDIO_V4_SHELL): the SAME
// flag as PR 1, defined by PR 1 (lib/studio-phone-shell.ts). On a phone the Builder top is one row (the logo, a "..." menu, Publish) over today's Slides | Director switch, whose Director segment gets a connection
// dot; the "Director / Connected" row and the edge pull tabs go. At every width the Director panel's status line becomes a dot beside "Director" (words only when it is not connected).
// BuilderHeader, the switch and the Director header are NOT edited (older proofs render them with fixed import tables): one new component (components/builder/studio-phone-builder-top.tsx) draws the menu and the
// dot into them by portal, and its stylesheet does the rest. The exact lines this change adds to app/builder/page.tsx, the one app file older pins hold to an earlier commit: two (the import and the element).
// NOTHING IS CHANGED OR REMOVED IN A BASE LINE: each added line carries the marker PHONE-SHELL-TOP (a WHOLE token; PR 1's is PHONE-SHELL-NAV), so the strip is one rule: a line with the marker goes.
// How the older pins reach it: this change REGISTERS the strip and its files (scripts/studio-later-changes.mjs, two lines; no .env.example block: the flag's block is PR 1's), and stripBulkEditUndo calls the registry
// first, innermost. The proofs PR 1 taught (Pass 3 polish E and F) and PR 1's own proof read through the changes registered after them, so no older test is edited here.
// scripts/test-studio-phone-shell-builder-top.mjs proves all of it. Plain node, no imports, nothing read from disk or git here; any other file comes back as it is.

export const BASE_COMMIT = 'd7b63ae8817d24dc12571b8e7199c0d48778b816' // PR 1's head (frontend2/phone-shell-nav), the branch this change is cut from
export const PHONE_SHELL_TOP_FLAG = 'NEXT_PUBLIC_STUDIO_PHONE_SHELL'
export const PHONE_SHELL_TOP_COMMIT_SUBJECT = /^Phone shell 2:/
export const PHONE_SHELL_TOP_MARKER = 'PHONE-SHELL-TOP'
/** The marker as a WHOLE token: PHONE-SHELL-TOP is this change's; PHONE-SHELL-NAV (PR 1's) and any other suffix are not. */
export const PHONE_SHELL_TOP_MARKER_RE = /(?<![\w-])PHONE-SHELL-TOP(?![\w-])/
export const PHONE_SHELL_TOP_BUILDER = 'app/builder/page.tsx'

/** The one app file whose existing lines older pins hold to a base commit: only marked lines are added to it. */
export const PHONE_SHELL_TOP_FILES = [PHONE_SHELL_TOP_BUILDER]

/** New files (no base text to put back). */
export const PHONE_SHELL_TOP_NEW_FILES = [
  'lib/studio-phone-builder-top.ts',
  'components/builder/studio-phone-builder-top.tsx',
  'components/builder/studio-phone-builder-top.css',
  'scripts/studio-phone-shell-builder-top-strip.mjs',
  'scripts/test-studio-phone-shell-builder-top.mjs',
]

/** Files this change edits that are not app code: the registry (two lines: its files and its strip). No older test is edited. */
export const PHONE_SHELL_TOP_OWN_EDITS = ['scripts/studio-later-changes.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PHONE_SHELL_TOP_SCOPE_FILES = new Set([...PHONE_SHELL_TOP_FILES, ...PHONE_SHELL_TOP_NEW_FILES, ...PHONE_SHELL_TOP_OWN_EDITS])

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripPhoneShellTop(rel, text) {
  if (!PHONE_SHELL_TOP_FILES.includes(rel) || typeof text !== 'string') return text
  return text.split('\n').filter(line => !PHONE_SHELL_TOP_MARKER_RE.test(line)).join('\n')
}
