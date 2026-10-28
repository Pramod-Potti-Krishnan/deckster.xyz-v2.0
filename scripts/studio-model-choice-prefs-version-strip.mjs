// FRONTEND-2 (B37 follow-up; E2E-2's capture of 28 Oct 02:15-02:17Z on Studio dev with #542 merged at 88c59f3c and NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE on). Flag NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION (exact "true", default off,
// build-time). After #542 saves PERSIST (the GET shows the choice, it survives a reload) but EVERY PATCH answers 412, and the body is a Vercel HTML error page ("An error occurred · PRECONDITION_FAILED · iad1::..."), not Studio's JSON.
// The route passed the check and wrote; the edge then applied the request's If-Match to the function's RESPONSE, whose ETag changed with the write, and swapped in its own 412. The popover then said "Your choices changed elsewhere ...".
//   With the flag on, on BOTH scopes:
//   1. the browser sends the read's version in its own header, X-Prefs-Version, and never If-Match (the hook's and the Intelligence page's routeFetch move it; lib/studio-model-choice.ts versionRequest), so the edge has nothing conditional to evaluate;
//   2. the routes read X-Prefs-Version first (If-Match is still accepted, as today) and compare it as an opaque tag (the same compare as #542, for either scope), with the same 412 JSON for a really stale read; they send the version back
//      in X-Prefs-Version on every answer (ETag stays on a read). The router call is unchanged: Studio's own strong current.etag as If-Match;
//   3. a 412 or 409 whose body is not Studio's own JSON (preferences_modified) no longer reads as "changed elsewhere": the adapter reads the choices again; if they are what was asked for the save had landed (saved), else the stored choice is shown
//      with the existing refusal words (MODEL_CHOICE_REFUSED). A real stale read is still Studio's JSON 412 and still says what it said;
//   4. the read path needs nothing: the hook fetches with cache "no-store" (no If-None-Match to turn into a 304) and the routes answer Cache-Control: no-store (checked in the proof, with the file and line).
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker MODEL-CHOICE-PREFS-VERSION (matched as a whole token; #521's MODEL-CHOICE and #542's MODEL-CHOICE-DECK-SAVE are other tokens): the two prefs routes, the server lib
// (one line, no NEXT_PUBLIC_ name there: #521's proof holds that file to it), the adapter lib/studio-model-choice.ts (the flag, the header move, the unconfirmed-412 branch), the picker hook and the Intelligence page (an import, two lines in routeFetch,
// one line where the result is read). Strip those lines and each file is its base, byte for byte. No new file in lib/ or components/.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '88c59f3cffd600489027ae5268f2c971970b65e7' // origin/studio-v4-dev-preparation-code with #542 (model choice deck save) merged: dev, which this change is cut from
export const MODEL_CHOICE_PREFS_VERSION_FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION'
export const MODEL_CHOICE_PREFS_VERSION_MARKER = 'MODEL-CHOICE-PREFS-VERSION'
/** The marker as a WHOLE token: MODEL-CHOICE (#521's), MODEL-CHOICE-DECK-SAVE (#542's) or X-MODEL-CHOICE-PREFS-VERSION are not this change's. */
export const MODEL_CHOICE_PREFS_VERSION_MARKER_RE = /(?<![\w-])MODEL-CHOICE-PREFS-VERSION(?![\w-])/
/** The subject prefix of this change's own commits. */
export const MODEL_CHOICE_PREFS_VERSION_SUBJECT = 'Model choice prefs version:'

/** Existing files that get marked lines (pure insertions only). */
export const MODEL_CHOICE_PREFS_VERSION_FILES = [
  'app/api/model-choice/prefs/route.ts',
  'app/api/model-choice/prefs/deck/[deckKey]/route.ts',
  'lib/studio-model-choice-server.ts',
  'lib/studio-model-choice.ts',
  'components/model-choice/use-model-choice.ts',
  'components/studio-personal/intelligence-model-choice.tsx',
]

/** New files (no base text to put back). */
export const MODEL_CHOICE_PREFS_VERSION_FIXTURE_DIR = 'scripts/fixtures/studio-model-choice-prefs-version'
export const MODEL_CHOICE_PREFS_VERSION_FIXTURES = ['e2e2-edge-412-recorded.json'].map(name => `${MODEL_CHOICE_PREFS_VERSION_FIXTURE_DIR}/${name}`)
export const MODEL_CHOICE_PREFS_VERSION_NEW_FILES = [
  'scripts/studio-model-choice-prefs-version-strip.mjs',
  'scripts/test-studio-model-choice-prefs-version.mjs',
  ...MODEL_CHOICE_PREFS_VERSION_FIXTURES,
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries MODEL_CHOICE_PREFS_VERSION_PIN_MARK. */
export const MODEL_CHOICE_PREFS_VERSION_PIN_MARK = '// LATER-CHANGES: registry read (MODEL-CHOICE-PREFS-VERSION)'
export const MODEL_CHOICE_PREFS_VERSION_PIN_EDITS = {}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (MODEL_CHOICE_PREFS_VERSION_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const MODEL_CHOICE_PREFS_VERSION_PIN_FILES = Object.keys(MODEL_CHOICE_PREFS_VERSION_PIN_EDITS)

export const MODEL_CHOICE_PREFS_VERSION_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...MODEL_CHOICE_PREFS_VERSION_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const MODEL_CHOICE_PREFS_VERSION_SCOPE_FILES = new Set([...MODEL_CHOICE_PREFS_VERSION_FILES, ...MODEL_CHOICE_PREFS_VERSION_NEW_FILES, ...MODEL_CHOICE_PREFS_VERSION_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const MODEL_CHOICE_PREFS_VERSION_ENV_BLOCK = `# STUDIO MODEL CHOICE PREFS VERSION (FRONTEND-2, B37 follow-up; E2E-2's capture of 28 Oct 02:15-02:17Z on Studio dev). On for the exact value "true"; default off, and then model choice (NEXT_PUBLIC_STUDIO_MODEL_CHOICE, with the deck save flag) behaves exactly as today. Build-time value: change it on Vercel and redeploy.
# On, a model choice save carries the read's version in its own request header (X-Prefs-Version), never in If-Match: Vercel's edge applies If-Match to the function's response and swaps in its own 412 error page for a save that was written. The routes read the header
# (If-Match still accepted), compare it as an opaque tag, and send it back on every answer; a really stale read is still Studio's JSON 412. A 412 that is not Studio's JSON reads the choices again instead of saying "changed elsewhere". No router change, no new text.
NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripModelChoicePrefsVersion(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in MODEL_CHOICE_PREFS_VERSION_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!MODEL_CHOICE_PREFS_VERSION_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !MODEL_CHOICE_PREFS_VERSION_MARKER_RE.test(line)).join('\n')
}
