// FRONTEND-2 (B52, 30 Oct; PK UAT feedback F-03). Flag NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE (exact "true", default off, build-time; it acts only with NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 on): the chat stays full-width through Director's clarifying
// questions and the deck stage opens only when the strawman or the build streams, the deck is ready, or the user asks (a typed phrase, Blank canvas, Add Slide); then it stays open for the session.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker STUDIO-STAGE-OPEN-GATE (a whole token): app/builder/page.tsx (the gate step beside studioFirstRunStage, the stage attribute beside
// data-studio-first-run-stage, one import at the end), components/builder/studio-first-run.css (the rules keyed to data-studio-stage-gate="closed") and components/builder/chat/studio-director-header.tsx (PK Q1: the
// "Show canvas" button while the gate is closed: one line at the actions slot, one import at the end). Strip those lines and each file is its base, byte for byte.
// The new lib lib/studio-stage-open-gate.ts holds the flag, the phrase list, the triggers and the latch.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines), and teaches the two older proofs that read the Director header
// raw with an import allow-list or an import pin (STAGE_OPEN_GATE_PIN_EDITS). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'a470679ca8e198557b2a6f9848e568324305d371' // origin/studio-v4-dev-preparation-code with #553 merged: dev, which this change is cut from
export const STAGE_OPEN_GATE_FLAG = 'NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE'
export const STAGE_OPEN_GATE_MARKER = 'STUDIO-STAGE-OPEN-GATE'
/** The marker as a WHOLE token: STUDIO-STAGE-OPEN-GATE-X and X-STUDIO-STAGE-OPEN-GATE are not it. */
export const STAGE_OPEN_GATE_MARKER_RE = /(?<![\w-])STUDIO-STAGE-OPEN-GATE(?![\w-])/
/** The subject prefix of this change's own commits. */
export const STAGE_OPEN_GATE_SUBJECT = 'Stage open gate:'

/** Existing files that get marked lines (pure insertions only). */
export const STAGE_OPEN_GATE_FILES = [
  'app/builder/page.tsx',
  'components/builder/studio-first-run.css',
  'components/builder/chat/studio-director-header.tsx', // PK Q1: the "Show canvas" button while the gate is closed
]

/** New files (no base text to put back). */
export const STAGE_OPEN_GATE_NEW_FILES = [
  'lib/studio-stage-open-gate.ts',
  'components/builder/chat/studio-stage-show-canvas.tsx',
  'components/builder/chat/studio-stage-gate-show-canvas.css',
  'scripts/studio-stage-open-gate-strip.mjs',
  'scripts/test-studio-stage-open-gate.mjs',
  'scripts/fixtures/studio-stage-open-gate/director2-pk-f03/scenario-A.json', // DIRECTOR-2's recording of a new session for F-03 (workspace b88aca96, streams/director2/pk-f03-new-session), byte for byte: the main proof frames
  'scripts/fixtures/studio-stage-open-gate/director2-pk-f03/scenario-A-label-approve-and-build.json',
  'scripts/fixtures/studio-stage-open-gate/director2-pk-f03/scenario-B1.json',
  'scripts/fixtures/studio-stage-open-gate/director2-pk-f03/scenario-B2.json',
  'scripts/fixtures/studio-stage-open-gate/director2-pk-f03/provenance.json',
  'scripts/fixtures/studio-stage-open-gate/b-questions-mdc1.json', // DIRECTOR-2's preview-b recording (a fresh session's brief and the clarifying question card), byte for byte: extra cases
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file. Every line the proof has now carries a registry-read mark. */
export const STAGE_OPEN_GATE_PIN_MARK = 'LATER-CHANGES: registry read (STUDIO-STAGE-OPEN-GATE)'
export const STAGE_OPEN_GATE_PIN_EDITS = {
  // the first-parent scope check of test-studio-chat-element-edit.mjs: a branch stacked after this change has this change's commits on the first-parent line
  "scripts/test-studio-chat-element-edit.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Stage open gate:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (STUDIO-STAGE-OPEN-GATE): on a branch stacked after this change (the stage open gate's), the first-parent commits are its own, not this change's; with none left the pins and identity checks above cover the files\n", ""],
  ],
  // the first-parent scope check of test-studio-deck-sync-truth.mjs: a branch stacked after this change has this change's commits on the first-parent line
  "scripts/test-studio-deck-sync-truth.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Stage open gate:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (STUDIO-STAGE-OPEN-GATE): on a branch stacked after this change (the stage open gate's), the first-parent commits are its own, not this change's; with none left the pins and identity checks above cover the files\n", ""],
  ],
  // its D6 import-lines pin and its source pins read the Director header raw: the header's two marked lines come out first (put back: the plain read)
  "scripts/test-studio-pass2b-chat.mjs": [
    ["  const stageOpenGateStrip = await import('./studio-stage-open-gate-strip.mjs') // LATER-CHANGES: registry read (STUDIO-STAGE-OPEN-GATE): the stage open gate's marked lines (the Director header's \"Show canvas\" line and import) come out of a source before the pins below read it\n  const read = relative => stageOpenGateStrip.stripStageOpenGate(relative, fs.readFileSync(path.join(root, relative), 'utf8')) // LATER-CHANGES: registry read (STUDIO-STAGE-OPEN-GATE)\n",
     "  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')\n"],
  ],
  // its header loader has an allow-list of imports: the "Show canvas" import is answered as with the flag off (put back: the list without it)
  "scripts/test-studio-chat-header-ask.mjs": [
    ["  const headerImports = { 'lucide-react': { Sparkles: 'Sparkles' }, 'react/jsx-runtime': { jsx, jsxs: jsx }, './studio-director-header.css': {}, './studio-stage-show-canvas': { STUDIO_STAGE_OPEN_GATE_ENABLED: false, StudioStageShowCanvas: () => null } } // LATER-CHANGES: registry read (STUDIO-STAGE-OPEN-GATE): the stage open gate's \"Show canvas\" import, as with its flag off (its own proof, test-studio-stage-open-gate, covers it on)\n",
     "  const headerImports = { 'lucide-react': { Sparkles: 'Sparkles' }, 'react/jsx-runtime': { jsx, jsxs: jsx }, './studio-director-header.css': {} }\n"],
  ],
}

/** The proof without this change's edits (the previous file). */
export function putBackPin(rel, text) {
  return (STAGE_OPEN_GATE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const STAGE_OPEN_GATE_PIN_FILES = Object.keys(STAGE_OPEN_GATE_PIN_EDITS)

export const STAGE_OPEN_GATE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...STAGE_OPEN_GATE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const STAGE_OPEN_GATE_SCOPE_FILES = new Set([...STAGE_OPEN_GATE_FILES, ...STAGE_OPEN_GATE_NEW_FILES, ...STAGE_OPEN_GATE_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const STAGE_OPEN_GATE_ENV_BLOCK = `# STUDIO STAGE OPEN GATE (FRONTEND-2, B52; PK UAT feedback F-03, 30 Oct: the first chat message split the screen and showed an empty deck stage while Director was still asking its clarifying questions).
# On for the exact value "true"; default off, and then the stage appears exactly as today. Build-time value: change it on Vercel and redeploy. It acts only with NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 on.
# On, in a session that started fresh in this tab, the chat keeps the whole workspace after the first message, and the stage stays out of sight, until the FIRST of: the strawman or the build starts streaming, the deck is ready,
# or the user asks (a short fixed phrase list in lib/studio-stage-open-gate.ts, e.g. "show me the deck", "add a slide"; Start on a blank canvas; Add Slide). Then it stays open for that session. A restored session with a deck opens
# with the stage at once; a workflow link, fullscreen or an open inspector shows it as today. No new request, no Director change.
NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripStageOpenGate(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in STAGE_OPEN_GATE_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!STAGE_OPEN_GATE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !STAGE_OPEN_GATE_MARKER_RE.test(line)).join('\n')
}
