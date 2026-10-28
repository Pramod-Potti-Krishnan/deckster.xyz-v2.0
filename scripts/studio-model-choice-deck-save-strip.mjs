// FRONTEND-2 (B37; OPS-2's RISK of 27 Oct 22:15Z, E2E-2's F8 re-check on Studio dev, session 57f9e99a). Flag NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE (exact "true", default off, build-time): two fixes to #521's model choice
// (NEXT_PUBLIC_STUDIO_MODEL_CHOICE, ON on Studio dev), first seen on "This presentation" (the deck scope) after the router bundle put PREFS_SESSION_SCOPE_ENABLED on (router uat c19a384f), and on "Reusable defaults" (the user scope)
// by the same cause (E2E-2's $0 capture, 27 Oct 22:49Z, session 57f9e99a: the deck GET and the user GET both came back with ETag W/"4f53cda18c2baa0c0354bb5f9a3ecbe5", compressed by Vercel; the PATCH sent If-Match W/"4f53..." and got 412).
//   1. Every deck save answered 412 preferences_modified. The router does not refuse it (ROUTER-2, app/read_api.py at c19a384f: the deck PUT :357 has no precondition, the deck GET :339 always sends a strong ETag, :708 _set_validators).
//      The 412 is Studio's own stale-read check in lib/studio-model-choice-server.ts handlePrefs, which compares the browser's If-Match with the router's tag by plain string equality. With the flag on, BOTH scopes compare the
//      OPAQUE tags (a W/ mark and the quotes are not part of the value), so a tag that came back weakened on its way through the edge is still the same read; a different tag is still refused (a real concurrent change answers 412).
//      The router's own user PATCH still gets the router's strong tag as If-Match (its precondition keeps working: a write that races Studio's read is refused 412 by the router); the deck PUT has none.
//   2. The popover said "Saved to your account. Applies from the next build." whatever happened. That line is the picker's standing note about where choices are kept (lib/studio-model-picker.ts saveNote, by mode), and the words of a failed
//      save (MODEL_CHOICE_CONFLICT ...) reach only the screen-reader status. With the flag on, in account mode (either scope) the note is "Saved ..." only after a save the server confirmed, the failed save's own (existing) words after one
//      that failed, and nothing before a save. Device and no-storage notes are unchanged: they were true already. The Intelligence page (components/studio-personal/intelligence-model-choice.tsx) is not touched: its pill follows the stored choices
//      and its feedback line is set only by the save's own outcome.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker MODEL-CHOICE-DECK-SAVE (matched as a whole token; #521's MODEL-CHOICE is another token): lib/studio-model-choice-server.ts (the flag, the
// tag comparison, one line before the stale-read check) and components/model-choice/use-model-choice.ts (the flag, one state, two lines in select and the load effect, one override of saveNote in the return). Strip those lines and each file is
// its base, byte for byte. No new file in lib/ or components/ and no new import in either file, so the loaders of the older proofs (which hand a module only the imports it had) need no edit.
// Two older proofs are taught (MODEL_CHOICE_DECK_SAVE_PIN_EDITS): #521's scripts/test-studio-model-choice.mjs held the server lib to "reads no other public flag" on the raw file; #538's scripts/test-studio-chat-element-edit-2.mjs
// held the registry to "gains exactly its three marked lines" on the raw BASE..HEAD diff. The marked lines of a later change are now its own.
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
export const MODEL_CHOICE_DECK_SAVE_PIN_EDITS = {
  // #521's proof holds the server lib to "reads no other public flag" on the raw file: the lines of a later change are its own (this one reads NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE on marked lines).
  "scripts/test-studio-model-choice.mjs": [
    [
      "    const serverCode = read(SERVER).split('\\n').filter(line => !/(?<![\\w-])MODEL-CHOICE-DECK-SAVE(?![\\w-])/.test(line)).join('\\n').replace(/\\/\\/.*$/gm, '').replace(/\\/\\*[\\s\\S]*?\\*\\//g, '') // LATER-CHANGES: registry read (MODEL-CHOICE-DECK-SAVE): a change registered after this one may read a flag of its own in the server lib (deck save); its marked lines are its own\n",
      "    const serverCode = read(SERVER).replace(/\\/\\/.*$/gm, '').replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')\n"
    ]
  ],
  // #538's proof holds the registry to "gains exactly its three marked lines" on the raw BASE..HEAD diff: the lines of every change registered after it (this one's three) are theirs. Generic: whatever sits below #538's own line in each list, in the registered shape.
  "scripts/test-studio-chat-element-edit-2.mjs": [
    [
      "  const laterRegistry = (() => { const later = new Set(); let after = false; for (const line of git('show', 'HEAD:scripts/studio-later-changes.mjs').split('\\n')) { if (/^export const LATER_/.test(line)) after = false; else if (line.includes('studio-chat-element-edit-2-strip.mjs')) after = true; else if (after && line.includes('// LATER-CHANGE:') && /-strip\\.mjs/.test(line)) later.add(line) } return later })() // LATER-CHANGES: registry read (MODEL-CHOICE-DECK-SAVE), stacked after chat element edit 2: the registry lines of every change registered after this one (below this change's own line in each list, in the registered shape) are theirs, not this change's, so the count of three below reads past them\n  const diff = git('diff', '-U0', BASE_COMMIT, 'HEAD', '--', 'scripts/studio-later-changes.mjs').split('\\n').filter(line => /^[+-]/.test(line) && !/^(\\+\\+\\+|---) /.test(line) && !(line.startsWith('+') && laterRegistry.has(line.slice(1)))) // LATER-CHANGES: registry read (MODEL-CHOICE-DECK-SAVE), stacked after chat element edit 2: a line a later change added to the registry is its own\n",
      "  const diff = git('diff', '-U0', BASE_COMMIT, 'HEAD', '--', 'scripts/studio-later-changes.mjs').split('\\n').filter(line => /^[+-]/.test(line) && !/^(\\+\\+\\+|---) /.test(line))\n"
    ]
  ]
}

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
# On, two fixes to model choice saves, "This presentation" and "Reusable defaults": (1) a save is no longer refused 412 when the browser's If-Match is the router's own tag in another form (Vercel sends the router's strong tag on as W/"..."): Studio's stale-read check compares the
# opaque tags, a really different tag (another tab saved first) is still refused, and the router still gets its own tag as If-Match; (2) the picker says "Saved to your account" only after a save the account confirmed, the words of a failed save (changed elsewhere, refused, not available) after one that failed, and nothing before a save. No router change, no new text.
NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripModelChoiceDeckSave(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in MODEL_CHOICE_DECK_SAVE_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!MODEL_CHOICE_DECK_SAVE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !MODEL_CHOICE_DECK_SAVE_MARKER_RE.test(line)).join('\n')
}
