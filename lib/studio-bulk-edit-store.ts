/**
 * FRONTEND-2 (PROGRAM-1 SUPERCHARGE I2): this tab's memory of Director's whole-deck edits and of the changes it can undo, plus the two senders. It holds
 * only what the wire adapter (lib/studio-bulk-edit-wire.ts) validated and knows no frame shape itself. It sends nothing on its own: a send is the user's
 * click, passed through the page's existing answer path (handleActionClick -> user_message.data.action_value). It never writes to Layout, never touches
 * a version API, and never throws on a frame.
 *
 * Memory is per tab and per session; a reload starts empty (the chat lines Director wrote stay, the receipts and Undo chips do not come back).
 */
import { useSyncExternalStore } from 'react'
import {
  STUDIO_BULK_EDIT_ENABLED, STUDIO_CHAT_UNDO_ENABLED, NO_CAPABILITIES, UNDO_COPY, BULK_EDIT_PROGRESS_TYPE, BULK_EDIT_SUMMARY_TYPE, CHANGE_RECORDED_TYPE, UNDO_RESULT_TYPE,
  frameSessionId, frameType, isBulkEditConfirmFrame, parseBulkEditConfirm, parseBulkEditProgress, parseBulkEditSummary, parseChangeRecorded, parseChatCapabilities,
  parseDirectorChatTurn, parseUndoResult, undoChangeAction,
  type BulkEditConfirm, type BulkEditReceipt, type BulkEditSummary, type ChatCapabilities, type RecordedChange, type UndoResultStatus,
} from '@/lib/studio-bulk-edit-wire'

/** A pending Undo with no answer comes back as failed after this long (the chip must not spin forever). */
export const UNDO_PENDING_TIMEOUT_MS = 60_000
const MAX_BULKS = 50
const MAX_CHANGES = 100

export type UndoPhase =
  | { phase: 'idle' }
  | { phase: 'pending'; since: number }
  | { phase: 'restored' }
  | { phase: 'failed'; reason: string | null }
  | { phase: 'superseded' }

export interface ChangeRecord { change: RecordedChange; anchorMessageId: string | null; seq: number; state: UndoPhase }
export interface BulkRecord {
  bulkId: string
  /** The chips' titles, read from the deck's structure when the confirm card arrived (null: number only). */
  titles: (string | null)[] | null
  /** The slides the confirm named (0-based positions and Director's ids); null until the confirm card is seen. A receipt for another slide is not this bulk's. */
  slideIndexes: number[] | null
  slideIds: (string | null)[] | null
  receipts: Record<number, BulkEditReceipt>
  summary: BulkEditSummary | null
}

/** What the socket hook knows when a frame arrives. */
export interface BulkEditRouteContext {
  sessionId: string | null
  /** The deck this tab displays (null when unknown: no change is recorded). */
  presentationId: string | null
  isCurrent: boolean
  slideTitles?: () => ReadonlyArray<{ slide_id?: unknown; title?: unknown }>
}
export type BulkEditRoute = 'consumed' | 'pass'

interface SessionData {
  capabilities: ChatCapabilities
  bulks: Map<string, BulkRecord>
  changes: ChangeRecord[]
  lastDirectorChat: string | null
  seq: number
}

const titleText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  return text ? (text.length > 80 ? `${text.slice(0, 79).trimEnd()}…` : text) : null
}

function chipTitles(model: BulkEditConfirm, slides: ReadonlyArray<{ slide_id?: unknown; title?: unknown }>): (string | null)[] {
  return model.slideIndexes.map((index, at) => {
    const id = model.slideIds[at]
    // An id Director named is matched by id only; a slide with no id is matched by its position.
    const slide = id !== null ? slides.find(candidate => candidate && candidate.slide_id === id) : slides[index]
    return slide ? titleText(slide.title) : null
  })
}

export function createBulkEditUndoStore() {
  const sessions = new Map<string, SessionData>()
  const listeners = new Set<() => void>()
  let version = 0
  const changed = () => { version++; for (const listener of Array.from(listeners)) { try { listener() } catch { /* a listener never breaks the frame path */ } } }
  const dataFor = (sessionId: string): SessionData => {
    let data = sessions.get(sessionId)
    if (!data) { data = { capabilities: NO_CAPABILITIES, bulks: new Map(), changes: [], lastDirectorChat: null, seq: 0 }; sessions.set(sessionId, data) }
    return data
  }
  const bulkFor = (data: SessionData, bulkId: string): BulkRecord => {
    let bulk = data.bulks.get(bulkId)
    if (!bulk) {
      bulk = { bulkId, titles: null, slideIndexes: null, slideIds: null, receipts: {}, summary: null }
      data.bulks.set(bulkId, bulk)
      if (data.bulks.size > MAX_BULKS) data.bulks.delete(data.bulks.keys().next().value as string)
    }
    return bulk
  }
  const findChange = (data: SessionData | undefined, changeId: string) => data?.changes.find(record => record.change.changeId === changeId)

  /** One socket frame. 'consumed' = this adapter took it (the hook stops there, as for any frame it handles out of band); 'pass' = carry on as before. */
  function route(frame: unknown, context: BulkEditRouteContext): BulkEditRoute {
    try {
      const type = frameType(frame)
      const sessionId = context.sessionId
      if (!type || !sessionId || !context.isCurrent) return 'pass'
      const named = frameSessionId(frame)
      const foreign = named !== null && named !== sessionId // an envelope for another session is never this tab's state
      if (type === 'sync_response') {
        const capabilities = parseChatCapabilities(frame)
        if (capabilities && !foreign) { dataFor(sessionId).capabilities = capabilities; changed() }
        return 'pass'
      }
      if (type === 'chat_message') {
        const turn = STUDIO_CHAT_UNDO_ENABLED && !foreign ? parseDirectorChatTurn(frame) : null
        if (turn) dataFor(sessionId).lastDirectorChat = turn.messageId
        return 'pass'
      }
      if (type === 'action_request') {
        if (!STUDIO_BULK_EDIT_ENABLED || foreign || !isBulkEditConfirmFrame(frame)) return 'pass'
        const model = parseBulkEditConfirm(frame)
        if (model) {
          const bulk = bulkFor(dataFor(sessionId), model.bulkId)
          if (!bulk.titles) {
            let slides: ReadonlyArray<{ slide_id?: unknown; title?: unknown }> = []
            try { slides = context.slideTitles?.() ?? [] } catch { slides = [] }
            bulk.titles = chipTitles(model, Array.isArray(slides) ? slides : [])
            bulk.slideIndexes = model.slideIndexes
            bulk.slideIds = model.slideIds
            changed()
          }
        }
        return 'pass' // the frame itself is a normal ask: it stays in the transcript, where the card is drawn
      }
      if (type === BULK_EDIT_PROGRESS_TYPE || type === BULK_EDIT_SUMMARY_TYPE) {
        if (!STUDIO_BULK_EDIT_ENABLED) return 'pass'
        if (foreign) return 'consumed'
        const receipt = parseBulkEditProgress(frame)
        const summary = receipt ? null : parseBulkEditSummary(frame)
        if (receipt) {
          const bulk = bulkFor(dataFor(sessionId), receipt.bulkId), at = bulk.slideIndexes ? bulk.slideIndexes.indexOf(receipt.slideIndex) : -1
          // Once the confirm is known, only its own slides count: a receipt for a position it did not name, or whose slide id disagrees with the one it named there, is dropped.
          const ours = !bulk.slideIndexes || (at >= 0 && !(receipt.slideId !== null && bulk.slideIds?.[at] != null && receipt.slideId !== bulk.slideIds[at]))
          if (ours) { bulk.receipts[receipt.slideIndex] = receipt; changed() }
        }
        else if (summary) { bulkFor(dataFor(sessionId), summary.bulkId).summary = summary; changed() }
        return 'consumed'
      }
      if (type === CHANGE_RECORDED_TYPE) {
        if (!STUDIO_CHAT_UNDO_ENABLED) return 'pass'
        if (foreign) return 'consumed'
        const change = parseChangeRecorded(frame)
        // Only the deck this tab displays: a frame for another presentation (or when none is known) is not recorded.
        if (!change || !context.presentationId || change.presentationId !== context.presentationId) return 'consumed'
        const data = dataFor(sessionId)
        if (findChange(data, change.changeId)) return 'consumed'
        // Only the LATEST change can be undone: every older chip of this deck still waiting goes to "a later change replaced this" at once.
        for (const record of data.changes) if (record.change.presentationId === change.presentationId && record.state.phase === 'idle') record.state = { phase: 'superseded' }
        data.changes.push({ change, anchorMessageId: data.lastDirectorChat, seq: ++data.seq, state: { phase: 'idle' } })
        if (data.changes.length > MAX_CHANGES) data.changes.shift()
        changed()
        return 'consumed'
      }
      if (type === UNDO_RESULT_TYPE) {
        if (!STUDIO_CHAT_UNDO_ENABLED) return 'pass'
        if (foreign) return 'consumed'
        const result = parseUndoResult(frame)
        const record = result ? findChange(sessions.get(sessionId), result.changeId) : undefined
        if (result && record) { record.state = undoPhaseOf(result.status, result.reason); changed() }
        return 'consumed'
      }
      return 'pass'
    } catch { return 'pass' }
  }

  return {
    route,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    version: () => version,
    capabilities: (sessionId: string | null | undefined): ChatCapabilities => (sessionId ? sessions.get(sessionId)?.capabilities ?? NO_CAPABILITIES : NO_CAPABILITIES),
    bulk: (sessionId: string | null | undefined, bulkId: string): BulkRecord | null => (sessionId ? sessions.get(sessionId)?.bulks.get(bulkId) ?? null : null),
    /** The newest change recorded under this Director chat line, or null. */
    changeFor(sessionId: string | null | undefined, messageId: string): ChangeRecord | null {
      const hits = sessionId ? sessions.get(sessionId)?.changes.filter(record => record.anchorMessageId === messageId) ?? [] : []
      return hits.length ? hits[hits.length - 1] : null
    },
    /** idle -> pending, once. false = nothing to do (not idle, unknown, or already asked): the caller sends no frame. */
    beginUndo(sessionId: string, changeId: string, now = Date.now()): boolean {
      const record = findChange(sessions.get(sessionId), changeId)
      if (!record || record.state.phase !== 'idle') return false
      record.state = { phase: 'pending', since: now }
      changed()
      return true
    },
    /** The send did not go out: pending -> idle again, so the user can try again. */
    cancelPending(sessionId: string, changeId: string): void {
      const record = findChange(sessions.get(sessionId), changeId)
      if (record && record.state.phase === 'pending') { record.state = { phase: 'idle' }; changed() }
    },
    /** A pending Undo older than the timeout becomes a failure with a plain reason. */
    expirePending(sessionId: string, now = Date.now()): number {
      let expired = 0
      for (const record of sessions.get(sessionId)?.changes ?? []) {
        if (record.state.phase === 'pending' && now - record.state.since >= UNDO_PENDING_TIMEOUT_MS) { record.state = { phase: 'failed', reason: UNDO_COPY.noAnswer }; expired++ }
      }
      if (expired) changed()
      return expired
    },
    reset() { sessions.clear(); changed() },
  }
}
export type BulkEditUndoStore = ReturnType<typeof createBulkEditUndoStore>

function undoPhaseOf(status: UndoResultStatus, reason: string | null): UndoPhase {
  return status === 'restored' ? { phase: 'restored' } : status === 'superseded' ? { phase: 'superseded' } : { phase: 'failed', reason }
}

/** This tab's store. */
export const studioBulkEditUndo: BulkEditUndoStore = createBulkEditUndoStore()

/** The hook's context for one frame, from facts it already holds (the displayed deck's owner, the deck structure, whether this socket is still the current one). */
export function bulkEditUndoContext(
  sessionId: string | null,
  owner: { deckOwnerSessionId?: string | null; presentationId?: string | null } | null | undefined,
  structure: { slides?: ReadonlyArray<{ slide_id?: unknown; title?: unknown }> } | null | undefined,
  isCurrent: boolean,
): BulkEditRouteContext {
  return {
    sessionId, isCurrent,
    presentationId: owner && owner.deckOwnerSessionId === sessionId && typeof owner.presentationId === 'string' && owner.presentationId ? owner.presentationId : null,
    slideTitles: () => structure?.slides ?? [],
  }
}

/** The hook's single entry: one socket frame to this tab's store. */
export function routeStudioBulkEditUndoFrame(frame: unknown, context: BulkEditRouteContext, store: BulkEditUndoStore = studioBulkEditUndo): BulkEditRoute {
  return store.route(frame, context)
}

/** Re-render the caller when the store changes (a receipt or a summary arrives, a change is recorded, an undo is answered): the confirm card and the Undo chip use it. Constant while nothing is routed, so with both flags off nothing re-renders. */
export function useStudioBulkEditUndoVersion(store: BulkEditUndoStore = studioBulkEditUndo): number {
  return useSyncExternalStore(store.subscribe, store.version, store.version)
}

// ---- what the chat draws ---------------------------------------------------------------------------------------------------------------------------

type AskLike = { message_id?: string; payload?: unknown }

/**
 * How the chat draws an action_request. null = an ordinary ask (the card it always had): the flag is off, Director did not advertise bulk_edit, or the
 * frame is not a bulk_edit_confirm. 'hidden' = a bulk_edit_confirm that does not validate: nothing is drawn (a confirm without its slide list is never
 * answered blind). 'card' = the confirm card.
 */
export function bulkEditAskDecision(ask: AskLike, sessionId: string | null | undefined, store: BulkEditUndoStore = studioBulkEditUndo):
  | { kind: 'card'; model: BulkEditConfirm } | { kind: 'hidden' } | null {
  try {
    if (!STUDIO_BULK_EDIT_ENABLED || !isBulkEditConfirmFrame({ type: 'action_request', payload: ask.payload })) return null
    if (!store.capabilities(sessionId).bulkEdit) return null
    const model = parseBulkEditConfirm({ type: 'action_request', payload: ask.payload })
    return model ? { kind: 'card', model } : { kind: 'hidden' }
  } catch { return { kind: 'hidden' } }
}

type ChatAction = { label: string; value: string; primary: boolean; requires_input: boolean }
type AnswerSender = (action: ChatAction, messageId: string, answerKey?: string) => unknown

/**
 * The card's answer: the page's own answer path (handleActionClick), with the action exactly as Director sent it (its value is data.action_value). Once per
 * ask: a closed or already-answered ask sends nothing. Resolves true only when the page recorded the answer (a send that did not go out leaves the card open).
 */
export async function chooseBulkEdit(
  action: ChatAction, messageId: string,
  gate: { active: ReadonlySet<string>; answered: ReadonlySet<string>; answerKey: string; send: AnswerSender },
): Promise<boolean> {
  try {
    if (!gate.active.has(messageId) || gate.answered.has(gate.answerKey)) return false
    await gate.send(action, messageId, gate.answerKey)
    return gate.answered.has(gate.answerKey)
  } catch { return false }
}

/**
 * The Undo chip's click: ONE user_message with data.action_value "undo_change:<change_id>", on the page's answer path. The store moves idle -> pending first,
 * so a second click sends nothing; a send that did not go out puts the chip back to idle.
 */
export async function sendStudioUndo(
  sessionId: string | null | undefined, changeId: string, messageId: string,
  gate: { answered: ReadonlySet<string>; send: AnswerSender },
  store: BulkEditUndoStore = studioBulkEditUndo,
): Promise<boolean> {
  if (!sessionId) return false
  try {
    if (!store.beginUndo(sessionId, changeId)) return false
    const action = undoChangeAction(changeId)
    await gate.send(action, messageId, action.value)
    const sent = gate.answered.has(action.value)
    if (!sent) store.cancelPending(sessionId, changeId)
    return sent
  } catch { store.cancelPending(sessionId, changeId); return false }
}
