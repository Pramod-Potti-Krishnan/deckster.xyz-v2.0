// FRONTEND-2 (B21, 26 Oct; the Studio half of the Arrange fix, paired with Layout MR !260, LAYOUT_ARRANGE_COMMANDS_ENABLED: both flags flip together). Flag NEXT_PUBLIC_STUDIO_ARRANGE (exact "true", default off,
// build-time; lib/studio-arrange.ts). With it on: selecting an element no longer sends bringToFront (components/presentation-viewer.tsx, one guard: studioArrangeRaisesOnSelect), and the v4 Format inspector's Arrange tab
// admits Order, Align, Position, Size and Lock in slide pixels (lib/studio-format-native.ts admits them, components/builder/studio-format-inspector.tsx draws them); Rotate, Flip and style classes say "Not available yet",
// shapes and tables get every Arrange control disabled, a locked element shows only Unlock.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker STUDIO-ARRANGE (matched as a whole token): seven in the viewer (the import, a ref, the selection input, the two select-raise
// guards and the two ref writes), seven in lib/studio-format-native.ts, the inspector's flag, helper, Arrange-tab switch and its StudioArrange component. The legacy panel (components/element-format-panel) is NOT changed.
// Strip those lines and each file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here; any other
// file comes back as it is.
// ONE OLDER PROOF IS TAUGHT (FRONTEND-2's own, never a FRONTEND-1 test): scripts/test-studio-speed-perceived.mjs, section D, the SAME line, byte for byte, that the duplicate-adopt change (#520) and the phone tab bar
// frame change (#519) teach (its trailing comment names DUPLICATE-ADOPT on purpose: changes teaching one line must teach the same bytes, or their merges conflict). putBackPin is idempotent, so the registry may run
// every restore table that holds the pair, in any order.

export const BASE_COMMIT = '875334faa648ed72e63b260457ca2fc0a2020c0c' // studio-v4-dev-preparation-code at #518 (perceived speed), the branch this change is cut from
export const STUDIO_ARRANGE_FLAG = 'NEXT_PUBLIC_STUDIO_ARRANGE'
export const STUDIO_ARRANGE_COMMIT_SUBJECT = /^Studio arrange:/
export const STUDIO_ARRANGE_MARKER = 'STUDIO-ARRANGE'
/** The marker as a WHOLE token: STUDIO-ARRANGE-X or X-STUDIO-ARRANGE are not this change's. */
export const STUDIO_ARRANGE_MARKER_RE = /(?<![\w-])STUDIO-ARRANGE(?![\w-])/

/** Existing files that get marked lines (pure insertions only). */
export const STUDIO_ARRANGE_FILES = [
  'components/presentation-viewer.tsx',
  'lib/studio-format-native.ts',
  'components/builder/studio-format-inspector.tsx',
]

/** New files (no base text to put back). */
export const STUDIO_ARRANGE_NEW_FILES = [
  'lib/studio-arrange.ts',
  'scripts/studio-arrange-strip.mjs',
  'scripts/studio-arrange-layout.mjs',
  'scripts/test-studio-arrange.mjs',
  'scripts/fixtures/studio-arrange/serve-layout-viewer.py',
  'scripts/fixtures/studio-arrange/layout-transcript.json',
]

/** The older proof this change teaches: [text the proof has now, text the base commit's proof has], whole lines. */
export const STUDIO_ARRANGE_SPEED_PROOF = 'scripts/test-studio-speed-perceived.mjs'
export const STUDIO_ARRANGE_PIN_MARK = '// LATER-CHANGES: registry read (DUPLICATE-ADOPT)'
export const STUDIO_ARRANGE_PIN_EDITS = {
  [STUDIO_ARRANGE_SPEED_PROOF]: [
    [
      "const HEAD = git('log', '-1', '--format=%H', '--no-merges', '-E', '--grep=^(Speed perceived|Studio perceived speed):', 'HEAD').trim() || git('rev-parse', 'HEAD').trim() // LATER-CHANGES: registry read (DUPLICATE-ADOPT): this change's own newest commit, so a change stacked after it is not read as this one's diff\n",
      "const HEAD = git('rev-parse', 'HEAD').trim()\n"
    ]
  ]
}

/** The proof without this change's edit (the base commit's file). Idempotent: a line already back is not there to be replaced. */
export function putBackPin(rel, text) {
  return (STUDIO_ARRANGE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

export const STUDIO_ARRANGE_PIN_FILES = Object.keys(STUDIO_ARRANGE_PIN_EDITS)

/** Files this change edits that are neither app code with marked lines nor new: its .env.example block, the registry (three lines) and the older proof it teaches. No FRONTEND-1 test is edited. */
export const STUDIO_ARRANGE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...STUDIO_ARRANGE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const STUDIO_ARRANGE_SCOPE_FILES = new Set([...STUDIO_ARRANGE_FILES, ...STUDIO_ARRANGE_NEW_FILES, ...STUDIO_ARRANGE_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const STUDIO_ARRANGE_ENV_BLOCK = `# STUDIO ARRANGE (FRONTEND-2, 26 Oct; pairs with Layout !260, LAYOUT_ARRANGE_COMMANDS_ENABLED: both flip together). On for the exact value "true"; default off, and then selection and the Format inspector behave exactly as today.
# Build-time value: change it on Vercel and redeploy.
# On: selecting an element no longer raises it (the viewer sent bringToFront on every selection, which Layout's flag turns into a saved raise); ordering happens only through Arrange or chat.
# The v4 Format inspector's Arrange tab works: Order, Align to slide, Position and Size in slide pixels of the 1920 x 1080 slide (Layout snaps to its 12 px grid and keeps the element on the slide), and Lock.
# Rotate, Flip and style classes show "Not available yet"; shapes and tables show every Arrange control disabled; a locked element shows only Unlock. A refusal from the viewer is shown in plain words.
NEXT_PUBLIC_STUDIO_ARRANGE="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays; the older proof this change taught gets its base text back. Any other file is
 *  returned as it is. */
export function stripStudioArrange(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in STUDIO_ARRANGE_PIN_EDITS) return putBackPin(rel, text)
  if (!STUDIO_ARRANGE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !STUDIO_ARRANGE_MARKER_RE.test(line)).join('\n')
}
