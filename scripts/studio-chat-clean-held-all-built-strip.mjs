// FRONTEND-2 (B40; E2E-2 finding on Studio dev, 28 Oct 13:11-13:24Z, session 39a3f141). Flag NEXT_PUBLIC_STUDIO_CHAT_CLEAN_HELD_ALL_BUILT (exact "true", default off, build-time; it needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell):
// after a Stop with EVERY slide already built, the clean chat's composer no longer takes a typed message as "new directions" for a resume.
//   THE DEFECT. lib/studio-chat-clean.ts chatCleanComposerState (the `held` branch, "sendMode: input.controlEnabled ? 'instructions' : 'wait'") makes a held build's Enter / Send a build_control resume with the draft as instructions
//   (app/builder/page.tsx chatCleanSendDirections); with 5 of 5 built it said "New directions from slide 5…" (chatCleanDirectionsFrom is min(done + 1, count)), and a plain QUESTION typed there was sent as a resume: "Resumed · building
//   from slide 5", Director: "Everything was already built — generating the final deck now.", the question never answered. Nothing is left to direct.
//   THE FIX (flag on). In the STOPPED state (held, kind 'stopped') with slideCount > 0 and slidesDone >= slideCount the composer state is the base's own: sendMode 'message' (the composer's normal Send path, a plain user_message, which Director answers as an
//   ordinary turn without resuming or rebuilding: DIRECTOR-2, Director uat code), no "New directions from slide N" placeholder, hint or context. The bar ("Stopped after the last slide · slides 1-N kept") and Continue are unchanged.
//   Everything else is unchanged: fewer slides built than planned keeps today's directions, PAUSED keeps them too (DIRECTOR-2: a paused build's turn still holds the per-session message lock, so a plain message would queue until Continue or a Stop), stop_requested and resume_requested are untouched. No new copy, no page change.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-CLEAN-HELD-ALL-BUILT (matched as a whole token): two in lib/studio-chat-clean.ts (the flag, the held branch's early return with its
// comment). Strip those lines and the file is its base, byte for byte. The new files (this strip, a proof) have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '8d39667f9ce5be4328c7f3231fd6b16a1e9ca322' // origin/studio-v4-dev-preparation-code with #540 merged, tree 9307c318: dev, which this change is merged with (it was cut from 57744519, #541).
export const HELD_ALL_BUILT_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_CLEAN_HELD_ALL_BUILT'
export const HELD_ALL_BUILT_MARKER = 'CHAT-CLEAN-HELD-ALL-BUILT'
/** The marker as a WHOLE token: CHAT-CLEAN-HELD-ALL-BUILT-X, X-CHAT-CLEAN-HELD-ALL-BUILT and the older CHAT-CLEAN (which is followed by "-HELD-ALL-BUILT" here) are not each other's. */
export const HELD_ALL_BUILT_MARKER_RE = /(?<![\w-])CHAT-CLEAN-HELD-ALL-BUILT(?![\w-])/
/** The subject prefix of this change's own commits (NOT "Chat clean": the chat clean proof finds its own newest commit by that prefix). */
export const HELD_ALL_BUILT_SUBJECT = 'Held all built:'

/** Existing files that get marked lines (pure insertions only). */
export const HELD_ALL_BUILT_FILES = [
  'lib/studio-chat-clean.ts',
]

/** New files (no base text to put back). */
export const HELD_ALL_BUILT_NEW_FILES = [
  'scripts/studio-chat-clean-held-all-built-strip.mjs',
  'scripts/test-studio-chat-clean-held-all-built.mjs',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries HELD_ALL_BUILT_PIN_MARK. */
export const HELD_ALL_BUILT_PIN_MARK = 'LATER-CHANGES: registry read (CHAT-CLEAN-HELD-ALL-BUILT)'
export const HELD_ALL_BUILT_PIN_EDITS = {}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (HELD_ALL_BUILT_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const HELD_ALL_BUILT_PIN_FILES = Object.keys(HELD_ALL_BUILT_PIN_EDITS)

export const HELD_ALL_BUILT_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...HELD_ALL_BUILT_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const HELD_ALL_BUILT_SCOPE_FILES = new Set([...HELD_ALL_BUILT_FILES, ...HELD_ALL_BUILT_NEW_FILES, ...HELD_ALL_BUILT_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const HELD_ALL_BUILT_ENV_BLOCK = `# STUDIO CLEAN CHAT, HELD ALL BUILT (FRONTEND-2, B40; E2E-2's finding of 28 Oct on Studio dev, session 39a3f141). On for the exact value "true"; default off, and then the chat is byte for byte what it was. Build-time value: change it on Vercel and redeploy. It needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell; without them it does nothing.
# On: after a Stop with every slide already built, a message typed in the composer is sent as a plain message (Director answers it as an ordinary turn), not as a resume with "new directions": the composer shows no "New directions from slide N" placeholder, hint or context. The bar and Continue are unchanged, and a Stop with slides still to build keeps today's directions A paused build keeps today's directions too (its turn holds Director's message lock, so a plain message would queue).
# No new text, no Director change.
NEXT_PUBLIC_STUDIO_CHAT_CLEAN_HELD_ALL_BUILT="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripHeldAllBuilt(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in HELD_ALL_BUILT_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!HELD_ALL_BUILT_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !HELD_ALL_BUILT_MARKER_RE.test(line)).join('\n')
}
