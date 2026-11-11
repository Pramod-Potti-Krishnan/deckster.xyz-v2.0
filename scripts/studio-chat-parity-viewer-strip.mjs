// FRONTEND-1 (overnight chat parity, 10 Nov 2026), the VIEWER half. Flag NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (the string "true", default off, build-time; it already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell): the composer's "/" menu
// gains the viewer commands (/goto, /next, /prev, /blank-slide, /layout, /present, /edit, /view, /rail, /grid, /borders, /save, /discard, /version, /canvas) and "/theme <preset>". Each calls the handler the matching button calls (lib/studio-chat-parity-viewer.ts
// lists them), through ONE small bus the viewer registers on in a gated effect (the shape of the Master opener on chatParityBus). No new flag, no .env.example block, no backend, no Director change.
// lib/studio-chat-parity-viewer.ts decides (the rows, what cannot run and why, the words, the bus), components/builder/chat/studio-chat-parity-viewer-menu.tsx draws the three groups (Slides, View, Deck), components/builder/studio-chat-parity-viewer.css
// says how a row that cannot run reads. A command says what it SAW in the viewer afterwards, as one short note in the thread (chat clean's own note style, one more note kind: command).
// Every line this change adds to an EXISTING file carries the marker CHAT-PARITY-VIEWER (matched as a whole token; CHAT-PARITY is another change's). Most are pure insertions. 8 are CHANGED lines: CHAT_PARITY_VIEWER_EDITS holds
// [line now, line before] for each, whole lines. Put the changed lines back, then take the marked lines out, and each file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files and this strip (scripts/studio-later-changes.mjs, two lines; no .env.example block). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'eeb78d4f4b7676d75c244746f1edc7da1d269478' // origin/studio-v4-dev-preparation-code (#598 merged); the tree diff from it to this change's newest commit is this change
export const CHAT_PARITY_VIEWER_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_COMMANDS'
export const CHAT_PARITY_VIEWER_MARKER = 'CHAT-PARITY-VIEWER'
/** The marker as a WHOLE token: CHAT-PARITY-VIEWER-X and X-CHAT-PARITY-VIEWER are not this change's (CHAT-PARITY is chat parity's, studio_action). */
export const CHAT_PARITY_VIEWER_MARKER_RE = /(?<![\w-])CHAT-PARITY-VIEWER(?![\w-])/
/** The subject prefix of this change's own commits (the proof reads these, not a merge of dev that this branch may need). */
export const CHAT_PARITY_VIEWER_SUBJECT = 'Chat parity viewer:'

/** Existing files that get marked lines. */
export const CHAT_PARITY_VIEWER_FILES = [
  "components/presentation-viewer.tsx",
  "components/builder/chat-input.tsx",
  "components/builder/chat/studio-chat-commands.tsx",
  "components/builder/chat/studio-chat-clean.tsx",
  "lib/studio-chat-commands.ts",
  "lib/studio-chat-clean.ts",
  "app/builder/page.tsx",
]

/** The changed lines: [line now, line before] per edit, whole lines; every line now carries the marker and occurs once in its file. */
export const CHAT_PARITY_VIEWER_EDITS = {
  "components/builder/chat/studio-chat-commands.tsx": [
    ["  const count = trigger?.kind === 'command' ? rows.length + parity.length : mention ? mention.items.length : 0 // CHAT-PARITY-VIEWER",
     "  const count = trigger?.kind === 'command' ? rows.length : mention ? mention.items.length : 0"],
    ["  const menuOpen = Boolean(enabled && trigger && dismissed !== key && (trigger.kind === 'command' ? rows.length + parity.length > 0 : mention && (mention.items.length > 0 || mention.empty))) // CHAT-PARITY-VIEWER",
     "  const menuOpen = Boolean(enabled && trigger && dismissed !== key && (trigger.kind === 'command' ? rows.length > 0 : mention && (mention.items.length > 0 || mention.empty)))"],
    ["    if (trigger?.kind === 'command') { if (rows[index]) pickCommand(rows[index]); else if (parity[index - rows.length]) pickParity(parity[index - rows.length]) } else if (mention?.items[index]) pickMention(mention.items[index]) // CHAT-PARITY-VIEWER",
     "    if (trigger?.kind === 'command') { if (rows[index]) pickCommand(rows[index]) } else if (mention?.items[index]) pickMention(mention.items[index])"],
    ["    ? <ChatCommandsMenu kind={trigger.kind} rows={rows} parity={parity} mention={mention} active={active} onPick={pickAt} onHover={index => setCursor({ sig, index })} /> // CHAT-PARITY-VIEWER",
     "    ? <ChatCommandsMenu kind={trigger.kind} rows={rows} mention={mention} active={active} onPick={pickAt} onHover={index => setCursor({ sig, index })} />"],
    ["export function ChatCommandsMenu({ kind, rows, parity, mention, active, onPick, onHover }: ChatCommandsMenuProps) { // CHAT-PARITY-VIEWER",
     "export function ChatCommandsMenu({ kind, rows, mention, active, onPick, onHover }: ChatCommandsMenuProps) {"],
    ["        {rows.length > 0 && <p role=\"presentation\" data-studio-v4-type-role=\"mention-heading\" data-studio-chat-commands-heading=\"commands\" className={HEADING}>{W.commandsHeading}</p>}{/* CHAT-PARITY-VIEWER */}",
     "        <p role=\"presentation\" data-studio-v4-type-role=\"mention-heading\" data-studio-chat-commands-heading=\"commands\" className={HEADING}>{W.commandsHeading}</p>"]
  ],
  "components/builder/chat/studio-chat-clean.tsx": [
    ["  return { notes: enabled ? notes : NO_NOTES, addDirections, addNote, ack: enabled && ackNow ? ackNow : NO_ACK } // CHAT-PARITY-VIEWER",
     "  return { notes: enabled ? notes : NO_NOTES, addDirections, ack: enabled && ackNow ? ackNow : NO_ACK }"]
  ],
  "lib/studio-chat-clean.ts": [
    ["export type ChatCleanNoteKind = 'stopped' | 'paused' | 'resumed' | 'applied' | 'not_applied' | 'directions' | 'command' // CHAT-PARITY-VIEWER: chat parity, viewer commands: a quiet one-line note of what a \"/\" command did",
     "export type ChatCleanNoteKind = 'stopped' | 'paused' | 'resumed' | 'applied' | 'not_applied' | 'directions'"]
  ]
}

/** New files (no base text to put back). */
export const CHAT_PARITY_VIEWER_NEW_FILES = [
  "lib/studio-chat-parity-viewer.ts",
  "components/builder/chat/studio-chat-parity-viewer-menu.tsx",
  "components/builder/studio-chat-parity-viewer.css",
  "scripts/studio-chat-parity-viewer-strip.mjs",
  "scripts/test-studio-chat-parity-viewer.mjs",
]

/** The older proofs this change teaches: [line now, line before] per edit, whole lines (a line now carries "registry read (CHAT-PARITY-VIEWER)" and occurs once in its file). */
export const CHAT_PARITY_VIEWER_PIN_EDITS = {

}
export const CHAT_PARITY_VIEWER_PIN_FILES = Object.keys(CHAT_PARITY_VIEWER_PIN_EDITS)
/** Files this change edits that are neither marked app code nor new: the registry (two lines) and the older proofs it teaches. No package.json script: run the proof with `node scripts/test-studio-chat-parity-viewer.mjs`. */
export const CHAT_PARITY_VIEWER_OWN_EDITS = ['scripts/studio-later-changes.mjs', ...CHAT_PARITY_VIEWER_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_PARITY_VIEWER_SCOPE_FILES = new Set([...CHAT_PARITY_VIEWER_FILES, ...CHAT_PARITY_VIEWER_NEW_FILES, ...CHAT_PARITY_VIEWER_OWN_EDITS])

/** The registry text carries this change's two lines; they name this module. */
export const CHAT_PARITY_VIEWER_REGISTRY_MARK = "./studio-chat-parity-viewer-strip.mjs')"

/** An older proof without this change's edits (the previous file). */
export function putBackChatParityViewerEdits(rel, text) {
  return (CHAT_PARITY_VIEWER_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/**
 * The file without this change's lines: the changed lines go back to what they were, then every line that carries the marker (as a whole token) is taken out; every other byte stays. The registry loses its two lines;
 * a taught proof gets its previous lines back. Any other file is returned as it is.
 */
export function stripChatParityViewer(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === 'scripts/studio-later-changes.mjs') return text.split('\n').filter(line => !line.includes(CHAT_PARITY_VIEWER_REGISTRY_MARK)).join('\n')
  if (rel in CHAT_PARITY_VIEWER_PIN_EDITS) return putBackChatParityViewerEdits(rel, text)
  if (!CHAT_PARITY_VIEWER_FILES.includes(rel)) return text
  const swapped = (CHAT_PARITY_VIEWER_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
  return swapped.split('\n').filter(line => !CHAT_PARITY_VIEWER_MARKER_RE.test(line)).join('\n')
}
