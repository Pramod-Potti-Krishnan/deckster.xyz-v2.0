// FRONTEND-2 (PROGRAM-1 SUPERCHARGE I2, chat undo v2: the Studio side of DIRECTOR-2's Director !544 anchors and re-sent change_recorded), behind the flag bulk edit + chat undo already has: NEXT_PUBLIC_STUDIO_CHAT_UNDO (default off). No new flag.
// The exact text this change adds to the one shared file it touches (components/builder/message-list.tsx), so a pin that holds that file to an earlier commit can first put the base text back
// (stripChatUndoV2(rel, text)), the way the other *-strip.mjs files do. scripts/test-studio-chat-undo-v2.mjs proves that stripping gives back BASE_COMMIT's file byte for byte. Both pieces are pure,
// context-free insertions (each occurs once and needs no neighbour), and every line of them carries the marker CHAT-UNDO-V2. Each entry is [text this change has, text the base has]. New files: CHAT_UNDO_V2_NEW_FILES below.
// How the older pins reach it: this change REGISTERS the strip (scripts/studio-later-changes.mjs, LATER_STRIPS), and stripBulkEditUndo (scripts/studio-bulk-edit-undo-strip.mjs) calls the registry first, innermost, so the three
// shared roots (open-read-only, dark-persist, add-slide-status) and every pin that already strips bulk edit + chat undo take this change's lines out with no edit of their own (the Pass 3 pins that may only gain lines could not be taught any other way).
// No .env.example block: the flag is NEXT_PUBLIC_STUDIO_CHAT_UNDO, documented by bulk edit + chat undo's block.

export const BASE_COMMIT = '29fecf3363f99d8bf354359618c4ce3bfefc9910' // frontend2/later-changes-v2 (registry v2, on #499 = 74aaf20c, merged with studio ec9a4abb): the base's message-list.tsx has the v1 lines and no v2 line
export const CHAT_UNDO_V2_MARKER = 'CHAT-UNDO-V2'

const LIST_IMPORT = `import { noteStudioChatLines } from "@/lib/studio-bulk-edit-store" // CHAT-UNDO-V2
`

const LIST_CALL = `  // CHAT-UNDO-V2 (NEXT_PUBLIC_STUDIO_CHAT_UNDO, default off): tell the Undo chip's store which Director lines are in the chat, so a chip goes under its change's own anchor line (Director's anchor_message_id, else the replayed
  // CHAT-UNDO-V2: anchor_history_id) and never under a line that is not here. Read-only on the list; the chips below draw in this same pass.
  if (STUDIO_CHAT_UNDO_ENABLED && studio) noteStudioChatLines(sessionId, processedMessages, removedIds) // CHAT-UNDO-V2

`

// [text this change has, text the base has]; each `added` is a literal that occurs once in the file.
const CHANGES = {
  'components/builder/message-list.tsx': [
    [LIST_IMPORT, ''],
    [LIST_CALL, ''],
  ],
}

export const CHAT_UNDO_V2_FILES = Object.keys(CHANGES)
/** Files this change creates (no base text to put back). */
export const CHAT_UNDO_V2_NEW_FILES = [
  'scripts/studio-chat-undo-v2-strip.mjs', 'scripts/test-studio-chat-undo-v2.mjs',
  // DIRECTOR-2's seven offline record.py transcripts re-recorded at director_commit 18fa6604 (Director !544), copied verbatim: RECORDED (06 and 07 are new; 01 to 05 are the same scenarios re-recorded, with the same names).
  'scripts/fixtures/chat-undo-v2/01-bulk-confirm-card.json', 'scripts/fixtures/chat-undo-v2/02-bulk-run-one-failure.json', 'scripts/fixtures/chat-undo-v2/03-bulk-all-skipped.json',
  'scripts/fixtures/chat-undo-v2/04-undo-restored.json', 'scripts/fixtures/chat-undo-v2/05-undo-superseded.json', 'scripts/fixtures/chat-undo-v2/06-change-recorded-anchor.json',
  'scripts/fixtures/chat-undo-v2/07-reconnect-replay.json',
]
/** Files this change edits that bulk edit + chat undo owns: its adapter and store (the v1 lines stay; v2 adds the anchors, the re-send and the chat-line report), and the registry (two lines: its files and its strip; no env block). */
export const CHAT_UNDO_V2_OWN_EDITS = [
  'lib/studio-bulk-edit-wire.ts', 'lib/studio-bulk-edit-store.ts',
  'scripts/studio-later-changes.mjs',
]
/** Every file this change's commit touches: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs). */
export const CHAT_UNDO_V2_SCOPE_FILES = new Set([...CHAT_UNDO_V2_FILES, ...CHAT_UNDO_V2_NEW_FILES, ...CHAT_UNDO_V2_OWN_EDITS])
export const CHAT_UNDO_V2_CHANGES = CHANGES

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripChatUndoV2(rel, text) {
  const table = CHANGES[rel]
  if (!table) return text
  return table.reduce((out, [added, original]) => out.replace(added, () => original), text)
}
