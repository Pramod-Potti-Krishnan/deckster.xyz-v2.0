"use client"

import { useEffect } from "react"
import { Check, Loader2, Undo2 } from "lucide-react"
import { UNDO_COPY, undoReasonWords } from "@/lib/studio-bulk-edit-wire"
import { studioBulkEditUndo, useStudioBulkEditUndoVersion, UNDO_PENDING_TIMEOUT_MS, type BulkEditUndoStore } from "@/lib/studio-bulk-edit-store"
import "./studio-bulk-edit-undo.css"

/**
 * FRONTEND-2 (PROGRAM-1 SUPERCHARGE I2, flag NEXT_PUBLIC_STUDIO_CHAT_UNDO, Studio shell only, default off; drawn only when Director advertises `chat_undo`).
 * A small "Undo" chip under the Director chat line that reported a change Director recorded (change_recorded). It sends ONE undo request, as a user_message
 * with data.action_value "undo_change:<change_id>" on the page's own answer path, and never writes to Layout. States: idle, pending (spinner, disabled),
 * "Undone", "Couldn't undo: <reason>", and "A later change replaced this" (a newer change was recorded, or Director says a later edit replaced it).
 * A real button, so it is keyboard reachable; its accessible name is "Undo: <label>".
 */
export function StudioUndoChip({ sessionId, messageId, undo, store = studioBulkEditUndo }: {
  sessionId: string | null | undefined
  /** The Director chat line this chip sits under. */
  messageId: string
  /** Sends the undo request (once); resolves true only when it went out. */
  undo: (changeId: string, messageId: string) => Promise<boolean>
  store?: BulkEditUndoStore
}) {
  useStudioBulkEditUndoVersion(store)
  const record = sessionId && store.capabilities(sessionId).chatUndo ? store.changeFor(sessionId, messageId) : null
  const pending = record?.state.phase === 'pending'
  useEffect(() => {
    if (!pending || !sessionId) return
    const timer = setTimeout(() => { store.expirePending(sessionId) }, UNDO_PENDING_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [pending, sessionId, store])
  if (!record || !sessionId) return null
  const { change, state } = record
  const name = `Undo: ${change.label}`
  const ids = { 'data-studio-chat-undo-change': change.changeId }
  let chip
  if (state.phase === 'idle') {
    chip = <button type="button" data-studio-chat-undo="idle" aria-label={name} title={name} {...ids} onClick={() => { void undo(change.changeId, messageId) }}><Undo2 aria-hidden="true" /><span>{UNDO_COPY.idle}</span></button>
  } else if (state.phase === 'pending') {
    chip = <button type="button" data-studio-chat-undo="pending" disabled aria-busy="true" aria-label={name} {...ids}><Loader2 aria-hidden="true" /><span>{UNDO_COPY.pending}</span></button>
  } else if (state.phase === 'restored') {
    chip = <span data-studio-chat-undo="restored" role="status" {...ids}><Check aria-hidden="true" /><span>{UNDO_COPY.restored}</span></span>
  } else if (state.phase === 'failed') {
    const why = undoReasonWords(state.reason)
    chip = <span data-studio-chat-undo="failed" role="status" {...ids}><span>{why ? `${UNDO_COPY.failed}: ${why}` : UNDO_COPY.failed}</span></span>
  } else {
    chip = <button type="button" data-studio-chat-undo="superseded" disabled aria-label={`${name}. ${UNDO_COPY.superseded}`} {...ids}><Undo2 aria-hidden="true" /><span>{UNDO_COPY.superseded}</span></button>
  }
  return <div data-studio-chat-undo-slot="">{chip}</div>
}
