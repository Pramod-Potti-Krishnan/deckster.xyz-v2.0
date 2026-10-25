// FRONTEND-2 (PROGRAM-1 Saturday evening push, 24 Oct: the Pass 3 polish set, PR B). Flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time): the SAME flag as PR A, defined by PR A; this PR
// uses it from lib/studio-pass3-polish-b.ts. PR B holds the static audit's finding #7 where it is reachable: the native alert() of the viewer's failed save and of the Builder's two failed session creations
// become the Studio toast, in plain words. (The viewer's discard-edits confirm is not here: handleCancelEdits has no caller at the dev head.)
// The exact lines this change adds to the two app files that older pins hold to an earlier commit ("without this change's lines the file is the base's"): components/presentation-viewer.tsx and
// app/builder/page.tsx. NOTHING IS CHANGED OR REMOVED IN A BASE LINE: every added line carries the marker PASS3-POLISH-B (its own; PR A's is PASS3-POLISH), so the strip is one rule: a line with the marker goes
// (stripPass3PolishB(rel, text)). Plain node, no imports, nothing read from disk or git here; any other file comes back as it is.
// How the older pins reach it: this change REGISTERS the strip and its files (scripts/studio-later-changes.mjs, two lines; there is no .env.example block of its own: the flag's block is PR A's), and
// stripBulkEditUndo calls the registry first, innermost, so every pin that already strips bulk edit + chat undo takes this change's lines out with no edit of its own. The pins that do not (see
// PASS3_POLISH_B_PIN_EDITS) read through the registry after a one-line edit each. scripts/test-studio-pass3-polish-b.mjs proves that the two files without this change's lines are BASE_COMMIT's files byte for byte.

export const BASE_COMMIT = 'b2423e20338622d0a4a773db1d0758278e79d312' // studio dev head (Merge pull request #503, chat undo v2) this change is cut from
export const PASS3_POLISH_MARKER = 'PASS3-POLISH-B' // its OWN marker (PR A's is PASS3-POLISH); the two never share a line
export const PASS3_POLISH_B_VIEWER = 'components/presentation-viewer.tsx'
export const PASS3_POLISH_B_BUILDER = 'app/builder/page.tsx'

/** The two app files whose existing lines other pins hold to a base commit: only marked lines are added to them. */
export const PASS3_POLISH_B_FILES = [PASS3_POLISH_B_VIEWER, PASS3_POLISH_B_BUILDER]

/** The older pins this change had to teach (the ones that failed on this change's lines in the viewer or the Builder page and passed on the base): [text the pin has now, text the base commit's pin has] per edit, whole lines, so putting them back gives the base file byte for byte. Each line the pin has now carries PASS3_POLISH_B_PIN_MARK. */
export const PASS3_POLISH_B_PIN_MARK = '// LATER-CHANGES: registry read (PASS3-POLISH-B)'
export const PASS3_POLISH_B_PIN_EDITS = {
  "scripts/test-studio-version-history-v2.mjs": [
    ["import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (PASS3-POLISH-B)\n",
     ""],
    ["const read = rel => stripP2Polish(rel, stripFirstPaint(rel, stripLaunchWording(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))))) // LATER-CHANGES: registry read (PASS3-POLISH-B)\n",
     "const read = rel => stripP2Polish(rel, stripFirstPaint(rel, stripLaunchWording(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))))\n"],
  ],
  "scripts/test-studio-rail-add-slide.mjs": [
    ["import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (PASS3-POLISH-B)\n",
     ""],
    ["const read = rel => stripFirstPaint(rel, stripLaunchWording(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))) // LATER-CHANGES: registry read (PASS3-POLISH-B)\nconst withoutFirstPaint = lines => lines.filter(line => !belongsToFirstPaint(line) && !line.includes('PASS3-POLISH-B')) // LATER-CHANGES: registry read (PASS3-POLISH-B)\n",
     "const read = rel => stripFirstPaint(rel, stripLaunchWording(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))\nconst withoutFirstPaint = lines => lines.filter(line => !belongsToFirstPaint(line))\n"],
  ],
  "scripts/test-studio-first-paint-viewer.mjs": [
    ["import { stripPass3PolishB } from './studio-pass3-polish-b-strip.mjs' // LATER-CHANGES: registry read (PASS3-POLISH-B)\n",
     ""],
    ["const read = rel => stripPass3PolishB(rel, fs.readFileSync(path.join(root, rel), 'utf8')) // LATER-CHANGES: registry read (PASS3-POLISH-B)\n",
     "const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')\n"],
  ],
  "scripts/test-studio-blocked-send-feedback.mjs": [
    ["import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (PASS3-POLISH-B)\n",
     ""],
    ["const pageText = stripLaterChanges('app/builder/page.tsx', read('app/builder/page.tsx')) // LATER-CHANGES: registry read (PASS3-POLISH-B)\n",
     "const pageText = read('app/builder/page.tsx')\n"],
  ],
  "scripts/studio-chat-harness/page-extract.mjs": [
    ["import { stripLaterChanges } from '../studio-later-changes.mjs' // LATER-CHANGES: registry read (PASS3-POLISH-B)\n",
     ""],
    ["  const text = stripLaterChanges(file.endsWith('app/builder/page.tsx') ? 'app/builder/page.tsx' : file, fs.readFileSync(file, 'utf8')) // LATER-CHANGES: registry read (PASS3-POLISH-B)\n",
     "  const text = fs.readFileSync(file, 'utf8')\n"],
  ],
}

/** The pin without this change's edits (the base commit's file). Used by the proof only. */
export function putBackPin(rel, text) {
  return (PASS3_POLISH_B_PIN_EDITS[rel] || []).reduce((out, [has, base]) => out.replace(has, () => base), text)
}

/** The older pins (and the one chat harness helper) this change teaches: five files; scripts/test-studio-first-paint-viewer.mjs is COMPOSER-2's and is listed separately in the report. */
export const PASS3_POLISH_B_PIN_FILES = Object.keys(PASS3_POLISH_B_PIN_EDITS)

/** New files (no base text to put back). */
export const PASS3_POLISH_B_NEW_FILES = [
  'lib/studio-pass3-polish-b.ts',
  'scripts/studio-pass3-polish-b-strip.mjs',
  'scripts/test-studio-pass3-polish-b.mjs',
]

/** Files this change edits that are not app code: the registry (two lines: its files and its strip) and the three older pins that read the viewer (one registry-read edit each, see PASS3_POLISH_B_PIN_EDITS). */
export const PASS3_POLISH_B_OWN_EDITS = ['scripts/studio-later-changes.mjs', ...PASS3_POLISH_B_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PASS3_POLISH_B_SCOPE_FILES = new Set([...PASS3_POLISH_B_FILES, ...PASS3_POLISH_B_NEW_FILES, ...PASS3_POLISH_B_OWN_EDITS])

/** The file without this change's lines: every line that carries the marker is taken out, every other byte stays. Any other file is returned as it is. */
export function stripPass3PolishB(rel, text) {
  if (!PASS3_POLISH_B_FILES.includes(rel) || typeof text !== 'string') return text
  return text.split('\n').filter(line => !line.includes(PASS3_POLISH_MARKER)).join('\n')
}
