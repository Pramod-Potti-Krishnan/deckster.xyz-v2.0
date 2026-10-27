// FRONTEND-2 (B31; E2E-2 live run c737ffe5 on Studio dev, 27 Oct). Flag NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER (exact "true", default off, build-time; it needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell):
// two defects of the v3.1 chat clean thread (lib/studio-chat-clean-order.ts has the root causes and the fix).
//   1. the job card's one line stayed "Packaging your outline and picking a theme…" at the outline gate and after the build started (the newest deck event is never retired);
//   2. the thread's notes (Paused / Stopped / Resumed markers, the user's directions) were drawn after the LAST transcript row, so they followed Director's later replies.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-CLEAN-ORDER (matched as a whole token): eight in components/builder/message-list.tsx (two imports, a comment, the plan,
// the one reassignment, a start-of-row and an end-of-row slot, the tail). Strip those lines and the file is its base, byte for byte. The new files (a lib, a component, this strip, a proof, a fixture) have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '4520303b3a7b2105844e34dedf616c1e7d1edffd' // studio-v4-dev-preparation-code with #537 (chat parity, Studio half) merged: dev, which this change was cut from.
export const CHAT_CLEAN_ORDER_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER'
export const CHAT_CLEAN_ORDER_MARKER = 'CHAT-CLEAN-ORDER'
/** The marker as a WHOLE token: CHAT-CLEAN-ORDER-X, X-CHAT-CLEAN-ORDER and the older CHAT-CLEAN (which is followed by "-ORDER" here) are not each other's. */
export const CHAT_CLEAN_ORDER_MARKER_RE = /(?<![\w-])CHAT-CLEAN-ORDER(?![\w-])/
/** The subject prefix of this change's own commits (NOT "Chat clean": the chat clean proof finds its own newest commit by that prefix). */
export const CHAT_CLEAN_ORDER_SUBJECT = 'Clean chat order:'

/** Existing files that get marked lines (pure insertions only). */
export const CHAT_CLEAN_ORDER_FILES = [
  'components/builder/message-list.tsx',
]

/** New files (no base text to put back). */
export const CHAT_CLEAN_ORDER_NEW_FILES = [
  'lib/studio-chat-clean-order.ts',
  'components/builder/chat/studio-chat-clean-order.tsx',
  'scripts/studio-chat-clean-order-strip.mjs',
  'scripts/test-studio-chat-clean-order.mjs',
  'scripts/fixtures/chat-clean-order/outline-gate-director2-27oct.json',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. Every line the proof has now that this change touched carries CHAT_CLEAN_ORDER_PIN_MARK. */
export const CHAT_CLEAN_ORDER_PIN_MARK = 'LATER-CHANGES: registry read (CHAT-CLEAN-ORDER)'
const MARK = CHAT_CLEAN_ORDER_PIN_MARK
export const CHAT_CLEAN_ORDER_PIN_EDITS = {
  // chat undo v2's proof strips the message list with its own strip and chat clean's: it reads the strip of this change, stacked after chat clean, first (the first marked message-list change after chat clean)
  'scripts/test-studio-chat-undo-v2.mjs': [
    [`const order = await import('./studio-chat-clean-order-strip.mjs') // ${MARK}: the strip of the change stacked after chat clean, so its marked lines in the message list come out first\n`, ''],
    [`chatClean.stripChatClean(LIST, order.stripChatCleanOrder(LIST, head) /* ${MARK} */)), baseOf(LIST), 'stripped is the base`, `chatClean.stripChatClean(LIST, head)), baseOf(LIST), 'stripped is the base`],
    [`chatClean.stripChatClean(LIST, order.stripChatCleanOrder(LIST, head) /* ${MARK} */))), baseOf(LIST), 'stripping twice`, `chatClean.stripChatClean(LIST, head))), baseOf(LIST), 'stripping twice`],
  ],
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (CHAT_CLEAN_ORDER_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const CHAT_CLEAN_ORDER_PIN_FILES = Object.keys(CHAT_CLEAN_ORDER_PIN_EDITS)

export const CHAT_CLEAN_ORDER_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_CLEAN_ORDER_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_CLEAN_ORDER_SCOPE_FILES = new Set([...CHAT_CLEAN_ORDER_FILES, ...CHAT_CLEAN_ORDER_NEW_FILES, ...CHAT_CLEAN_ORDER_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const CHAT_CLEAN_ORDER_ENV_BLOCK = `# STUDIO CLEAN CHAT ORDER (FRONTEND-2, B31; E2E-2's finding of 27 Oct on Studio dev, session c737ffe5). On for the exact value "true"; default off, and then the chat is byte for byte what it was. Build-time value: change it on Vercel and redeploy. It needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell (the thread it orders is the v3.1 chat); without them it does nothing.
# On: (1) the job card's one line is no longer the last progress line of work that has ended ("Packaging your outline and picking a theme…" under "Waiting for you", then under "Building slides"): it closes when the phase, the outline or the newest approval card changes, and shows nothing at the outline gate; (2) the thread's notes (Stopped / Paused / Resumed markers, the user's directions) are drawn where they happened, between Director's replies, not after the last one.
# No new text, no Director change, nothing sent.
NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripChatCleanOrder(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_CLEAN_ORDER_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!CHAT_CLEAN_ORDER_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_CLEAN_ORDER_MARKER_RE.test(line)).join('\n')
}
