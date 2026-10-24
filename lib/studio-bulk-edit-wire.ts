/**
 * FRONTEND-2 (PROGRAM-1 SUPERCHARGE I2, the Studio side of DIRECTOR-2's whole-deck edits and undo): the WIRE half. ONE adapter: every frame name, field
 * name, bound and action value of this feature is here, so a change on Director's side is a change to this file only. It has no imports, reads nothing
 * from the page and never throws: a frame that does not validate gives null, and the caller then draws nothing.
 *
 * Two flags, each on only for the exact value "true", default off, read at build time, each independent of the other:
 *   NEXT_PUBLIC_STUDIO_BULK_EDIT -> client cap `bulk_edit1`:
 *       action_request {kind:"bulk_edit_confirm", bulk_edit:{...}}, bulk_edit_progress, bulk_edit_summary
 *   NEXT_PUBLIC_STUDIO_CHAT_UNDO -> client cap `undo1`:
 *       change_recorded, the user_message action_value "undo_change:<change_id>", undo_result, deck_mutation {mutation:"deck_restored"}
 * The frame itself is the capability: Director sends these frames only to a client whose user_message advertised bulk_edit1 / undo1, and Studio advertises them only with the flag on. So with the flag on a
 * frame is drawn when it arrives, whether or not a sync_response was ever seen (a brand-new session never gets one). There are no credits on the wire: the cost is
 * estimate.label, Director's own words, and estimate.usd is parsed but never formatted here.
 *
 * Contract: DIRECTOR-2's FINAL I2 wire (relayed 24 Oct, FRONTEND-2 brief). Fixtures in scripts/test-studio-bulk-edit-undo.mjs are DERIVED from it until
 * DIRECTOR-2's record.py frames arrive.
 */

export const STUDIO_BULK_EDIT_ENABLED = process.env.NEXT_PUBLIC_STUDIO_BULK_EDIT === 'true'
export const STUDIO_CHAT_UNDO_ENABLED = process.env.NEXT_PUBLIC_STUDIO_CHAT_UNDO === 'true'
/** Either flag: the only reason the socket hook looks at these frames at all. */
export const STUDIO_BULK_EDIT_UNDO_ENABLED = STUDIO_BULK_EDIT_ENABLED || STUDIO_CHAT_UNDO_ENABLED

// ---- the handshake ------------------------------------------------------------------------------------------------------------------------------------

/** Added to `user_message.data.client_caps` (after mdc1 / element_refine1 / theme1 / export1), each only with its own flag on. Exact, case-sensitive. */
export const BULK_EDIT_CLIENT_CAP = 'bulk_edit1'
export const UNDO_CLIENT_CAP = 'undo1'
/** The caps this build sends: empty with both flags off, and then nothing is added to a send. */
export const BULK_EDIT_UNDO_CLIENT_CAPS: readonly string[] = [
  ...(STUDIO_BULK_EDIT_ENABLED ? [BULK_EDIT_CLIENT_CAP] : []),
  ...(STUDIO_CHAT_UNDO_ENABLED ? [UNDO_CLIENT_CAP] : []),
]

/** Adds this build's caps to a built `user_message.data`, in place, after whatever caps are there. Called only when BULK_EDIT_UNDO_CLIENT_CAPS is not empty. */
export function addBulkEditUndoCaps(data: Record<string, unknown>): Record<string, unknown> {
  const caps = Array.isArray(data.client_caps) ? (data.client_caps as unknown[]).filter((cap): cap is string => typeof cap === 'string') : []
  data.client_caps = [...caps, ...BULK_EDIT_UNDO_CLIENT_CAPS.filter(cap => !caps.includes(cap))]
  return data
}

// ---- names -----------------------------------------------------------------------------------------------------------------------------------------------

export const BULK_EDIT_CONFIRM_KIND = 'bulk_edit_confirm'
export const BULK_EDIT_PROGRESS_TYPE = 'bulk_edit_progress'
export const BULK_EDIT_SUMMARY_TYPE = 'bulk_edit_summary'
export const CHANGE_RECORDED_TYPE = 'change_recorded'
export const UNDO_RESULT_TYPE = 'undo_result'
/** The answer to the confirm card is a user_message whose data.action_value is the action's own value, exactly like confirm_slide_op. */
export const CONFIRM_BULK_EDIT_PREFIX = 'confirm_bulk_edit:'
export const CANCEL_BULK_EDIT_PREFIX = 'cancel_bulk_edit:'
/** The Undo chip's click: one user_message whose data.action_value is this. */
export const UNDO_CHANGE_PREFIX = 'undo_change:'
/** deck_mutation's new value: an undo restored a version and the whole viewer is replaced. */
export const DECK_RESTORED_MUTATION = 'deck_restored'

/**
 * With the undo flag on, a deck_mutation {mutation:"deck_restored"} is read as the whole-viewer refresh it is: in place, its mutation becomes "slide_replaced"
 * (the viewer reloads with a new token and the rail re-reads the deck, exactly as for any replaced slide) and it carries restored:true, so the refresh planner
 * does not guess a slide count (a restored version may have another). The hook's own checks (this socket's session, the displayed deck, a refresh_token, an
 * allowed viewer URL, one handling per frame) then apply to it unchanged. Flag off, or any other frame: nothing is touched, and deck_restored stays an
 * unknown mutation the hook ignores, as before. Returns true when the frame was rewritten.
 */
export function normaliseDeckRestored(frame: unknown): boolean {
  try {
    if (!STUDIO_CHAT_UNDO_ENABLED || frameType(frame) !== 'deck_mutation' || !isRecord(frame) || !isRecord(frame.payload) || frame.payload.mutation !== DECK_RESTORED_MUTATION) return false
    frame.payload.mutation = 'slide_replaced'
    frame.payload.restored = true
    return true
  } catch { return false }
}

// ---- bounds ------------------------------------------------------------------------------------------------------------------------------------------------

const MAX_ID = 128
const MAX_SLIDES = 200
const MAX_INSTRUCTION = 400
const MAX_LABEL = 160
const MAX_REASON = 240
const MAX_COUNT = 100_000

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const cleanText = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}
const cleanId = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 && value.length <= MAX_ID && !/[\u0000- \u007f]/.test(value) ? value : null)
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_COUNT
/** A frame's fields: its payload (the Director envelope), else the frame itself when it has no payload key at all. */
const bodyOf = (frame: unknown): Record<string, unknown> | null => {
  if (!isRecord(frame)) return null
  if ('payload' in frame) return isRecord(frame.payload) ? frame.payload : null
  return frame
}
/** The session an envelope names, when it names one. */
export function frameSessionId(frame: unknown): string | null {
  return isRecord(frame) && typeof frame.session_id === 'string' && frame.session_id ? frame.session_id : null
}
export function frameType(frame: unknown): string | null {
  return isRecord(frame) && typeof frame.type === 'string' ? frame.type : null
}

// ---- the confirm card ----------------------------------------------------------------------------------------------------------------------------

export interface BulkEditAction { label: string; value: string }
export interface BulkEditConfirm {
  bulkId: string
  instruction: string
  /** 0-based, as sent; the card shows index + 1. */
  slideIndexes: number[]
  /** Parallel to slideIndexes; null when Director gave no id for that slide. */
  slideIds: (string | null)[]
  slideCount: number
  /** estimate.label, Director's own words: the only cost text ever drawn. */
  estimateLabel: string | null
  /** estimate.usd as sent. Never formatted or drawn by Studio. */
  estimateUsd: number | null
  confirm: BulkEditAction
  cancel: BulkEditAction
}

/** True for an action_request that claims to be a bulk-edit confirm, valid or not (a malformed one draws nothing). */
export function isBulkEditConfirmFrame(frame: unknown): boolean {
  try { return frameType(frame) === 'action_request' && isRecord(frame) && isRecord(frame.payload) && frame.payload.kind === BULK_EDIT_CONFIRM_KIND } catch { return false }
}

/** The confirm card's model, or null when the frame is not a well-formed bulk_edit_confirm. */
export function parseBulkEditConfirm(frame: unknown): BulkEditConfirm | null {
  try {
    if (!isBulkEditConfirmFrame(frame)) return null
    const payload = (frame as { payload: Record<string, unknown> }).payload
    const bulk = payload.bulk_edit
    if (!isRecord(bulk)) return null
    const bulkId = cleanId(bulk.bulk_id)
    if (!bulkId) return null
    const instruction = cleanText(bulk.instruction, MAX_INSTRUCTION)
    if (!instruction) return null
    const indexes = bulk.slide_indexes
    if (!Array.isArray(indexes) || indexes.length < 1 || indexes.length > MAX_SLIDES) return null
    if (!indexes.every(isCount) || new Set(indexes).size !== indexes.length) return null
    if (bulk.slide_count !== indexes.length) return null // the count the card states must be the chips it draws
    let slideIds: (string | null)[] = indexes.map(() => null)
    if (bulk.slide_ids !== undefined && bulk.slide_ids !== null) {
      const ids = bulk.slide_ids
      if (!Array.isArray(ids) || ids.length !== indexes.length) return null
      slideIds = ids.map(id => (id === null ? null : cleanId(id)))
      if (ids.some((id, at) => id !== null && slideIds[at] === null)) return null
    }
    const estimate = isRecord(bulk.estimate) ? bulk.estimate : null
    const actions = Array.isArray(payload.actions) ? payload.actions : []
    const find = (value: string): BulkEditAction | null => {
      const hits = actions.filter(action => isRecord(action) && action.value === value)
      const label = hits.length === 1 && isRecord(hits[0]) ? cleanText(hits[0].label, MAX_LABEL) : null
      return label ? { label, value } : null
    }
    const confirm = find(`${CONFIRM_BULK_EDIT_PREFIX}${bulkId}`), cancel = find(`${CANCEL_BULK_EDIT_PREFIX}${bulkId}`)
    if (!confirm || !cancel) return null
    return {
      bulkId, instruction, slideIndexes: [...indexes] as number[], slideIds, slideCount: indexes.length,
      estimateLabel: estimate ? cleanText(estimate.label, MAX_LABEL) : null,
      estimateUsd: estimate && typeof estimate.usd === 'number' && Number.isFinite(estimate.usd) && estimate.usd >= 0 ? estimate.usd : null,
      confirm, cancel,
    }
  } catch { return null }
}

/** Which of the card's two answers an action value is, or null. */
export function bulkEditChoiceOf(model: BulkEditConfirm, value: unknown): 'confirm' | 'cancel' | null {
  return value === model.confirm.value ? 'confirm' : value === model.cancel.value ? 'cancel' : null
}

// ---- receipts and the summary ----------------------------------------------------------------------------------------------------------------

export type BulkReceiptStatus = 'done' | 'failed' | 'skipped'
export interface BulkEditReceipt { bulkId: string; slideId: string | null; slideIndex: number; status: BulkReceiptStatus; reason: string | null }

export function parseBulkEditProgress(frame: unknown): BulkEditReceipt | null {
  try {
    if (frameType(frame) !== BULK_EDIT_PROGRESS_TYPE) return null
    const body = bodyOf(frame)
    if (!body) return null
    const bulkId = cleanId(body.bulk_id)
    if (!bulkId || !isCount(body.slide_index)) return null
    const status = body.status
    if (status !== 'done' && status !== 'failed' && status !== 'skipped') return null
    return { bulkId, slideId: cleanId(body.slide_id), slideIndex: body.slide_index, status, reason: cleanText(body.reason, MAX_REASON) }
  } catch { return null }
}

export interface BulkEditSummary { bulkId: string; done: number; failed: number; skipped: number; total: number }

export function parseBulkEditSummary(frame: unknown): BulkEditSummary | null {
  try {
    if (frameType(frame) !== BULK_EDIT_SUMMARY_TYPE) return null
    const body = bodyOf(frame)
    if (!body) return null
    const bulkId = cleanId(body.bulk_id)
    if (!bulkId || !isCount(body.done) || !isCount(body.failed) || !isCount(body.skipped) || !isCount(body.total)) return null
    if (body.done + body.failed + body.skipped > body.total) return null // more outcomes than slides is not a count to show
    return { bulkId, done: body.done, failed: body.failed, skipped: body.skipped, total: body.total }
  } catch { return null }
}

// ---- undo ----------------------------------------------------------------------------------------------------------------------------------------------

export type ChangeKind = 'slide_added' | 'slide_replaced' | 'slide_deleted' | 'slide_reordered' | 'bulk_edit'
const CHANGE_KINDS: readonly string[] = ['slide_added', 'slide_replaced', 'slide_deleted', 'slide_reordered', 'bulk_edit']
const KIND_WORDS: Record<ChangeKind, string> = {
  slide_added: 'Added a slide', slide_replaced: 'Changed a slide', slide_deleted: 'Deleted a slide', slide_reordered: 'Moved a slide', bulk_edit: 'Changed the deck',
}
export interface RecordedChange { changeId: string; label: string; kind: ChangeKind; presentationId: string }

/** change_recorded: only a Director-written change that is undoable (v1: no element or theme changes). The label is Director's; a kind's plain words stand in when it sends none. */
export function parseChangeRecorded(frame: unknown): RecordedChange | null {
  try {
    if (frameType(frame) !== CHANGE_RECORDED_TYPE) return null
    const body = bodyOf(frame)
    if (!body || body.undoable !== true) return null
    const changeId = cleanId(body.change_id), presentationId = cleanId(body.presentation_id)
    if (!changeId || !presentationId || typeof body.kind !== 'string' || !CHANGE_KINDS.includes(body.kind)) return null
    const kind = body.kind as ChangeKind
    return { changeId, presentationId, kind, label: cleanText(body.label, MAX_LABEL) ?? KIND_WORDS[kind] }
  } catch { return null }
}

export type UndoResultStatus = 'restored' | 'failed' | 'superseded'
export interface UndoResult { changeId: string; status: UndoResultStatus; reason: string | null }

export function parseUndoResult(frame: unknown): UndoResult | null {
  try {
    if (frameType(frame) !== UNDO_RESULT_TYPE) return null
    const body = bodyOf(frame)
    if (!body) return null
    const changeId = cleanId(body.change_id)
    const status = body.status
    if (!changeId || (status !== 'restored' && status !== 'failed' && status !== 'superseded')) return null
    return { changeId, status, reason: cleanText(body.reason, MAX_REASON) }
  } catch { return null }
}

/** The Undo chip's click, as the action the page's existing answer path sends (data.action_value = value). The label is the user's echo in the transcript. */
export function undoChangeAction(changeId: string): { label: string; value: string; primary: false; requires_input: false } {
  return { label: 'Undo', value: `${UNDO_CHANGE_PREFIX}${changeId}`, primary: false, requires_input: false }
}

/** A Director chat line the Undo chip can sit under: a real, non-empty, non-ephemeral assistant chat_message. null for anything else. */
export function parseDirectorChatTurn(frame: unknown): { messageId: string } | null {
  try {
    if (frameType(frame) !== 'chat_message' || !isRecord(frame) || frame.role === 'user') return null
    const payload = frame.payload
    const messageId = cleanId(frame.message_id)
    if (!messageId || !isRecord(payload) || payload.ephemeral === true || typeof payload.text !== 'string' || !payload.text.trim()) return null
    return { messageId }
  } catch { return null }
}

// ---- the words ------------------------------------------------------------------------------------------------------------------------------------------

export const BULK_EDIT_COPY = {
  heading: 'Whole-deck change',
  estimate: 'Estimate',
  sending: 'Sending…',
  chose: 'You chose: ',
  answered: 'Answered',
  earlier: 'No longer available',
  progress: (reported: number, total: number) => `${reported} of ${total} slide${total === 1 ? '' : 's'} reported`,
  receipt: { done: 'Changed', failed: "Couldn't change", skipped: 'Skipped' },
} as const

export const UNDO_COPY = {
  idle: 'Undo', pending: 'Undoing…', restored: 'Undone', failed: "Couldn't undo", superseded: 'A later change replaced this',
  noAnswer: 'No answer from the Director',
} as const

// Director sends a reason as a short code (bulk_edit_progress: refine_failed, unavailable, unconfirmed, slide_missing; undo_result: busy, layout_unavailable, version_missing, restore_failed, no_deck, and
// the superseded pair not_latest / deck_changed). Studio says it in plain words; a code it does not know is not drawn (a raw code is never shown), and a reason that is already a sentence is drawn as sent.
const BULK_REASON_WORDS: Record<string, string> = {
  refine_failed: "the new version didn't come out cleanly", unavailable: 'the service was unavailable', unconfirmed: "the change wasn't confirmed", slide_missing: 'the slide is no longer in the deck',
}
const UNDO_REASON_WORDS: Record<string, string> = {
  busy: 'Director was busy with another change', layout_unavailable: 'the deck service was unavailable', version_missing: "the earlier version isn't available", restore_failed: "the restore didn't go through", no_deck: 'there is no deck to restore',
}
const REASON_CODE = /^\S+$/ // a reason of one token is a code; Director's codes are snake_case words, and a code Studio does not know is not drawn
const wordsFor = (table: Record<string, string>, reason: string | null): string | null => {
  if (!reason) return null
  if (Object.prototype.hasOwnProperty.call(table, reason)) return table[reason]
  return REASON_CODE.test(reason) ? null : reason
}
export const bulkReasonWords = (reason: string | null): string | null => wordsFor(BULK_REASON_WORDS, reason)
export const undoReasonWords = (reason: string | null): string | null => wordsFor(UNDO_REASON_WORDS, reason)

/** The summary as counts, never a sentence of its own (Director closes the turn in words). Only a summary where every slide changed reads as all changed. */
export function bulkEditSummaryParts(summary: BulkEditSummary): { state: 'all-changed' | 'partial' | 'none-changed'; parts: string[] } {
  const parts = [`${summary.done} of ${summary.total} changed`]
  if (summary.failed > 0) parts.push(`${summary.failed} failed`)
  if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`)
  const unfinished = summary.total - summary.done - summary.failed - summary.skipped
  if (unfinished > 0) parts.push(`${unfinished} not finished`)
  const state = summary.total > 0 && summary.done === summary.total && summary.failed === 0 && summary.skipped === 0 ? 'all-changed' : summary.done === 0 ? 'none-changed' : 'partial'
  return { state, parts }
}
