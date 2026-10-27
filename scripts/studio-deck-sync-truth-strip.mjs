// FRONTEND-2 (B26, E2E-2's finding of 27 Oct on Studio dev: after chat deletes and a reload, "Slides 3" over a 2-slide deck and a false "This deck changed in another tab"). Flag
// NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH (exact "true", default off, build-time). The rules are in lib/studio-deck-sync-truth.ts (import-free); the root cause per symptom is in its header and in the PR.
//
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker DECK-SYNC-TRUTH (matched as a whole token) with ONE exception, the base line it replaces (the
// notice's text span): DECK_SYNC_TRUTH_REPLACED keeps the base line, so `stripDeckSyncTruth` puts it back first and then takes every marked line out. What is left is
// the base's file, byte for byte. Files with marked lines: components/presentation-viewer.tsx (an import, a ref and two lines after the poll's own totals), lib/studio-deck-changed-notice.ts (three optional deps, two
// variables, the settleDifference function and its calls in announce / check / markReloaded / dispose), hooks/use-deck-changed-notice.ts (an import and one spread) and
// components/builder/studio-deck-changed-notice.tsx (an import and the text). NOT app/builder/page.tsx: scripts/test-studio-chat-theme-export.mjs slices the page by offsets of the registry-read text
// out of the raw text, with 119 bytes to spare, so no marked page line may come before the Director theme runner (see the PR).
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const DECK_SYNC_TRUTH_FLAG = 'NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH'
export const DECK_SYNC_TRUTH_MARKER = 'DECK-SYNC-TRUTH'
/** The marker as a WHOLE token: DECK-SYNC-TRUTH-X or X-DECK-SYNC-TRUTH are not this change's. */
export const DECK_SYNC_TRUTH_MARKER_RE = /(?<![\w-])DECK-SYNC-TRUTH(?![\w-])/
/** The subject prefix of this change's own commits. */
export const DECK_SYNC_TRUTH_SUBJECT = 'Deck sync truth: '
/** Studio dev (studio-v4-dev-preparation-code) with #531 merged: the commit this change is cut from. */
export const DECK_SYNC_TRUTH_BASE_COMMIT = 'c477beda49c1ec96062b700330f56f2d161a2814'

/** Existing files that get marked lines. */
export const DECK_SYNC_TRUTH_FILES = [
  'components/presentation-viewer.tsx',
  'hooks/use-deck-changed-notice.ts',
  'lib/studio-deck-changed-notice.ts',
  'components/builder/studio-deck-changed-notice.tsx',
]

/** New files (no base text to put back). */
export const DECK_SYNC_TRUTH_NEW_FILES = [
  'lib/studio-deck-sync-truth.ts',
  'scripts/studio-deck-sync-truth-strip.mjs',
  'scripts/test-studio-deck-sync-truth.mjs',
  'scripts/fixtures/studio-deck-sync-truth/e2e2-recorded-reads.json',
]

/** The base lines this change replaces: [the line as it is now (it carries the marker), the base's line], whole lines with their newline. */
export const DECK_SYNC_TRUTH_REPLACED = {
  "components/builder/studio-deck-changed-notice.tsx": [
    [
      "      <span data-studio-deck-changed-part=\"text\">{STUDIO_DECK_SYNC_TRUTH_ENABLED /* DECK-SYNC-TRUTH: words by cause, \"another tab\" only for a message another tab sent */ ? deckChangedNoticeText(notice.source) : notice.source === 'reconnect' ? 'This deck changed while you were reconnecting' : 'This deck changed in another tab'}</span>\n",
      "      <span data-studio-deck-changed-part=\"text\">{notice.source === 'reconnect' ? 'This deck changed while you were reconnecting' : 'This deck changed in another tab'}</span>\n"
    ]
  ]
}

/** The older proofs this change teaches (all FRONTEND-2's own: the notice and reconnect-resync proofs load the notice hook, component and lib, which now carry marked lines and an import; the arrange proof holds the viewer to its base; the rail add slide proof filters the viewer's diff by marker; Pass 3 polish B's strip, which COMPOSER-2's first-paint viewer pin reads the viewer through, takes this change's lines out first, the pattern Arrange used): [text the proof has now, text the proof had before]
 *  per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries the registry-read marker. The proofs read the three files through the registry (the marked lines
 *  of every registered change come out first); an unmarked line still counts. A new line has '' as its previous text. */
export const DECK_SYNC_TRUTH_PIN_EDITS = {
  "scripts/test-studio-reconnect-resync.mjs": [
    [
      "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (DECK-SYNC-TRUTH)\n",
      ""
    ],
    [
      "const read = rel => stripLaunchWording(rel, stripLaterChanges(rel, fs.readFileSync(path.join(root, rel), 'utf8'))) // LATER-CHANGES: registry read (DECK-SYNC-TRUTH): a registered later change's marked lines come out first (an unmarked line still counts)\n",
      "const read = rel => stripLaunchWording(rel, fs.readFileSync(path.join(root, rel), 'utf8'))\n"
    ]
  ],
  "scripts/test-studio-deck-changed-notice.mjs": [
    [
      "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (DECK-SYNC-TRUTH)\n",
      ""
    ],
    [
      "const read = rel => stripLaterChanges(rel, fs.readFileSync(path.join(root, rel), 'utf8')) // LATER-CHANGES: registry read (DECK-SYNC-TRUTH): a registered later change's marked lines come out first (an unmarked line still counts)\n",
      "const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')\n"
    ]
  ],
  "scripts/studio-pass3-polish-b-strip.mjs": [
    [
      "import { stripDeckSyncTruth } from './studio-deck-sync-truth-strip.mjs' // LATER-CHANGES: registry read (DECK-SYNC-TRUTH): B26 adds marked lines to the viewer, so they come out first and the viewer read through this strip is its base again\n",
      ""
    ],
    [
      "  if (rel === PASS3_POLISH_B_VIEWER) text = stripDeckSyncTruth(rel, text) // LATER-CHANGES: registry read (DECK-SYNC-TRUTH)\n",
      ""
    ]
  ],
  "scripts/test-studio-arrange.mjs": [
    [
      "import { stripDeckSyncTruth } from './studio-deck-sync-truth-strip.mjs' // LATER-CHANGES: registry read (DECK-SYNC-TRUTH)\n",
      ""
    ],
    [
      "    check(assert.equal, strip.stripStudioArrange(rel, stripDeckSyncTruth(rel, now)), baseText(rel), `${rel}: without its STUDIO-ARRANGE lines it is the base's, byte for byte`) // LATER-CHANGES: registry read (DECK-SYNC-TRUTH): the lines of the change stacked after this one come out first\n",
      "    check(assert.equal, strip.stripStudioArrange(rel, now), baseText(rel), `${rel}: without its STUDIO-ARRANGE lines it is the base's, byte for byte`)\n"
    ]
  ],
  "scripts/test-studio-rail-add-slide.mjs": [
    [
      "import { belongsToDeckSyncTruth } from './studio-deck-sync-truth-strip.mjs' // LATER-CHANGES: registry read (DECK-SYNC-TRUTH): its marked viewer lines\n",
      ""
    ],
    [
      "    const changedPastDeckSync = (rel, base) => changed(rel, base).filter(line => !belongsToDeckSyncTruth(line)) // LATER-CHANGES: registry read (DECK-SYNC-TRUTH): this change's marked viewer lines (scripts/test-studio-deck-sync-truth.mjs pins them)\n",
      ""
    ],
    [
      "      for (const line of withoutFirstPaint(changedPastDeckSync(rel))) assert.doesNotMatch(line, COMMAND, `${rel} diff touches a Layout command: ${line}`) // LATER-CHANGES: registry read (DECK-SYNC-TRUTH)\n",
      "      for (const line of withoutFirstPaint(changed(rel))) assert.doesNotMatch(line, COMMAND, `${rel} diff touches a Layout command: ${line}`)\n"
    ],
    [
      "    assert.deepEqual(withoutFirstPaint(changedPastDeckSync(VIEWER)).filter(line => line.startsWith('-')), [], 'the viewer loses no line') // LATER-CHANGES: registry read (DECK-SYNC-TRUTH)\n",
      "    assert.deepEqual(withoutFirstPaint(changed(VIEWER)).filter(line => line.startsWith('-')), [], 'the viewer loses no line')\n"
    ],
    [
      "    assert.equal(withoutFirstPaint(changedPastDeckSync(VIEWER)).filter(line => line.startsWith('+')).length, 1 + 13 + 1 + 4, 'the viewer gains an import, the gate and the prop (+ the four PASS2D A3 lines)') // LATER-CHANGES: registry read (DECK-SYNC-TRUTH)\n",
      "    assert.equal(withoutFirstPaint(changed(VIEWER)).filter(line => line.startsWith('+')).length, 1 + 13 + 1 + 4, 'the viewer gains an import, the gate and the prop (+ the four PASS2D A3 lines)')\n"
    ]
  ]
}
export const DECK_SYNC_TRUTH_PIN_FILES = Object.keys(DECK_SYNC_TRUTH_PIN_EDITS)

/** The proof without this change's edits (the previous file). */
export function putBackDeckSyncTruthPin(rel, text) {
  return (DECK_SYNC_TRUTH_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

export const DECK_SYNC_TRUTH_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...DECK_SYNC_TRUTH_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const DECK_SYNC_TRUTH_SCOPE_FILES = new Set([...DECK_SYNC_TRUTH_FILES, ...DECK_SYNC_TRUTH_NEW_FILES, ...DECK_SYNC_TRUTH_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const DECK_SYNC_TRUTH_ENV_BLOCK = `# STUDIO DECK SYNC TRUTH (FRONTEND-2, B26; E2E-2's finding of 27 Oct on Studio dev). On for the exact value "true"; default off, and then the Builder is exactly as before. Build-time value: change it on Vercel and redeploy.
# On: after chat deletes and a page reload the rail header ("Slides N") and the footer ("Slide i / N") show the deck's real slide count, the one the viewer itself reports, instead of the larger count the session row kept
# from the build (the count is raised only while a build is in progress); and "This deck changed in another tab" is no longer drawn for a change nobody made in another tab: a difference found within 15 s of a change
# announced on this tab (Director's deck_mutation, or the tab's own edit) refreshes the deck quietly when nothing is unsaved, and any other difference shows only if it is still there 4 s later and reads "This deck was updated".
# "In another tab" stays for a message another tab sent. Acts with NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE (the notice) and NEXT_PUBLIC_STUDIO_DECK_MUTATION_REFRESH_ENABLED (Director's deck_mutation reaches the page). No Director change.
NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH="false"
`

/** The file without this change's lines: the replaced base lines come back, then every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripDeckSyncTruth(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in DECK_SYNC_TRUTH_PIN_EDITS) return putBackDeckSyncTruthPin(rel, text) // an older proof this change taught: its previous text, so a proof that holds it byte for byte reads it as it was
  if (!DECK_SYNC_TRUTH_FILES.includes(rel)) return text
  let out = text
  for (const [has, was] of DECK_SYNC_TRUTH_REPLACED[rel] || []) out = out.replace(has, () => was)
  return out.split('\n').filter(line => !DECK_SYNC_TRUTH_MARKER_RE.test(line)).join('\n')
}

const REPLACED_WAS_LINES = new Set(Object.values(DECK_SYNC_TRUTH_REPLACED).flat().map(([, was]) => was.replace(/\n$/, '')))
/** A line of `git diff -U0` that belongs to this change: an added or removed line that carries the marker, or a base line this change replaces (removed). */
export function belongsToDeckSyncTruth(diffLine) {
  if (DECK_SYNC_TRUTH_MARKER_RE.test(diffLine)) return true
  return diffLine.startsWith('-') && REPLACED_WAS_LINES.has(diffLine.slice(1))
}
