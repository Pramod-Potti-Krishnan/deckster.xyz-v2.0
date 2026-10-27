// FRONTEND-1 (P3-1 D "flow control", Studio half, 26 Oct). Flags NEXT_PUBLIC_STUDIO_FLOW_FOCUS, NEXT_PUBLIC_STUDIO_FLOW_AMEND and NEXT_PUBLIC_STUDIO_FLOW_AMEND_INSTRUCTIONS (the string "true", default off, build-time):
// the stage follows the slide Director built or changed, and a paused or stopped build can be steered from the chat (Resume, or Rebuild with the typed text). Every decision is lib/studio-flow-control.ts (pure);
// hooks/use-studio-flow-control.ts holds the state; components/build-narration/flow-amend-bar.tsx draws the line and the two buttons.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker FLOW-CONTROL (matched as a whole token): app/builder/page.tsx (the flow hook's call, the slide-change tap and the bar, all after
// the Builder's runners, and one import placed after the Builder content), hooks/use-deckster-websocket-v2.ts (one import, the frame tap, the build_phase tap, the read of the instructions and two `instructions` spreads),
// types/build-narration.ts (three optional fields) and components/build-narration/use-stage-walkthrough.ts (one import and one line: the narration's own page turn tells the flow hook before the viewer reports it,
// so that report is not read as the user navigating). No existing line of app code is rewritten (a later change that stacks on this one, or one this is stacked on, may only insert too).
// Strip the marked lines and each file is its base, byte for byte.
// A follow-up ("Flow control: one held-state line ...", 26 Oct) adds one more file to that list, components/build-narration/director-presence.tsx (the chat's presence row): while the amend bar is drawn and the build is held, the row
// drops its dot and its "Paused - your progress is saved" words (the bar says it, with the buttons) and keeps its Build log toggle. Five marked lines, pure insertions: one import, the decision and its early return, and the two lines that
// wrap the dot and the words in a fragment. It was cut from a studio head that already holds the change above (FOLLOW_UP_BASE_COMMIT), so its own checks read that base, not BASE_COMMIT.
// One older proof is taught to read through the registry, as FRONTEND-2's perceived-speed change taught three: the perceived-speed proof's scope check reads the committed diff BASE..HEAD and wants exactly its own
// files, which a registered later change's files are not. Each taught line is one whole line that carries the marker and replaces one whole line; FLOW_CONTROL_EDITS holds [line now, line before] and
// stripFlowControl puts the old line back, so a proof that holds that file to a base reads it as it was. (The theme/export proof slices the page by the positions of a parse that does not see this change's lines:
// nothing of this change comes before the Builder's runners in app/builder/page.tsx, so that proof is not touched.)
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '875334faa648ed72e63b260457ca2fc0a2020c0c' // origin/studio-v4-dev-preparation-code at the start of this change (#518)
export const FOLLOW_UP_BASE_COMMIT = '14a06c3053047acc7f6a613afd1138dabf4a3c54' // origin/studio-v4-dev-preparation-code (#530 merged) at the start of the held-state follow-up: this change is already in it
export const FLOW_CONTROL_FLAGS = ['NEXT_PUBLIC_STUDIO_FLOW_FOCUS', 'NEXT_PUBLIC_STUDIO_FLOW_AMEND', 'NEXT_PUBLIC_STUDIO_FLOW_AMEND_INSTRUCTIONS']
export const FLOW_CONTROL_MARKER = 'FLOW-CONTROL'
/** The marker as a WHOLE token: FLOW-CONTROL-X or X-FLOW-CONTROL are not this change's. */
export const FLOW_CONTROL_MARKER_RE = /(?<![\w-])FLOW-CONTROL(?![\w-])/

/** Existing files that get marked lines, as the change first shipped (read against BASE_COMMIT). */
export const FLOW_CONTROL_ORIGINAL_FILES = ['app/builder/page.tsx', 'hooks/use-deckster-websocket-v2.ts', 'types/build-narration.ts', 'components/build-narration/use-stage-walkthrough.ts']

/** Existing files the held-state follow-up adds marked lines to (read against FOLLOW_UP_BASE_COMMIT). */
export const FLOW_CONTROL_FOLLOW_UP_FILES = ['components/build-narration/director-presence.tsx']

/** Existing files that get marked lines. */
export const FLOW_CONTROL_FILES = [...FLOW_CONTROL_ORIGINAL_FILES, ...FLOW_CONTROL_FOLLOW_UP_FILES]

/** The older proof this change teaches: [line now, line before] per edit, whole lines (a line now carries the marker and occurs once in its file; the line before is the base's). */
export const FLOW_CONTROL_EDITS = {
  "scripts/test-studio-speed-perceived.mjs": [
    [
      "  const changed = git('diff', '--name-only', `${BASE}..${HEAD}`).split('\\n').filter(Boolean).filter(rel => stripModule.SPEED_PERCEIVED_SCOPE_FILES.has(rel) || !registry.LATER_CHANGE_FILES.has(rel)).sort() // LATER-CHANGES: registry read (FLOW-CONTROL): a registered later change's files are its own\n",
      "  const changed = git('diff', '--name-only', `${BASE}..${HEAD}`).split('\\n').filter(Boolean).sort()\n",
    ],
    [
      "    const head = registry.stripLaterChanges(rel, git('show', `${HEAD}:${rel}`)), base = registry.stripLaterChanges(rel, git('show', `${BASE}:${rel}`)) // LATER-CHANGES: registry read (FLOW-CONTROL): the lines of the changes registered after this one come out of both sides first\n",
      "    const head = git('show', `${HEAD}:${rel}`), base = git('show', `${BASE}:${rel}`)\n",
    ],
    [
      "    const diff = git('diff', '-U0', `${BASE}..${HEAD}`, '--', rel).split('\\n').filter(line => /^[+-]/.test(line) && !/^(\\+\\+\\+|---) /.test(line)).filter(line => registry.stripLaterChanges(rel, `${line}\\n`) !== '') // LATER-CHANGES: registry read (FLOW-CONTROL): a later change's marked line is its own\n",
      "    const diff = git('diff', '-U0', `${BASE}..${HEAD}`, '--', rel).split('\\n').filter(line => /^[+-]/.test(line) && !/^(\\+\\+\\+|---) /.test(line))\n",
    ],
    [
      "  eq(registry.stripLaterEnvBlocks('.env.example', git('show', `${HEAD}:.env.example`)), registry.stripLaterEnvBlocks('.env.example', `${git('show', `${BASE}:.env.example`)}\\n${stripModule.SPEED_PERCEIVED_ENV_BLOCK}`), 'D: .env.example is the base plus the block') // LATER-CHANGES: registry read (FLOW-CONTROL): the blocks registered after this one come out of both sides first\n",
      "  eq(git('show', `${HEAD}:.env.example`), `${git('show', `${BASE}:.env.example`)}\\n${stripModule.SPEED_PERCEIVED_ENV_BLOCK}`, 'D: .env.example is the base plus the block')\n",
    ],
    [
      "  const registryDiff = git('diff', '-U0', `${BASE}..${HEAD}`, '--', 'scripts/studio-later-changes.mjs').split('\\n').filter(line => /^[+-]/.test(line) && !/^(\\+\\+\\+|---) /.test(line)).filter(line => !(line.startsWith('+') && line.includes('LATER-CHANGE') && !line.includes('studio-speed-perceived-strip.mjs'))) // LATER-CHANGES: registry read (FLOW-CONTROL): lines a later change registers are its own\n",
      "  const registryDiff = git('diff', '-U0', `${BASE}..${HEAD}`, '--', 'scripts/studio-later-changes.mjs').split('\\n').filter(line => /^[+-]/.test(line) && !/^(\\+\\+\\+|---) /.test(line))\n",
    ],
  ],
}

/** The proofs taught. */
export const FLOW_CONTROL_PIN_FILES = Object.keys(FLOW_CONTROL_EDITS)

/** New files (no base text to put back). */
export const FLOW_CONTROL_NEW_FILES = [
  'lib/studio-flow-control.ts',
  'hooks/use-studio-flow-control.ts',
  'components/build-narration/flow-amend-bar.tsx',
  'scripts/studio-flow-control-strip.mjs',
  'scripts/test-studio-flow-control.mjs',
]

/** Files this change edits that are neither marked app code nor new: its .env.example block, the registry (three lines) and the older proof it teaches. No package.json script: run the proof with `node scripts/test-studio-flow-control.mjs`. */
export const FLOW_CONTROL_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...FLOW_CONTROL_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const FLOW_CONTROL_SCOPE_FILES = new Set([...FLOW_CONTROL_FILES, ...FLOW_CONTROL_NEW_FILES, ...FLOW_CONTROL_OWN_EDITS])

/** The whole .env.example block: its comments and its three lines. */
export const FLOW_CONTROL_ENV_BLOCK = `# STUDIO FLOW FOCUS (FRONTEND-1; P3-1 D "flow control", Studio half). On only for the string "true"; default off, and then nothing changes: no listener, no timer, no navigation. Build-time value: change it on Vercel and redeploy.
# On: when Director changes or builds a slide of the deck on the stage (a deck_mutation, a change_recorded that names a slide, a partial slide_update, a slide_built or a slide_ready), the stage goes to that slide: the new position of a moved slide, 0-based on the wire
# except slide_update, which counts from 1 and is converted. On a narrow layout (one pane at a time) the stage pane is brought up first; a restored deck only brings the stage up. Frames for another deck, a deleted slide and build_event / slide_progress (they carry
# no presentation id) are ignored. Not for 4 s after the user navigated by hand (a pane switch, a rail click, a slide change in the viewer), and during a build only while the user has not navigated at all: the follow is of the newest built slide, once. Safe to set before any Director change.
NEXT_PUBLIC_STUDIO_FLOW_FOCUS="false"
# STUDIO FLOW AMEND (FRONTEND-1; P3-1 D). On only for the string "true" AND only together with NEXT_PUBLIC_BUILD_NARRATION and NEXT_PUBLIC_BUILD_CONTROL; default off, and then the chat and the composer are exactly as before. Build-time value.
# On: while a build is paused or stopped the composer can send (the reply gate that waits for Director is released, as Esc does), a calm line sits above it ("Paused - type changes, then Resume or Rebuild."), and two buttons: Resume, and "Rebuild with these instructions"
# (stop, wait for Director's build_phase "settled" for up to 8 s, then send the typed text as an ordinary message; the line says "Rebuilding once the last slide finishes" meanwhile). Director's build_phase "settled" is read here and never reaches the narration, so set this
# flag BEFORE Director's DIRECTOR_FLOW_STEER_ENABLED. A message sent while paused is queued by Director (build_phase paused, steer_pending): the line then says "Changes queued for resume."
NEXT_PUBLIC_STUDIO_FLOW_AMEND="false"
# STUDIO FLOW AMEND INSTRUCTIONS (FRONTEND-1; P3-1 D). On only for the string "true" together with the amend flag above; default off. Build-time value. On: Resume with typed text sends it in build_control {action: "resume", instructions} (cut to Director's 1000 characters), clears the box,
# and shows "Applied to slides N-M." when Director's building acknowledgement names the slides (applied_to). When applied_to is empty (the slides are already in progress) it says so plainly, puts the text back in the box and offers Rebuild.
# Leave it off until Director ships the field (DIRECTOR_FLOW_STEER_ENABLED): today nothing accepts it.
NEXT_PUBLIC_STUDIO_FLOW_AMEND_INSTRUCTIONS="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays (a taught proof gets its previous lines back). Any other file is returned as it is. */
export function stripFlowControl(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in FLOW_CONTROL_EDITS) return putBackFlowControlEdits(rel, text) // an older proof this change taught: its previous text, so a proof that holds it byte for byte reads it as it was
  if (!FLOW_CONTROL_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !FLOW_CONTROL_MARKER_RE.test(line)).join('\n')
}

/** The proof without this change's taught lines (the previous file). */
export function putBackFlowControlEdits(rel, text) {
  return (FLOW_CONTROL_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}
