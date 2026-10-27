// FRONTEND-2 (B32, PROGRAM-1 GO 27 Oct 17:24Z; E2E-2's element-edit run on Studio dev, session 57f9e99a). Flag NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2 (exact "true", default off, build-time): two fixes to #522's chat element edit
// (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT, ON on Studio dev), both seen after a page reload or an Undo.
//   1. SLIDE_CHANGED on every edit after a reload: the runner's slide check compared Director's directive slide_id (Layout's, "slide_7f86d3817444") with the id of the session's restored slideStructure (Director's outline UUID,
//      "9ebccd93-..."). With the flag on the runner reads the shown deck's own count and ids from Layout's slide inventory; a slide that really changed still answers SLIDE_CHANGED; Layout's ids unreadable = the index check alone.
//   2. A stale hidden element reference: the selection record behind user_message.references was written only when a selection STATE changed and never dropped when the element went away (an Undo). With the flag on it is written on
//      every selection event and dropped when the deck changes under it or the shown slide is not the one it was selected on.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-ELEMENT-EDIT-2 (matched as a whole token; #522's CHAT-ELEMENT-EDIT is another token): app/builder/page.tsx (an import, one runner dep, the
// helper and two effects after the element-edit runner, one line in each of the two selection callbacks) and lib/chat-element-edit.ts (two imports, one dep field and its comment, the shown-slides read in the runner). Strip those lines and each
// file is its base, byte for byte. The new file lib/chat-element-edit-2.ts holds the flag and the pure helpers.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '73e6e5b00f41f129140ec5c4ccf9151a2e567f08' // origin/studio-v4-dev-preparation-code with #535 (paused label) merged: dev when this change was cut
export const CHAT_ELEMENT_EDIT_2_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2'
export const CHAT_ELEMENT_EDIT_2_MARKER = 'CHAT-ELEMENT-EDIT-2'
/** The marker as a WHOLE token: CHAT-ELEMENT-EDIT (#522's) or X-CHAT-ELEMENT-EDIT-2 are not this change's. */
export const CHAT_ELEMENT_EDIT_2_MARKER_RE = /(?<![\w-])CHAT-ELEMENT-EDIT-2(?![\w-])/
/** The subject prefix of this change's own commits. */
export const CHAT_ELEMENT_EDIT_2_SUBJECT = 'Chat element edit 2:'

/** Existing files that get marked lines (pure insertions only). */
export const CHAT_ELEMENT_EDIT_2_FILES = [
  'app/builder/page.tsx',
  'lib/chat-element-edit.ts',
]

/** New files (no base text to put back). */
export const CHAT_ELEMENT_EDIT_2_NEW_FILES = [
  'lib/chat-element-edit-2.ts',
  'scripts/studio-chat-element-edit-2-strip.mjs',
  'scripts/test-studio-chat-element-edit-2.mjs',
  'scripts/fixtures/chat-element-edit-2/e2e2-repro-element-edit.json',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries CHAT_ELEMENT_EDIT_2_PIN_MARK. */
export const CHAT_ELEMENT_EDIT_2_PIN_MARK = '// LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT-2)'
export const CHAT_ELEMENT_EDIT_2_PIN_EDITS = {}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (CHAT_ELEMENT_EDIT_2_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const CHAT_ELEMENT_EDIT_2_PIN_FILES = Object.keys(CHAT_ELEMENT_EDIT_2_PIN_EDITS)

export const CHAT_ELEMENT_EDIT_2_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_ELEMENT_EDIT_2_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_ELEMENT_EDIT_2_SCOPE_FILES = new Set([...CHAT_ELEMENT_EDIT_2_FILES, ...CHAT_ELEMENT_EDIT_2_NEW_FILES, ...CHAT_ELEMENT_EDIT_2_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const CHAT_ELEMENT_EDIT_2_ENV_BLOCK = `# STUDIO CHAT ELEMENT EDIT 2 (FRONTEND-2, B32; PROGRAM-1 GO 27 Oct; E2E-2's element-edit run on Studio dev). On for the exact value "true"; default off, and then chat element edit (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT) behaves exactly as today. Build-time value: change it on Vercel and redeploy.
# On, two fixes: (1) after a page reload an edit on the shown slide works: the runner checks the directive's slide_id against the shown deck's own ids and count, read from Layout's slide inventory (the session's restored slide list holds Director's outline ids, which are not Layout's, so every edit
# answered SLIDE_CHANGED); a slide that really changed still answers SLIDE_CHANGED, and when Layout's ids cannot be read the index check stands alone. (2) the element reference a send carries (and the "@" Element entry) is dropped when the deck changes under it (an Undo, a restored deck) or
# the shown slide is not the one it was selected on, and is written on every selection, so a stale hidden reference cannot follow the user. No Director change, no new text.
NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripChatElementEdit2(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_ELEMENT_EDIT_2_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!CHAT_ELEMENT_EDIT_2_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_ELEMENT_EDIT_2_MARKER_RE.test(line)).join('\n')
}
