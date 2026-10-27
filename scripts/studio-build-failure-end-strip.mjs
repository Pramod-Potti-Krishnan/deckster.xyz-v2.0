// FRONTEND-2 (B27, E2E-2 chat parity Pass A, 27 Oct). Flag NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END (exact "true", default off, build-time): when Director's turn opens "Building your slides..." with a status_update and then
// closes with one chat message and no terminal frame, Studio leaves the building state (no "0 of N built", no Pause / Stop, no "Building slides" hint) and Director's reply is the last word.
// The case: a typed approval that is not the exact J1 phrase falls through to Director's legacy invoke_tools; its tools fail; Director sends status_update "Generating presentation content...", then the failure chat_message, then
// token_usage, and no build_phase, build_event, slide_built or terminal status (streams/director2/build-failure-frames/FINDINGS.md). Studio's narration read that status as "building" and nothing ever ended it.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker BUILD-FAILURE-END (matched as a whole token): app/builder/page.tsx (one: the flag into the narration hook), hooks/use-build-narration.ts
// (the input, two refs, four counters, one effect) and lib/build-narration-heuristics.ts (an action, a guard, a case). Strip those lines and each file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). The chat harness parses the page through the registry, so its page-region
// anchors stay the base's; this change's proof takes the strip out in its own process to run the page with its line. Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'a0ff9d4596fd9905e80ecd96682a454c1bf9ab60' // studio-v4-dev-preparation-code with #522 (chat element edit) and #532 (chat commands) merged: dev, which this change is merged with. (It was cut from 14a06c30, #530.)
export const BUILD_FAILURE_END_FLAG = 'NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END'
export const BUILD_FAILURE_END_MARKER = 'BUILD-FAILURE-END'
/** The marker as a WHOLE token: BUILD-FAILURE-END-X or X-BUILD-FAILURE-END are not this change's. */
export const BUILD_FAILURE_END_MARKER_RE = /(?<![\w-])BUILD-FAILURE-END(?![\w-])/
/** The subject prefix of this change's own commits. */
export const BUILD_FAILURE_END_SUBJECT = 'Build failure end:'

/** Existing files that get marked lines (pure insertions only). */
export const BUILD_FAILURE_END_FILES = [
  'app/builder/page.tsx',
  'hooks/use-build-narration.ts',
  'lib/build-narration-heuristics.ts',
]

/** New files (no base text to put back). */
export const BUILD_FAILURE_END_NEW_FILES = [
  'scripts/studio-build-failure-end-strip.mjs',
  'scripts/test-studio-build-failure-end.mjs',
  'scripts/fixtures/build-failure-end/outline-gate-typed-approval-failure.json',
  'scripts/fixtures/build-failure-end/baselines/flag-off.json',
]

/** Files this change edits that are neither app code with marked lines nor new: its .env.example block and the registry (three lines). It teaches no older proof: dev's own chat theme / export proof (#522) reads the page through the registry. */
export const BUILD_FAILURE_END_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const BUILD_FAILURE_END_SCOPE_FILES = new Set([...BUILD_FAILURE_END_FILES, ...BUILD_FAILURE_END_NEW_FILES, ...BUILD_FAILURE_END_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const BUILD_FAILURE_END_ENV_BLOCK = `# STUDIO BUILD FAILURE END (FRONTEND-2; E2E-2 chat parity Pass A, 27 Oct). On for the exact value "true"; default off, and then the build state behaves exactly as today. Build-time value: change it on Vercel and redeploy.
# On: when Director's turn opens "Building your slides..." with a status update, no build frame (build_phase, build_event, slide_built) arrives while it is on screen, and the turn then ends with a chat message (Director's reply
# that the content could not be generated), Studio leaves the building state: no "0 of N built", no Pause / Stop, no "Building slides" under the composer, and Director's reply is the last word. A build that sends build frames, a
# paused or stopped build, a build accepted with the button and a deck that is built are never touched. No new text, no Director change.
NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripBuildFailureEnd(rel, text) {
  if (typeof text !== 'string') return text
  if (!BUILD_FAILURE_END_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !BUILD_FAILURE_END_MARKER_RE.test(line)).join('\n')
}
