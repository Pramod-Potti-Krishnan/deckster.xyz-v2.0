// FRONTEND-1 (F-14, the simplified Studio model picker; PK's final of 4 Nov). Flag NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE (exact "true", build-time, default off), and only where the picker is on (NEXT_PUBLIC_STUDIO_MODEL_CHOICE): the composer's slider picker
// (<ModelPicker variant="slider">, mounted by chat clean) opens a calmer popover, and on a phone a bottom sheet: the preset's name as the title, under it the writing model the router resolves for it (read from the catalogue) with a chevron that opens a read-only
// per-step list and "Choose a specific model...", one slider over Fast / Balanced / Best / Max (Quick stays out; PK's small relative-cost marker was tried and dropped: it did not fit one line with the names), a reset icon, a plain Advanced row that holds the slider's own rows when open, and none of the slider's extra text. A stop still saves the PRESET only.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker MODEL-PICKER-SIMPLE (a whole token): components/model-choice/model-picker.tsx (two imports and the one early return that picks the new picker) and scripts/studio-model-picker-kit.mjs
// (the proofs' module loader: two file names, the two modules, and the two names the picker module now imports). No existing line is rewritten. Strip the marked lines and each file is its base, byte for byte.
// The two older proofs that read the first-parent line of BASE..HEAD for their own commits' subjects (phone hints taught them to leave "Phone hints:" commits out) are taught one more inserted line each, for "Model picker:" (tests only, registry-read marks).
// A new fixture, scripts/fixtures/studio-model-choice/catalogue-router-map.json, carries ROUTER-1's preset map of 3 Nov (21:45Z); catalogue-five-presets.json is left as it is because the model-choice proofs pin its values.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '3e1ce88eec23fbfd33f249332d06a65ad05ffc40' // origin/studio-v4-dev-preparation-code (#564 merged) at the start of this change
export const MODEL_PICKER_SIMPLE_FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE'
export const MODEL_PICKER_SIMPLE_MARKER = 'MODEL-PICKER-SIMPLE'
/** The marker as a WHOLE token: MODEL-PICKER-SIMPLE-X and X-MODEL-PICKER-SIMPLE are not it. */
export const MODEL_PICKER_SIMPLE_MARKER_RE = /(?<![\w-])MODEL-PICKER-SIMPLE(?![\w-])/
/** The subject prefix of this change's own commits. */
export const MODEL_PICKER_SIMPLE_SUBJECT = 'Model picker:'

/** Existing files that get marked lines. */
export const MODEL_PICKER_SIMPLE_FILES = ['components/model-choice/model-picker.tsx', 'scripts/studio-model-picker-kit.mjs']

/** New files (no base text to put back). */
export const MODEL_PICKER_SIMPLE_NEW_FILES = [
  'lib/studio-model-picker-simple.ts',
  'components/model-choice/model-picker-simple.tsx',
  'components/model-choice/model-picker-simple.css',
  'scripts/fixtures/studio-model-choice/catalogue-router-map.json',
  'scripts/studio-model-picker-simple-strip.mjs',
  'scripts/test-studio-model-picker-simple.mjs',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file. Every line the proof has now carries a registry-read mark. */
export const MODEL_PICKER_SIMPLE_PIN_MARK = 'LATER-CHANGES: registry read (MODEL-PICKER-SIMPLE)'
const TAUGHT_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Model picker:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (MODEL-PICKER-SIMPLE): on a branch stacked after this change (the simplified model picker's), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
export const MODEL_PICKER_SIMPLE_PIN_EDITS = {
  'scripts/test-studio-deck-sync-truth.mjs': [[TAUGHT_LINE, '']],
  'scripts/test-studio-chat-element-edit.mjs': [[TAUGHT_LINE, '']],
}

/** The proof without this change's edits (the previous file). */
export function putBackPin(rel, text) {
  return (MODEL_PICKER_SIMPLE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const MODEL_PICKER_SIMPLE_PIN_FILES = Object.keys(MODEL_PICKER_SIMPLE_PIN_EDITS)

/** Files this change edits that are neither marked app code nor new: its .env.example block, the registry (three lines) and the older proofs it teaches. */
export const MODEL_PICKER_SIMPLE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...MODEL_PICKER_SIMPLE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const MODEL_PICKER_SIMPLE_SCOPE_FILES = new Set([...MODEL_PICKER_SIMPLE_FILES, ...MODEL_PICKER_SIMPLE_NEW_FILES, ...MODEL_PICKER_SIMPLE_OWN_EDITS])

/** The whole .env.example block: its comments and its line. */
export const MODEL_PICKER_SIMPLE_ENV_BLOCK = `# STUDIO MODEL PICKER SIMPLE (FRONTEND-1; F-14, PK's final of 4 Nov). On for the exact value "true" AND only together with NEXT_PUBLIC_STUDIO_MODEL_CHOICE (and NEXT_PUBLIC_STUDIO_MODEL_CATALOG for the model names); default off, and then the composer's slider picker is exactly as before. Build-time value: change it on Vercel and redeploy.
# On, the composer's model button opens a calmer popover (a bottom sheet on a phone): the current preset's name as the title (Fast, Balanced, Best, Max; Auto or Custom off the scale), under it the writing model the router resolves for it, read from the catalogue, with a chevron that opens a read-only per-step list
# and "Choose a specific model...", one slider with a thicker bar, a reset icon at the top right ("Use my default" on a deck, Auto otherwise) and a plain Advanced row that holds the slider's own rows. None of the slider's legend, hint, footer or notes. A stop saves the preset only, as before.
NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripModelPickerSimple(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in MODEL_PICKER_SIMPLE_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!MODEL_PICKER_SIMPLE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !MODEL_PICKER_SIMPLE_MARKER_RE.test(line)).join('\n')
}
