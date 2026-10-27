// FRONTEND-2 (B37; OPS-2's RISK of 27 Oct 22:15Z, E2E-2's F8 re-check on Studio dev, session 57f9e99a). Flag NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE (exact "true", default off, build-time): two fixes to #521's model choice
// (NEXT_PUBLIC_STUDIO_MODEL_CHOICE, ON on Studio dev), both seen on "This presentation" (the deck scope) after the router bundle put PREFS_SESSION_SCOPE_ENABLED on (router uat c19a384f).
//   1. Every deck save answered 412 preferences_modified. The router does not refuse it (ROUTER-2, app/read_api.py at c19a384f: the deck PUT :357 has no precondition, the deck GET :339 always sends a strong ETag, :708 _set_validators).
//      The 412 is Studio's own stale-read check in lib/studio-model-choice-server.ts handlePrefs, which compares the browser's If-Match with the deck GET's tag by plain string equality. With the flag on, the deck scope compares the
//      OPAQUE tags (a W/ mark and the quotes are not part of the value), so a tag that came back weakened on its way through the edge is still the same read; a different tag is still refused (a real concurrent change answers 412).
//   2. The popover said "Saved to your account. Applies from the next build." whatever happened. That line is the picker's standing note about where choices are kept (lib/studio-model-picker.ts saveNote, by mode), and the words of a failed
//      save (MODEL_CHOICE_CONFLICT ...) reach only the screen-reader status. With the flag on, in account mode the note is "Saved ..." only after a save the server confirmed, the failed save's own (existing) words after one that failed,
//      and nothing before a save. Device and no-storage notes are unchanged: they were true already.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker MODEL-CHOICE-DECK-SAVE (matched as a whole token; #521's MODEL-CHOICE is another token): lib/studio-model-choice-server.ts (the flag, the
// tag comparison, one line before the stale-read check) and components/model-choice/use-model-choice.ts (the flag, one state, two lines in select and the load effect, one override of saveNote in the return). Strip those lines and each file is
// its base, byte for byte. No new file in lib/ or components/ and no new import in either file, so the loaders of the older proofs (which hand a module only the imports it had) need no edit.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'ffaf5a7eb883b35bf8ff4806a4a3b1b9c13cefe5' // origin/studio-v4-dev-preparation-code with #538 (chat element edit 2) merged: dev, which this change is cut from
export const MODEL_CHOICE_DECK_SAVE_FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE'
export const MODEL_CHOICE_DECK_SAVE_MARKER = 'MODEL-CHOICE-DECK-SAVE'
/** The marker as a WHOLE token: MODEL-CHOICE (#521's) or X-MODEL-CHOICE-DECK-SAVE are not this change's. */
export const MODEL_CHOICE_DECK_SAVE_MARKER_RE = /(?<![\w-])MODEL-CHOICE-DECK-SAVE(?![\w-])/
/** The subject prefix of this change's own commits. */
export const MODEL_CHOICE_DECK_SAVE_SUBJECT = 'Model choice deck save:'

/** Existing files that get marked lines (pure insertions only). */
export const MODEL_CHOICE_DECK_SAVE_FILES = [
  'lib/studio-model-choice-server.ts',
  'components/model-choice/use-model-choice.ts',
]

/** New files (no base text to put back). */
export const MODEL_CHOICE_DECK_SAVE_FIXTURE_DIR = 'scripts/fixtures/studio-model-choice-deck-save'
export const MODEL_CHOICE_DECK_SAVE_FIXTURES = ['e2e2-f8-recorded.json', 'router-session-get-empty-200.json', 'router-session-put-200.json'].map(name => `${MODEL_CHOICE_DECK_SAVE_FIXTURE_DIR}/${name}`)
export const MODEL_CHOICE_DECK_SAVE_NEW_FILES = [
  'scripts/studio-model-choice-deck-save-strip.mjs',
  'scripts/test-studio-model-choice-deck-save.mjs',
  ...MODEL_CHOICE_DECK_SAVE_FIXTURES,
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries MODEL_CHOICE_DECK_SAVE_PIN_MARK. */
export const MODEL_CHOICE_DECK_SAVE_PIN_MARK = '// LATER-CHANGES: registry read (MODEL-CHOICE-DECK-SAVE)'
export const MODEL_CHOICE_DECK_SAVE_PIN_EDITS = {}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (MODEL_CHOICE_DECK_SAVE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const MODEL_CHOICE_DECK_SAVE_PIN_FILES = Object.keys(MODEL_CHOICE_DECK_SAVE_PIN_EDITS)

export const MODEL_CHOICE_DECK_SAVE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...MODEL_CHOICE_DECK_SAVE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const MODEL_CHOICE_DECK_SAVE_SCOPE_FILES = new Set([...MODEL_CHOICE_DECK_SAVE_FILES, ...MODEL_CHOICE_DECK_SAVE_NEW_FILES, ...MODEL_CHOICE_DECK_SAVE_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const MODEL_CHOICE_DECK_SAVE_ENV_BLOCK = `# STUDIO MODEL CHOICE DECK SAVE (FRONTEND-2, B37; E2E-2's F8 re-check on Studio dev, 27 Oct). On for the exact value "true"; default off, and then model choice (NEXT_PUBLIC_STUDIO_MODEL_CHOICE) behaves exactly as today. Build-time value: change it on Vercel and redeploy.
# On, two fixes to "This presentation": (1) a deck save is no longer refused 412 when the browser's If-Match is the deck's own tag in another form (the edge may send the router's strong tag on as W/"..."): Studio's stale-read check compares the opaque tags, and a really
# different tag (another tab saved first) is still refused; (2) the picker says "Saved to your account" only after a save the account confirmed, the words of a failed save (changed elsewhere, refused, not available) after one that failed, and nothing before a save. No router change, no new text.
NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripModelChoiceDeckSave(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in MODEL_CHOICE_DECK_SAVE_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!MODEL_CHOICE_DECK_SAVE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !MODEL_CHOICE_DECK_SAVE_MARKER_RE.test(line)).join('\n')
}
