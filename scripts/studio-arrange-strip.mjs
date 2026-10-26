// FRONTEND-2 (B21, 26 Oct; the Studio half of the Arrange fix, paired with Layout MR !260, LAYOUT_ARRANGE_COMMANDS_ENABLED: both flags flip together). Flag NEXT_PUBLIC_STUDIO_ARRANGE (exact "true", default off,
// build-time; lib/studio-arrange.ts). With it on: selecting an element no longer sends bringToFront (components/presentation-viewer.tsx, one guard: studioArrangeRaisesOnSelect), and the v4 Format inspector's Arrange tab
// admits Order, Align, Position, Size and Lock in slide pixels (lib/studio-format-native.ts admits them, components/builder/studio-format-inspector.tsx draws them); Rotate, Flip and style classes say "Not available yet",
// shapes and tables get every Arrange control disabled, a locked element shows only Unlock.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker STUDIO-ARRANGE (matched as a whole token): eight in the viewer (the import, a ref, the selection input, the two select-raise
// guards, the two ref writes and the save-status guard that keeps Layout's "unsaved" for the selection's own Arrange command from retiring the selection), seven in lib/studio-format-native.ts, the inspector's flag, helper, Arrange-tab switch and its StudioArrange component. The legacy panel (components/element-format-panel) is NOT changed.
// Strip those lines and each file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here; any other
// file comes back as it is.
// THREE OLDER PROOFS ARE TAUGHT (never a FRONTEND-1 test; all FRONTEND-2's or older Studio proofs), one line each: scripts/test-studio-speed-perceived.mjs, section D, the SAME line, byte for byte, that the duplicate-adopt change (#520) and the phone tab bar
// frame change (#519) teach (its trailing comment names DUPLICATE-ADOPT on purpose: changes teaching one line must teach the same bytes, or their merges conflict); and scripts/test-studio-rail-add-slide.mjs, whose
// viewer line count skips this change's marked lines by marker, as it skips every later change's; and scripts/test-studio-pass3-polish-b.mjs, which held that pin byte for byte and now reads it
// past the later changes' edits (its own withoutPeers helper; a pure insertion). putBackPin is idempotent, so the registry may run every restore table that holds a pair, in any order.

export const BASE_COMMIT = '6fba3b7fc76bbe0172b0b06f7cdb43c386867938' // studio-v4-dev-preparation-code at #524 (flow control), merged into this branch (it was cut at 875334fa, #518): without this change's lines every file is this commit's
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

/** The older proofs this change teaches: [text the proof has now, text the base commit's proof has], whole lines. */
export const STUDIO_ARRANGE_SPEED_PROOF = 'scripts/test-studio-speed-perceived.mjs'
export const STUDIO_ARRANGE_RAIL_PROOF = 'scripts/test-studio-rail-add-slide.mjs'
export const STUDIO_ARRANGE_POLISH_B_PROOF = 'scripts/test-studio-pass3-polish-b.mjs'
export const STUDIO_ARRANGE_PIN_MARK = '// LATER-CHANGES: registry read (DUPLICATE-ADOPT)'
export const STUDIO_ARRANGE_PIN_EDITS = {
  [STUDIO_ARRANGE_SPEED_PROOF]: [
    [
      "const HEAD = git('log', '-1', '--format=%H', '--no-merges', '-E', '--grep=^(Speed perceived|Studio perceived speed):', 'HEAD').trim() || git('rev-parse', 'HEAD').trim() // LATER-CHANGES: registry read (DUPLICATE-ADOPT): this change's own newest commit, so a change stacked after it is not read as this one's diff\n",
      "const HEAD = git('rev-parse', 'HEAD').trim()\n"
    ]
  ],
  // Pass 3 polish B's proof holds the pins it taught (the rail pin is one) byte for byte against its base; it now reads them past the later changes' edits (withoutPeers, its own helper), as it reads the two pages.
  // A pure insertion: Pass 3 polish D's proof holds that file to its helper and two reads (+12 at most, -2 exactly).
  [STUDIO_ARRANGE_POLISH_B_PROOF]: [
    [
      "  const read = rel => withoutPeers(rel, rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8')) // LATER-CHANGES: registry read (STUDIO-ARRANGE): the pins this change taught are read past the edits of the changes registered after it (withoutPeers), as the two pages are\n",
      ""
    ]
  ],
  // the rail Add Slide pin counts the viewer's added lines against bb5a89f, skipping each later change's marked lines by marker (no FRONTEND-1 test): this change's seven are skipped the same way, on its
  // `changed` filter line (not the PASS3-POLISH-B line above it, which that change's strip holds)
  [STUDIO_ARRANGE_RAIL_PROOF]: [
    [
      "    const changed = (rel, base) => git(['diff', '--no-color', '-U0', BASE_COMMIT, '--', rel]).split('\\n').filter(line => /^[+-](?![+-])/.test(line) && !line.includes('PASS2D B4') && !line.includes('SLIDE-OPS-VIA-VIEWER') && !line.includes('INSERT-PERSIST') && !line.includes('STUDIO_LAUNCH_WORDING') && !line.includes('VERSION-HISTORY-V2') && !line.includes('NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD') && !belongsToRailBuildCount(line) && !/(?<![\\w-])STUDIO-ARRANGE(?![\\w-])/.test(line)) // LATER-CHANGES: registry read (STUDIO-ARRANGE): its marked viewer lines; scripts/test-studio-arrange.mjs pins them\n",
      "    const changed = (rel, base) => git(['diff', '--no-color', '-U0', BASE_COMMIT, '--', rel]).split('\\n').filter(line => /^[+-](?![+-])/.test(line) && !line.includes('PASS2D B4') && !line.includes('SLIDE-OPS-VIA-VIEWER') && !line.includes('INSERT-PERSIST') && !line.includes('STUDIO_LAUNCH_WORDING') && !line.includes('VERSION-HISTORY-V2') && !line.includes('NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD') && !belongsToRailBuildCount(line))\n"
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
# The v4 Format inspector's Arrange tab works: Order, Align to slide, Position and Size in slide pixels of the 1920 x 1080 slide (Layout snaps to its 12 px grid and keeps the element on the slide).
# Lock, Rotate, Flip and style classes show "Not available yet" (Lock until Layout lets a locked element be selected again); an element already locked shows only Unlock; shapes and tables show every Arrange
# control disabled. A refusal from the viewer is shown in plain words.
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
