// FRONTEND-2 (B61: chat parity C-D1, the Studio half; contract CODEX-6 streams/codex/codex6/CHAT-CAPS-META.md, "Studio reader"). Flag NEXT_PUBLIC_STUDIO_CHAT_CAPS_META (exact "true", build-time, default off), defined in lib/studio-chat-caps.ts.
// On, the Director WebSocket hook reads sync_response.payload.chat_capabilities (Director's legacy enabled-only boolean map, or C-D1's {confirm, client_directive} per key, with the C2/C4 siblings) into a read-only, per-socket
// snapshot: replaced on each valid current-session sync, ignored from a stale socket or another session, dropped once the socket, account or session changes; never merged, never persisted. Nothing is sent and no action runs.
// Every line this change adds to an EXISTING app file is a pure insertion that carries the marker CHAT-CAPS-META (a WHOLE token): in the hook one import (after the flow-control import, clear of #585's BILLING-F5-USAGE lines) and one
// line in the sync_response case; in types/mdc.ts the C-D1 entry type, one union line under chat_capabilities and the two sibling fields. Strip the marked lines and each file is its base, byte for byte (stripChatCaps(rel, text)).
// The older proofs this change teaches (PIN_EDITS, tests only, every line carries the registry-read mark): the two that read the first-parent line of BASE..HEAD for their own commits' subjects get one more inserted line each,
// for "Chat caps:", as #567 / #568 did; the two that hash the hook's reducer as raw text (chat element refine #470, chat theme/export #472) read it through the registry first (one line each, its base text kept here). How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'f36e9f8506b16cc0bb13f8f8020a2b9cd85b0f09' // studio-v4-dev-preparation-code at #567 (Phone shell coverage), the branch this change is made on
export const CHAT_CAPS_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_CAPS_META'
export const CHAT_CAPS_MARKER = 'CHAT-CAPS-META'
/** The marker as a WHOLE token: CHAT-CAPS-META is this change's; any other prefix or suffix (CHAT-CAPS-META-X, X-CHAT-CAPS-META) is not. */
export const CHAT_CAPS_MARKER_RE = /(?<![\w-])CHAT-CAPS-META(?![\w-])/
/** The subject prefix of this change's own commits. */
export const CHAT_CAPS_SUBJECT = 'Chat caps:'

/** Existing app files that get marked lines. */
export const CHAT_CAPS_FILES = ['hooks/use-deckster-websocket-v2.ts', 'types/mdc.ts']

/** New files (no base text to put back). */
export const CHAT_CAPS_NEW_FILES = [
  'lib/studio-chat-caps.ts',
  'scripts/studio-chat-caps-strip.mjs',
  'scripts/test-studio-chat-caps.mjs',
  'scripts/fixtures/chat-caps/replay.json',
]

/** The older proofs this change teaches: [text the proof has now, text the base commit's proof has] per edit, whole lines, so putting them back gives the base file byte for byte. Every line the proof has now carries CHAT_CAPS_PIN_MARK. */
export const CHAT_CAPS_PIN_MARK = '// LATER-CHANGES: registry read (CHAT-CAPS-META)'
const FIRST_PARENT_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Chat caps:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (CHAT-CAPS-META): on a branch stacked after this change (chat caps, C-D1's Studio reader), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
const REDUCER_BASE_LINE = "  const reducer = text => text.slice(text.indexOf('            // Turn gate: any reply-bearing frame unlocks the input.'), text.indexOf(\"            if ((message.type as string) === 'session_directive') {\"))\n"
const reducerLine = strip => `  const reducer = raw => { const text = ${strip}(HOOK, raw); return text.slice(text.indexOf('            // Turn gate: any reply-bearing frame unlocks the input.'), text.indexOf("            if ((message.type as string) === 'session_directive') {")) } // LATER-CHANGES: registry read (CHAT-CAPS-META): a later change's marked line inside the sync_response case (chat caps, C-D1's reader) comes out first (the registry); a base text has none\n`
export const CHAT_CAPS_PIN_EDITS = {
  'scripts/test-studio-deck-sync-truth.mjs': [[FIRST_PARENT_LINE, '']],
  'scripts/test-studio-chat-element-edit.mjs': [[FIRST_PARENT_LINE, '']],
  // the two proofs that hash the hook's reducer (the onmessage setState) as RAW text: they read it through the registry first (stripBulkEditUndo runs stripLaterChanges innermost; theme-export imports stripLaterChanges itself)
  'scripts/test-studio-chat-element-refine.mjs': [[reducerLine('stripBulkEditUndo'), REDUCER_BASE_LINE]],
  'scripts/test-studio-chat-theme-export.mjs': [[reducerLine('stripLaterChanges'), REDUCER_BASE_LINE]],
}
/** The pins that gain the "Chat caps:" subject filter (inserted after the phone shell coverage's); the other pins rewrite one line. */
export const CHAT_CAPS_FIRST_PARENT_PINS = ['scripts/test-studio-deck-sync-truth.mjs', 'scripts/test-studio-chat-element-edit.mjs']
/** Where each taught line goes: right after the base proof's last subject filter, the phone shell coverage's (the line that starts with this text). */
export const CHAT_CAPS_PIN_AFTER = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Phone shell coverage:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (PHONE-SHELL-COVERAGE)"

/** The proof without this change's edits (the base commit's file). Idempotent: a proof that has none of the edits comes back as it is. */
export function putBackPin(rel, text) {
  return (CHAT_CAPS_PIN_EDITS[rel] || []).reduce((out, [has, base]) => out.replace(has, () => base), text)
}

/** The older proofs this change teaches. */
export const CHAT_CAPS_PIN_FILES = Object.keys(CHAT_CAPS_PIN_EDITS)

/** Files this change edits that are not app code: .env.example (its block, appended), the registry (three lines: its files, its block, its strip) and the older proofs it teaches (CHAT_CAPS_PIN_EDITS). */
export const CHAT_CAPS_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_CAPS_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_CAPS_SCOPE_FILES = new Set([...CHAT_CAPS_FILES, ...CHAT_CAPS_NEW_FILES, ...CHAT_CAPS_OWN_EDITS])

/** The whole .env.example block: its comments and its line (appended at the end of the file, after one blank line). */
export const CHAT_CAPS_ENV_BLOCK = `# STUDIO CHAT CAPS META (FRONTEND-2; B61, chat parity C-D1, the Studio half of CODEX-6's CHAT-CAPS-META contract). On for the exact value "true"; default off, and then nothing changes: the hook does not read the
# field. Build-time value: change it on Vercel and redeploy. On, Studio reads Director's sync_response chat_capabilities (today's enabled-only true map, or C-D1's {confirm, client_directive} per key when
# Director's DIRECTOR_CHAT_CAPS_META_ENABLED is on; absent when Director's MULTI_INTENT_ENABLED is off) into a read-only snapshot for the open session: replaced by each sync of that session, cleared when the
# socket, the account or the session changes, never saved. It is guidance only: nothing is sent, no card is shown, no action or client capability changes, and every confirmation stays where it is today.
NEXT_PUBLIC_STUDIO_CHAT_CAPS_META="false"
`

/** The file without this change's lines: in the two app files every line that carries the marker (as a whole token) is taken out, every other byte stays; an older proof this change taught gets its base text back (putBackPin). Any other file is returned as it is. */
export function stripChatCaps(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_CAPS_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its base text, so a proof that holds it byte for byte reads it as it was
  if (!CHAT_CAPS_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_CAPS_MARKER_RE.test(line)).join('\n')
}
