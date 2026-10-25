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
  STUDIO_BULK_EDIT_ENABLED, STUDIO_CHAT_UNDO_ENABLED, UNDO_COPY, BULK_EDIT_PROGRESS_TYPE, BULK_EDIT_SUMMARY_TYPE, CHANGE_RECORDED_TYPE, UNDO_RESULT_TYPE,
  frameSessionId, frameType, isBulkEditConfirmFrame, parseBulkEditConfirm, parseBulkEditProgress, parseBulkEditSummary, parseChangeRecorded,
  parseDirectorChatTurn, parseUndoResult, undoChangeAction, parseChangeAnchors, parseSyncedPresentation,
  type BulkEditConfirm, type BulkEditReceipt, type BulkEditSummary, type RecordedChange, type UndoResultStatus,
} from '@/lib/studio-bulk-edit-wire'
import { STUDIO_PASS3_POLISH_ENABLED } from '@/lib/studio-pass3-polish' // PASS3-POLISH-C (NEXT_PUBLIC_STUDIO_PASS3_POLISH, default off): a chip that is already Undone is final

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

/**
 * anchorMessageId = v1's rule: the latest Director line seen live before the change was recorded. liveAnchorId / historyAnchorId = Director's own anchors (undo v2: change_recorded.anchor_message_id and
 * anchor_history_id); replayed = the frame was re-sent after a reconnect. Which chat line the chip sits under is undoHostOf(record, the lines in the chat).
 */
export interface ChangeRecord { change: RecordedChange; anchorMessageId: string | null; liveAnchorId: string | null; historyAnchorId: string | null; replayed: boolean; seq: number; state: UndoPhase }

/**
 * Undo v2: the chat line a change's chip sits under. The line whose id is the live anchor, if that line is in the chat; else the line whose id is the replayed history anchor, if that is; else v1's rule
 * (the latest Director line seen live before the change). `present` = the ids of the Director chat lines the chat shows now; null = not known yet (nothing has been drawn): a live anchor stands, then
 * the history anchor, then v1's line. A line that is not in the chat hosts nothing, so a chip is never drawn under a line that is not there.
 */
export function undoHostOf(record: Pick<ChangeRecord, 'liveAnchorId' | 'historyAnchorId' | 'anchorMessageId'>, present: ReadonlySet<string> | null): string | null {
  if (record.liveAnchorId && (!present || present.has(record.liveAnchorId))) return record.liveAnchorId
  if (record.historyAnchorId && (!present || present.has(record.historyAnchorId))) return record.historyAnchorId
  return record.anchorMessageId
}
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
  /** Whose deck the canvas shows (null/absent: not known yet). Another session's deck never lends this one its presentation id (undo v2). */
  ownerSessionId?: string | null
}
export type BulkEditRoute = 'consumed' | 'pass'

interface SessionData {
  bulks: Map<string, BulkRecord>
  changes: ChangeRecord[]
  lastDirectorChat: string | null
  seq: number
  /** The Director chat lines the chat shows (undo v2; set by MessageList on every render); null until a chat has been drawn. */
  present: ReadonlySet<string> | null
  /** The deck Director's latest sync_response named (undo v2). */
  synced: string | null
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
    if (!data) { data = { bulks: new Map(), changes: [], lastDirectorChat: null, seq: 0, present: null, synced: null }; sessions.set(sessionId, data) }
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
        // UNDO V2: the deck Director names when a reconnect begins. A change re-sent at the end of that connect is for this deck, and it can arrive before the page has re-read which deck it shows.
        if (STUDIO_CHAT_UNDO_ENABLED && !foreign) dataFor(sessionId).synced = parseSyncedPresentation(frame)
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
        // UNDO V2: a re-send comes as the last frame of a reconnect, and the page may not have re-read which deck it shows by then: the deck Director's sync_response just named stands in, unless the canvas shows another session's deck.
        if (!context.presentationId && (context.ownerSessionId ?? sessionId) === sessionId) context = { ...context, presentationId: sessions.get(sessionId)?.synced ?? null }
        // Only the deck this tab displays: a frame for another presentation (or when none is known) is not recorded.
        if (!change || !context.presentationId || change.presentationId !== context.presentationId) return 'consumed'
        const data = dataFor(sessionId)
        const anchors = parseChangeAnchors(frame), known = findChange(data, change.changeId)
        if (known) {
          // UNDO V2: Director re-sends the latest undoable change after a reconnect (replayed: true). The chip this tab already has for that change_id is REPLACED in place (its label and anchors), never doubled,
          // and never revived: an Undone / Couldn't undo / pending / replaced chip keeps its state, an idle one stays idle. An anchor the re-send does not carry keeps the one it had.
          const liveAnchorId = anchors.liveAnchorId ?? known.liveAnchorId, historyAnchorId = anchors.historyAnchorId ?? known.historyAnchorId
          const moved = liveAnchorId !== known.liveAnchorId || historyAnchorId !== known.historyAnchorId || change.label !== known.change.label || change.kind !== known.change.kind
          known.change = change; known.liveAnchorId = liveAnchorId; known.historyAnchorId = historyAnchorId; known.replayed = known.replayed || anchors.replayed
          if (moved) changed()
          return 'consumed'
        }
        // Only the LATEST change can be undone: every older chip of this deck still waiting goes to "a later change replaced this" at once.
        for (const record of data.changes) if (record.change.presentationId === change.presentationId && record.state.phase === 'idle') record.state = { phase: 'superseded' }
        data.changes.push({ change, anchorMessageId: data.lastDirectorChat, ...anchors, seq: ++data.seq, state: { phase: 'idle' } })
        if (data.changes.length > MAX_CHANGES) data.changes.shift()
        changed()
        return 'consumed'
      }
      if (type === UNDO_RESULT_TYPE) {
        if (!STUDIO_CHAT_UNDO_ENABLED) return 'pass'
        if (foreign) return 'consumed'
        const result = parseUndoResult(frame)
        const record = result ? findChange(sessions.get(sessionId), result.changeId) : undefined
        if (STUDIO_PASS3_POLISH_ENABLED && record && record.state.phase === 'restored') return 'consumed' // PASS3-POLISH-C (default off): Undone stays Undone; a later undo_result for it (a click and a typed "undo that" in flight: restored, then superseded / not_latest) never overwrites it. Every other phase is as before: failed -> restored on a retry still works
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
    bulk: (sessionId: string | null | undefined, bulkId: string): BulkRecord | null => (sessionId ? sessions.get(sessionId)?.bulks.get(bulkId) ?? null : null),
    /** The newest change whose chip sits under this Director chat line (undoHostOf: its live anchor, else its history anchor, else the latest line seen live before it), or null. */
    changeFor(sessionId: string | null | undefined, messageId: string): ChangeRecord | null {
      const data = sessionId ? sessions.get(sessionId) : undefined
      const hits = data ? data.changes.filter(record => undoHostOf(record, data.present) === messageId) : []
      return hits.length ? hits[hits.length - 1] : null
    },
    /** The Director chat lines the chat shows now (MessageList reports them on every render, before its lines draw). Nothing is notified: the lines draw in the same pass. */
    setChatLines(sessionId: string, ids: ReadonlySet<string> | null): void { dataFor(sessionId).present = ids },
    /** The Director chat lines last reported for this session (null: none reported). */
    chatLines: (sessionId: string | null | undefined): ReadonlySet<string> | null => (sessionId ? sessions.get(sessionId)?.present ?? null : null),
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
    ownerSessionId: owner && typeof owner.deckOwnerSessionId === 'string' && owner.deckOwnerSessionId ? owner.deckOwnerSessionId : null,
    slideTitles: () => structure?.slides ?? [],
  }
}

/** The hook's single entry: one socket frame to this tab's store. */
export function routeStudioBulkEditUndoFrame(frame: unknown, context: BulkEditRouteContext, store: BulkEditUndoStore = studioBulkEditUndo): BulkEditRoute {
  return store.route(frame, context)
}

/**
 * Undo v2: MessageList tells the store which Director chat lines it is about to draw (an assistant chat_message that is not removed: the lines that host a chip), so a chip goes under its change's own anchor
 * line and never under a line that is not in the chat. Read-only on the list; flag off: nothing is recorded.
 */
export function noteStudioChatLines(sessionId: string | null | undefined, items: ReadonlyArray<unknown>, removedIds?: ReadonlySet<string>, store: BulkEditUndoStore = studioBulkEditUndo): void {
  try {
    if (!STUDIO_CHAT_UNDO_ENABLED || !sessionId || !Array.isArray(items)) return
    const ids = new Set<string>()
    for (const item of items) {
      const line = item as { messageType?: unknown; type?: unknown; message_id?: unknown } | null
      if (line && line.messageType === 'bot' && line.type === 'chat_message' && typeof line.message_id === 'string' && !removedIds?.has(line.message_id)) ids.add(line.message_id)
    }
    store.setChatLines(sessionId, ids)
  } catch { /* the chat never breaks over a chip */ }
}

/** Re-render the caller when the store changes (a receipt or a summary arrives, a change is recorded, an undo is answered): the confirm card and the Undo chip use it. Constant while nothing is routed, so with both flags off nothing re-renders. */
export function useStudioBulkEditUndoVersion(store: BulkEditUndoStore = studioBulkEditUndo): number {
  return useSyncExternalStore(store.subscribe, store.version, store.version)
}

// ---- what the chat draws ---------------------------------------------------------------------------------------------------------------------------

type AskLike = { message_id?: string; payload?: unknown }

/**
 * How the chat draws an action_request. null = an ordinary ask (the card it always had): the flag is off or the frame is not a bulk_edit_confirm. The frame is its own
 * capability (Director sends it only to a client that advertised bulk_edit1), so no sync_response is needed. 'hidden' = a bulk_edit_confirm that does not validate: nothing is drawn (a confirm without its slide list is never
 * answered blind). 'card' = the confirm card.
 */
export function bulkEditAskDecision(ask: AskLike):
  | { kind: 'card'; model: BulkEditConfirm } | { kind: 'hidden' } | null {
  try {
    if (!STUDIO_BULK_EDIT_ENABLED || !isBulkEditConfirmFrame({ type: 'action_request', payload: ask.payload })) return null
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
