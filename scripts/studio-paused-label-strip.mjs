// FRONTEND-2 (B27 follow-up, PROGRAM-1 GO 27 Oct 04:17Z; E2E-2 chat parity Pass A row 14). Flag NEXT_PUBLIC_STUDIO_PAUSED_LABEL (exact "true", default off, build-time): the build ribbon (components/build-narration/stage-ribbon.tsx)
// reads "Paused" (the existing label, lib/build-narration-heuristics.ts PHASE_LABELS.paused, which the proof holds equal to the one word in the ribbon) whenever the narration CONTROL state is paused. E2E-2's shot (streams/e2e2/parity-proofs/run-A/shots/05-row14-paused-header.png) showed
// "Building your slides..." with Resume: the reducer lets a "building" status move a paused build's phase back to building (the 'status' case: `proposed >= cur || next.phase === 'paused'`) while control stays paused, and the ribbon
// printed the phase label. Only the headline changes: the icon, the timer, the count and the buttons read what they read today. No new copy.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker PAUSED-LABEL (matched as a whole token): three in components/build-narration/stage-ribbon.tsx (a two-line comment, one assignment; no import line, so the guarded components' import-line pins are untouched).
// Strip those lines and the file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '14a06c3053047acc7f6a613afd1138dabf4a3c54' // studio-v4-dev-preparation-code with #530 (chat clean v3.1) merged: the commit this change is cut from
export const PAUSED_LABEL_FLAG = 'NEXT_PUBLIC_STUDIO_PAUSED_LABEL'
export const PAUSED_LABEL_MARKER = 'PAUSED-LABEL'
/** The marker as a WHOLE token: PAUSED-LABEL-X or X-PAUSED-LABEL are not this change's. */
export const PAUSED_LABEL_MARKER_RE = /(?<![\w-])PAUSED-LABEL(?![\w-])/
/** The subject prefix of this change's own commits. */
export const PAUSED_LABEL_SUBJECT = 'Paused label:'

/** Existing files that get marked lines (pure insertions only). */
export const PAUSED_LABEL_FILES = [
  'components/build-narration/stage-ribbon.tsx',
]

/** New files (no base text to put back). */
export const PAUSED_LABEL_NEW_FILES = [
  'scripts/studio-paused-label-strip.mjs',
  'scripts/test-studio-paused-label.mjs',
  'scripts/fixtures/paused-label/baselines/flag-off.json',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries PAUSED_LABEL_PIN_MARK. */
export const PAUSED_LABEL_PIN_MARK = '// LATER-CHANGES: registry read (PAUSED-LABEL)'
export const PAUSED_LABEL_PIN_EDITS = {}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (PAUSED_LABEL_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const PAUSED_LABEL_PIN_FILES = Object.keys(PAUSED_LABEL_PIN_EDITS)

export const PAUSED_LABEL_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...PAUSED_LABEL_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PAUSED_LABEL_SCOPE_FILES = new Set([...PAUSED_LABEL_FILES, ...PAUSED_LABEL_NEW_FILES, ...PAUSED_LABEL_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const PAUSED_LABEL_ENV_BLOCK = `# STUDIO PAUSED LABEL (FRONTEND-2; PROGRAM-1 GO 27 Oct). On for the exact value "true"; default off, and then the build ribbon reads exactly as today. Build-time value: change it on Vercel and redeploy.
# On: while a build is paused (its control state is paused) the build ribbon's headline reads "Paused", the label the build already has for that phase, instead of "Building your slides…" when a later status moved the phase back to building.
# Only the headline: the icon, the timer, the "N of M built" count and the Resume / Stop buttons are as today. No new text, no Director change.
NEXT_PUBLIC_STUDIO_PAUSED_LABEL="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripPausedLabel(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in PAUSED_LABEL_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!PAUSED_LABEL_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !PAUSED_LABEL_MARKER_RE.test(line)).join('\n')
}
