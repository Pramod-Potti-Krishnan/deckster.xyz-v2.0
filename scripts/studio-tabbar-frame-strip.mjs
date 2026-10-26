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
// ONE OLDER PROOF IS TAUGHT (FRONTEND-2's own, never a FRONTEND-1 test): scripts/test-studio-speed-perceived.mjs, section D (scope over the committed diff) read BASE..HEAD with HEAD = rev-parse HEAD, so any change merged
// after it was read as its diff (OPS-2's gate on #519 listed this change's files). HEAD there is now its own newest commit (the own-commit form the phone shell proofs use), one whole line for one whole line. The SAME line
// is taught, byte for byte, by the duplicate-adopt change (#520, DUPLICATE_ADOPT_PIN_EDITS), so its trailing comment names DUPLICATE-ADOPT: with both changes in, the proof holds ONE edit twice recorded and the two
// merges need no conflict resolution in it. Both restore tables hold the same pair, and putBackPin is idempotent (a restore of a line that is already back is a no-op), so the registry may run both, in either order.

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

/** The older proof this change teaches (FRONTEND-2's own): [text the proof has now, text the base commit's proof has] per edit, whole lines, so putting them back gives the base file byte for byte. The line the proof has
 * now is the duplicate-adopt change's, byte for byte (its trailing comment names DUPLICATE-ADOPT on purpose: two changes teaching one line must teach the same bytes, or the two merges conflict). */
export const TABBAR_FRAME_SPEED_PROOF = 'scripts/test-studio-speed-perceived.mjs'
export const TABBAR_FRAME_PIN_MARK = '// LATER-CHANGES: registry read (DUPLICATE-ADOPT)'
export const TABBAR_FRAME_PIN_EDITS = {
  [TABBAR_FRAME_SPEED_PROOF]: [
    [
      "const HEAD = git('log', '-1', '--format=%H', '--no-merges', '-E', '--grep=^(Speed perceived|Studio perceived speed):', 'HEAD').trim() || git('rev-parse', 'HEAD').trim() // LATER-CHANGES: registry read (DUPLICATE-ADOPT): this change's own newest commit, so a change stacked after it is not read as this one's diff\n",
      "const HEAD = git('rev-parse', 'HEAD').trim()\n"
    ]
  ]
}

/** The proof without this change's edit (the base commit's file). Idempotent: a line that is already back is not there to be replaced, so a second restore (the same pair held by another change's strip) changes nothing. */
export function putBackPin(rel, text) {
  return (TABBAR_FRAME_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proof this change teaches. */
export const TABBAR_FRAME_PIN_FILES = Object.keys(TABBAR_FRAME_PIN_EDITS)

/** Files this change edits that are not app code: the registry (two lines: its files and its strip) and the older proof it teaches (TABBAR_FRAME_PIN_EDITS). No FRONTEND-1 test is edited. */
export const TABBAR_FRAME_OWN_EDITS = ['scripts/studio-later-changes.mjs', ...TABBAR_FRAME_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const TABBAR_FRAME_SCOPE_FILES = new Set([...TABBAR_FRAME_FILES, ...TABBAR_FRAME_NEW_FILES, ...TABBAR_FRAME_OWN_EDITS])

/** The file without this change's lines: in the bar's component every line that carries the marker (as a whole token) is taken out, every other byte stays; the older proof this change taught gets its base text back
 * (putBackPin). Any other file is returned as it is. */
export function stripTabbarFrame(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in TABBAR_FRAME_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its base text, so a proof that holds it byte for byte reads it as it was
  if (!TABBAR_FRAME_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !TABBAR_FRAME_MARKER_RE.test(line)).join('\n')
}
