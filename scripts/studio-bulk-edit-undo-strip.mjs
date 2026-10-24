// FRONTEND-2 (PROGRAM-1 SUPERCHARGE I2, the Studio side of DIRECTOR-2's whole-deck edits and chat undo): NEXT_PUBLIC_STUDIO_BULK_EDIT and NEXT_PUBLIC_STUDIO_CHAT_UNDO, both default off.
// The exact text this change adds to the files it touches, so a pin that holds one of them to an earlier commit can first put the base text back (stripBulkEditUndo(rel, text)), the way the other
// *-strip.mjs files do. scripts/test-studio-bulk-edit-undo.mjs proves that stripping gives back BASE_COMMIT's files byte for byte. Every piece is context-free (its text occurs once and needs no
// neighbour): the insertions are removed on their own and there is no swapped line: every piece is a pure insertion, so a pin that tolerates a later change's ADDED lines tolerates this one.
// Every line this change adds to a shared file carries the marker BULK-EDIT-UNDO. Each entry is [text this change has, text the base has]. New files (no base text to put back): BULK_EDIT_UNDO_NEW_FILES below.

import { stripLaterChanges } from './studio-later-changes.mjs' // the registry of later changes: every strip a later change registers runs FIRST, innermost, so every pin and root that strips this change also takes those lines out

export const BASE_COMMIT = 'caf6577253ad0b30757dbc9f75d07608dbdbf9d3' // frontend2/thumbnail-last-good (#498), on #497 (8089eee2), on studio f9218b4f; the base's .env.example already holds the thumbnail last good block

const ENV_BLOCK = `# STUDIO BULK EDIT + CHAT UNDO (FRONTEND-2, PROGRAM-1 SUPERCHARGE I2; the Studio side of DIRECTOR-2's whole-deck edits and chat undo). Two flags, each on only for the exact value "true"; default off, and then nothing changes: no cap is
# sent, no frame is looked at and every chat line and ask is drawn exactly as before. Build-time values: change them on Vercel and redeploy. Director needs its own flags on, and sends these frames ONLY to a client whose user_message advertised
# bulk_edit1 / undo1 (Studio does that only with its flag on), so the frame itself is the capability: it is drawn when it arrives, with or without a sync_response (a brand-new session never gets one). Both are drawn in the Studio shell only.
# NEXT_PUBLIC_STUDIO_BULK_EDIT: every send also carries client_caps "bulk_edit1" (after the other caps). A whole-deck edit ("shorten every title") arrives as an ask (action_request, kind "bulk_edit_confirm") and is drawn as a card: your
# instruction, "N slides", a chip per slide (its number, and its title when the deck's structure names it), Director's own estimate label (never a figure Studio works out), and Director's two answers ("Change N slides" and "Cancel"). The
# answer is sent like any other ask: one user_message whose data.action_value is that action's value (confirm_bulk_edit:<bulk_id> or cancel_bulk_edit:<bulk_id>). One answer only; then both buttons are disabled and the chosen one is marked.
# Then bulk_edit_progress receipts show on the chips as they arrive (changed, couldn't change with Director's reason, skipped) and bulk_edit_summary shows counts ("4 of 6 changed · 2 failed"), never "all changed" unless every slide changed.
# NEXT_PUBLIC_STUDIO_CHAT_UNDO: every send also carries client_caps "undo1". Director's change_recorded (for the displayed deck only) puts a small "Undo" chip under the Director chat line that reported the change. One click sends ONE
# user_message with data.action_value "undo_change:<change_id>"; Studio never writes to Layout. Only the latest change can be undone: a newer change_recorded turns the older chips into "A later change replaced this". The reply
# (undo_result) ends the chip as "Undone", "Couldn't undo: <reason>" or "A later change replaced this". Director's deck_mutation {mutation:"deck_restored"} is read, with this flag on, as a whole-viewer refresh (the hook treats it as slide_replaced
# with the slide count left to the rail's re-read); it is acted on only when NEXT_PUBLIC_STUDIO_DECK_MUTATION_REFRESH_ENABLED is on too (that flag owns the viewer reload), and is ignored with this flag off. Receipts, summaries and chips are kept in
# this tab's memory only: a reload shows Director's chat lines, not them.
NEXT_PUBLIC_STUDIO_BULK_EDIT="false"
NEXT_PUBLIC_STUDIO_CHAT_UNDO="false"

`

const HOOK_IMPORTS = `import { STUDIO_BULK_EDIT_UNDO_ENABLED, STUDIO_CHAT_UNDO_ENABLED, BULK_EDIT_UNDO_CLIENT_CAPS, addBulkEditUndoCaps, normaliseDeckRestored } from '@/lib/studio-bulk-edit-wire'; // BULK-EDIT-UNDO (flags NEXT_PUBLIC_STUDIO_BULK_EDIT / NEXT_PUBLIC_STUDIO_CHAT_UNDO, default off)
import { bulkEditUndoContext, routeStudioBulkEditUndoFrame } from '@/lib/studio-bulk-edit-store'; // BULK-EDIT-UNDO
`

const HOOK_ROUTE = `            // BULK-EDIT-UNDO (NEXT_PUBLIC_STUDIO_BULK_EDIT / NEXT_PUBLIC_STUDIO_CHAT_UNDO, default off): Director's chat lines (the Undo chip's anchor), the bulk-edit confirm (its chip titles) and its receipts and summary,
            // BULK-EDIT-UNDO: change_recorded and undo_result go to this tab's store (lib/studio-bulk-edit-store.ts), here, ahead of the allowlist. The frames it takes (receipts, summary, change_recorded, undo_result) stop
            // BULK-EDIT-UNDO: here: they never reach the reducer, the transcript or the cache, and they do not unlock the turn. Director sends them only to a client that advertised bulk_edit1 / undo1 (the caps below, flag on only),
            // BULK-EDIT-UNDO: so a frame is its own capability, with or without a sync_response. Every other frame carries on as before. Flags off: nothing is routed.
            if (STUDIO_BULK_EDIT_UNDO_ENABLED && routeStudioBulkEditUndoFrame(parsedMessage, bulkEditUndoContext(socketSessionId, deckMutationOwnerRef.current, slideStructureRef.current, isCurrentSocket())) === 'consumed') return; // BULK-EDIT-UNDO
            if (STUDIO_CHAT_UNDO_ENABLED) normaliseDeckRestored(parsedMessage); // BULK-EDIT-UNDO: an undo's deck_mutation {mutation:"deck_restored"} is read as a whole-viewer refresh (slide_replaced, restored:true) before the checks below; flag off: untouched, ignored as before
`

const HOOK_CAPS = `      if (BULK_EDIT_UNDO_CLIENT_CAPS.length > 0) addBulkEditUndoCaps(message.data as unknown as Record<string, unknown>); // BULK-EDIT-UNDO: bulk_edit1 / undo1 in client_caps, each with its own flag. Off: nothing.
`

const LIST_IMPORTS = `import { StudioBulkEditRow } from "@/components/builder/chat/studio-bulk-edit-card" // BULK-EDIT-UNDO
import { StudioUndoChip } from "@/components/builder/chat/studio-undo-chip" // BULK-EDIT-UNDO
import { STUDIO_BULK_EDIT_ENABLED, STUDIO_CHAT_UNDO_ENABLED } from "@/lib/studio-bulk-edit-wire" // BULK-EDIT-UNDO
import { bulkEditAskDecision, chooseBulkEdit, sendStudioUndo } from "@/lib/studio-bulk-edit-store" // BULK-EDIT-UNDO
`

const LIST_HELPERS = `  // BULK-EDIT-UNDO (flags NEXT_PUBLIC_STUDIO_BULK_EDIT / NEXT_PUBLIC_STUDIO_CHAT_UNDO, default off): Director's whole-deck edit card and the Undo chip. Both send through onActionClick, the page's one answer path (user_message.data.action_value).
  const bulkEditChoose = (action: ActionRequest['payload']['actions'][0], messageId: string) => chooseBulkEdit(action, messageId, { active: activeActionsRef.current, answered: answeredActionsRef.current, answerKey: answerKeyFor(messageId), send: onActionClick }) // BULK-EDIT-UNDO
  const undoChange = (changeId: string, messageId: string) => sendStudioUndo(sessionId, changeId, messageId, { answered: answeredActionsRef.current, send: onActionClick }) // BULK-EDIT-UNDO
`

const LIST_CHIP = `                      {STUDIO_CHAT_UNDO_ENABLED && studio && <StudioUndoChip sessionId={sessionId} messageId={chatMsg.message_id} undo={undoChange} />}{/* BULK-EDIT-UNDO: the Undo chip (default off) */}
`

const LIST_ASK = `                const bulkAsk = STUDIO_BULK_EDIT_ENABLED && studio ? bulkEditAskDecision(actionMsg) : null // BULK-EDIT-UNDO
                if (bulkAsk?.kind === 'hidden') return null // BULK-EDIT-UNDO: a bulk_edit_confirm that does not validate draws nothing
                if (bulkAsk?.kind === 'card') return <StudioBulkEditRow ask={actionMsg} model={bulkAsk.model} sessionId={sessionId} status={historicalActions.get(actionMsg.message_id)} chosenValue={actionMsg.payload.actions[findAnsweredChoice(processedMessages, index, actionMsg)?.actionIndex ?? -1]?.value ?? null} choose={bulkEditChoose} rowProps={chatPolish()} /> // BULK-EDIT-UNDO
`

const MDC_KIND = `  | 'deck_restored' // BULK-EDIT-UNDO: an undo restored a version; the whole viewer is replaced (NEXT_PUBLIC_STUDIO_CHAT_UNDO)
`

const MDC_RESTORED = `  restored?: boolean // BULK-EDIT-UNDO: set by the socket hook on an undo's deck_restored (NEXT_PUBLIC_STUDIO_CHAT_UNDO); the mutation is then read as slide_replaced
`

const REFRESH_COUNT = `    : (payload as { restored?: unknown }).restored === true ? null // BULK-EDIT-UNDO: the socket hook marks an undo's deck_restored (NEXT_PUBLIC_STUDIO_CHAT_UNDO) with restored:true; a restored version may have another slide count, so none is guessed (the rail's re-read settles it)
`

// [text this change has, text the base has]; each `added` is a literal that occurs once in the file.
const CHANGES = {
  ".env.example": [
    [ENV_BLOCK, ''],
  ],
  "hooks/use-deckster-websocket-v2.ts": [
    [HOOK_IMPORTS, ''],
    [HOOK_ROUTE, ''],
    [HOOK_CAPS, ''],
  ],
  "components/builder/message-list.tsx": [
    [LIST_IMPORTS, ''],
    [LIST_HELPERS, ''],
    [LIST_CHIP, ''],
    [LIST_ASK, ''],
  ],
  "types/mdc.ts": [
    [MDC_KIND, ''],
    [MDC_RESTORED, ''],
  ],
  "lib/studio-deck-mutation-refresh.ts": [
    [REFRESH_COUNT, ''],
  ],
}

export const BULK_EDIT_UNDO_FILES = Object.keys(CHANGES)
export const BULK_EDIT_UNDO_NEW_FILES = ['lib/studio-bulk-edit-wire.ts', 'lib/studio-bulk-edit-store.ts', 'components/builder/chat/studio-bulk-edit-card.tsx', 'components/builder/chat/studio-undo-chip.tsx',
  'components/builder/chat/studio-bulk-edit-undo.css', 'scripts/studio-bulk-edit-undo-strip.mjs', 'scripts/test-studio-bulk-edit-undo.mjs',
  // DIRECTOR-2's five offline record.py transcripts (director_commit 8258481b, Director draft !542), copied verbatim: RECORDED.
  'scripts/fixtures/bulk-edit-undo/01-bulk-confirm-card.json', 'scripts/fixtures/bulk-edit-undo/02-bulk-run-one-failure.json', 'scripts/fixtures/bulk-edit-undo/03-bulk-all-skipped.json',
  'scripts/fixtures/bulk-edit-undo/04-undo-restored.json', 'scripts/fixtures/bulk-edit-undo/05-undo-superseded.json',
  // the registry of LATER changes in the stack (a later change registers its files and .env.example block there; the scope checks and the .env.example pins read through it): tests only, scripts/ only.
  'scripts/studio-later-changes.mjs', 'scripts/test-studio-later-changes.mjs']
// The earlier tests this change teaches about its strip and .env.example block (tests only): the stacked ones (#492-#498), the Pass 3 pins that hold the hook, the message list or the mdc types to a base, and the
// two that read the .env.example tail, and the library-manage pin that reads .env.example through the registry of later changes (scripts/studio-later-changes.mjs).
export const BULK_EDIT_UNDO_PIN_FILES = ['scripts/test-studio-chat-element-refine.mjs', 'scripts/test-studio-chat-theme-export.mjs', 'scripts/test-studio-compose-entitlement.mjs', 'scripts/test-studio-deck-mutation-dedupe.mjs', 'scripts/test-studio-duplicate-copy-title.mjs', 'scripts/test-studio-duplicate-deck.mjs', 'scripts/test-studio-job-ledger.mjs', 'scripts/test-studio-new-deck-handoff-send.mjs', 'scripts/test-studio-payments-open-soon.mjs', 'scripts/test-studio-publish-preview-inventory.mjs', 'scripts/test-studio-publish-review-fit.mjs', 'scripts/test-studio-thumbnail-last-good.mjs', 'scripts/test-studio-template-library-manage.mjs', 'scripts/test-studio-deck-import.mjs', 'scripts/test-studio-version-history-deck-only.mjs', 'scripts/test-studio-welcome-polish.mjs', 'scripts/test-theme-font-selection.mjs']
export const BULK_EDIT_UNDO_CHANGES = CHANGES

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripBulkEditUndo(rel, text) {
  const inner = stripLaterChanges(rel, text) // the lines of later changes (scripts/studio-later-changes.mjs) come out first, innermost; an empty registry changes nothing
  const table = CHANGES[rel]
  if (!table) return inner
  return table.reduce((out, [added, original]) => out.replace(added, () => original), inner)
}
