// FRONTEND-2 (PK's phone review, 26 Oct, on the bottom bar: "Frame: merged into the frame", "Labels: selected tab only"). Flag NEXT_PUBLIC_STUDIO_PHONE_SHELL (exact "true", default off, build-time; it also needs
// NEXT_PUBLIC_STUDIO_V4_SHELL): the SAME flag as "Phone shell 1" and "Phone shell 2" (#516, #517), defined by PR 1 (lib/studio-phone-shell.ts), so there is no new env block. On a phone (640 px and narrower) the bottom tab bar
// sits on the frame (the frame's colour, opaque, no top line) and the selected tab is the desktop rail's selected item (a panel tile, the teal icon and name, the rail's soft shadow); only the selected tab shows its name
// (the others are visually hidden, never display: none, so every tab keeps its accessible name).
// PURE CSS: the bar's markup is not touched (the render of components/layout/studio-phone-tab-bar.tsx is the base's byte for byte) and PR 1's stylesheet is not edited (its proof holds it to exactly one rule outside the phone
// query and one at-rule). The new sheet (components/layout/studio-tabbar-frame.css) is imported by the bar's component, right after PR 1's. The one line this change adds to an EXISTING file is that import, in
// components/layout/studio-phone-tab-bar.tsx; it carries the marker PHONE-TABBAR-FRAME (a WHOLE token), so the strip is one rule: a line with the marker goes (stripTabbarFrame(rel, text)) and the file is the base's, byte for byte.
// The files are named tabbar-frame, not phone-tabbar-frame: PR 1's proof lists every file whose name has "phone-shell" or "phone-tab" as its own (a family check), and PR 1's proof is not edited.
// How the older pins reach it: this change REGISTERS its files and its strip (scripts/studio-later-changes.mjs, two lines; no .env.example block: the flag's block is PR 1's). PR 1's and PR 2's proofs read the bar's
// component through the registry, so the marked line comes out first. scripts/test-studio-tabbar-frame.mjs proves all of it. Plain node, no imports, nothing read from disk or git here; any other file comes back as it is.

export const BASE_COMMIT = '875334faa648ed72e63b260457ca2fc0a2020c0c' // studio-v4-dev-preparation-code at #518 (perceived speed), the branch this change is cut from
export const TABBAR_FRAME_FLAG = 'NEXT_PUBLIC_STUDIO_PHONE_SHELL'
export const TABBAR_FRAME_COMMIT_SUBJECT = /^Phone tab bar frame:/
export const TABBAR_FRAME_MARKER = 'PHONE-TABBAR-FRAME'
/** The marker as a WHOLE token: PHONE-TABBAR-FRAME is this change's; PHONE-SHELL-NAV, PHONE-SHELL-TOP and any other prefix or suffix are not. */
export const TABBAR_FRAME_MARKER_RE = /(?<![\w-])PHONE-TABBAR-FRAME(?![\w-])/
export const TABBAR_FRAME_BAR = 'components/layout/studio-phone-tab-bar.tsx'

/** The one existing file whose lines older pins hold to a base commit: only a marked line is added to it. */
export const TABBAR_FRAME_FILES = [TABBAR_FRAME_BAR]

/** New files (no base text to put back). */
export const TABBAR_FRAME_NEW_FILES = [
  'components/layout/studio-tabbar-frame.css',
  'scripts/studio-tabbar-frame-strip.mjs',
  'scripts/test-studio-tabbar-frame.mjs',
]

/** Files this change edits that are not app code: the registry (two lines: its files and its strip). No older test is edited. */
export const TABBAR_FRAME_OWN_EDITS = ['scripts/studio-later-changes.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const TABBAR_FRAME_SCOPE_FILES = new Set([...TABBAR_FRAME_FILES, ...TABBAR_FRAME_NEW_FILES, ...TABBAR_FRAME_OWN_EDITS])

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripTabbarFrame(rel, text) {
  if (!TABBAR_FRAME_FILES.includes(rel) || typeof text !== 'string') return text
  return text.split('\n').filter(line => !TABBAR_FRAME_MARKER_RE.test(line)).join('\n')
}
