"use client"

import { useState } from "react"
import { Check, Layers, Minus, Sparkles, X } from "lucide-react"
import { BULK_EDIT_COPY, bulkEditChoiceOf, bulkEditSummaryParts, bulkReasonWords, type BulkEditConfirm, type BulkEditReceipt } from "@/lib/studio-bulk-edit-wire"
import { studioBulkEditUndo, useStudioBulkEditUndoVersion, type BulkEditUndoStore } from "@/lib/studio-bulk-edit-store"
import "./studio-bulk-edit-undo.css"

type ChatAction = { label: string; value: string; primary: boolean; requires_input: boolean }

/**
 * FRONTEND-2 (PROGRAM-1 SUPERCHARGE I2, flag NEXT_PUBLIC_STUDIO_BULK_EDIT, Studio shell only, default off; drawn when Director's bulk_edit_confirm arrives, which it sends only to a client that advertised bulk_edit1).
 * Director's whole-deck edit, in chat: the confirm card (the user's instruction, how many slides, which ones, Director's own estimate, and the two answers
 * Director sent), then per-slide receipts as they arrive and a summary of counts. One answer only: after it both buttons are disabled and the chosen one is
 * shown. Nothing here is promised that was not sent: the cost is the estimate's own label, a failed or skipped slide says so with Director's reason, and a
 * summary reads "all changed" only when every slide changed. The summary is counts, never a second sentence: Director closes the turn in words.
 */
export function StudioBulkEditRow({ ask, model, sessionId, status, chosenValue = null, choose, rowProps, store = studioBulkEditUndo }: {
  ask: { message_id: string }
  model: BulkEditConfirm
  sessionId: string | null | undefined
  /** The page's own status for this ask: 'answered' / 'earlier' once it is no longer live. */
  status?: 'answered' | 'earlier'
  /** The action value the user's reply names (read from the transcript), so a reloaded card still shows the choice. */
  chosenValue?: string | null
  /** The page's answer path for this ask; resolves true only when the answer went out. */
  choose: (action: ChatAction, messageId: string) => Promise<boolean>
  rowProps?: Record<string, string>
  store?: BulkEditUndoStore
}) {
  useStudioBulkEditUndoVersion(store)
  const [sending, setSending] = useState<'confirm' | 'cancel' | null>(null)
  const bulk = store.bulk(sessionId, model.bulkId)
  const named = bulkEditChoiceOf(model, chosenValue)
  const answered = status === 'answered' || named !== null
  const locked = answered || status === 'earlier' || sending !== null
  const choice = named ?? sending
  const pick = (which: 'confirm' | 'cancel') => {
    if (locked) return
    setSending(which)
    const action = which === 'confirm' ? model.confirm : model.cancel
    choose({ label: action.label, value: action.value, primary: which === 'confirm', requires_input: false }, ask.message_id).then(sent => { if (!sent) setSending(null) }, () => setSending(null))
  }

  // Receipts of THIS bulk and of the slides it names only; a receipt whose slide id disagrees with the confirmed slide at that position is not shown.
  const receipts: (BulkEditReceipt | null)[] = model.slideIndexes.map((index, at) => {
    const receipt = bulk?.receipts[index] ?? null
    return receipt && !(receipt.slideId !== null && model.slideIds[at] !== null && receipt.slideId !== model.slideIds[at]) ? receipt : null
  })
  const reported = receipts.filter(receipt => receipt !== null).length
  const summary = bulk?.summary ? bulkEditSummaryParts(bulk.summary) : null
  const nameOf = (at: number) => {
    const title = bulk?.titles?.[at] ?? null
    return { number: model.slideIndexes[at] + 1, title }
  }
  const state = answered ? 'answered' : status === 'earlier' ? 'earlier' : sending ? 'sending' : 'ask'
  const count = `${model.slideCount} slide${model.slideCount === 1 ? '' : 's'}`

  return (
    <div data-studio-director-message="director" className="flex gap-3 animate-in fade-in duration-200" {...rowProps}>
      <div data-studio-director-part="avatar" className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
        <Sparkles className="h-3 w-3 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p data-studio-director-part="speaker" className="text-[11px] font-medium text-gray-500 dark:text-slate-400 mb-0.5">Director</p>
        <div data-studio-bulk-edit="confirm" data-studio-bulk-edit-state={state} data-studio-bulk-id={model.bulkId} data-director-action-id={ask.message_id} role="group" aria-label={`${BULK_EDIT_COPY.heading}: ${count}`}>
          <p data-studio-bulk-edit-part="heading"><Layers aria-hidden="true" /><span>{BULK_EDIT_COPY.heading}</span><span data-studio-bulk-edit-part="count">{count}</span></p>
          <p data-studio-bulk-edit-part="instruction">&ldquo;{model.instruction}&rdquo;</p>
          <ul data-studio-bulk-edit-part="chips" aria-label="Slides this changes">
            {model.slideIndexes.map((_index, at) => {
              const { number, title } = nameOf(at)
              const receipt = receipts[at]
              const Mark = receipt?.status === 'done' ? Check : receipt?.status === 'failed' ? X : receipt?.status === 'skipped' ? Minus : null
              return (
                <li key={at} data-studio-bulk-edit-chip="" data-state={receipt?.status ?? 'waiting'}>
                  {Mark ? <Mark aria-hidden="true" /> : null}
                  <span data-studio-bulk-edit-chip-part="number">{number}</span>
                  {title ? <span data-studio-bulk-edit-chip-part="title">{title}</span> : null}
                  {receipt ? <span className="sr-only">{`: ${BULK_EDIT_COPY.receipt[receipt.status]}`}</span> : null}
                </li>
              )
            })}
          </ul>
          {model.estimateLabel ? <p data-studio-bulk-edit-part="estimate">{BULK_EDIT_COPY.estimate}: {model.estimateLabel}</p> : null}
          <div data-studio-bulk-edit-part="actions">
            <button type="button" data-studio-bulk-edit-option="confirm" data-primary="true" disabled={locked} aria-pressed={choice === 'confirm' ? true : undefined} onClick={() => pick('confirm')}>{model.confirm.label}</button>
            <button type="button" data-studio-bulk-edit-option="cancel" disabled={locked} aria-pressed={choice === 'cancel' ? true : undefined} onClick={() => pick('cancel')}>{model.cancel.label}</button>
          </div>
          {state === 'sending' ? <p data-studio-bulk-edit-part="answer" role="status">{BULK_EDIT_COPY.sending}</p> : null}
          {state === 'answered' ? (
            <p data-studio-bulk-edit-part="answer">
              <Check aria-hidden="true" />
              {choice ? `${BULK_EDIT_COPY.chose}${choice === 'confirm' ? model.confirm.label : model.cancel.label}` : BULK_EDIT_COPY.answered}
            </p>
          ) : null}
          {state === 'earlier' ? <p data-studio-bulk-edit-part="answer">{BULK_EDIT_COPY.earlier}</p> : null}
          {reported > 0 && !summary ? <p data-studio-bulk-edit-part="progress" aria-live="polite">{BULK_EDIT_COPY.progress(reported, model.slideCount)}</p> : null}
          {summary ? (
            <p data-studio-bulk-edit-part="summary" data-summary-state={summary.state} role="status">
              {summary.parts.map((part, at) => <span key={at}>{part}</span>)}
            </p>
          ) : null}
          {receipts.some(receipt => receipt && receipt.status !== 'done') ? (
            <ul data-studio-bulk-edit-part="reasons" aria-label="Slides that did not change">
              {receipts.map((receipt, at) => {
                if (!receipt || receipt.status === 'done') return null
                const { number, title } = nameOf(at)
                const why = bulkReasonWords(receipt.reason)
                return <li key={at} data-state={receipt.status}>{`Slide ${number}${title ? ` · ${title}` : ''}: ${BULK_EDIT_COPY.receipt[receipt.status]}${why ? ` — ${why}` : ''}`}</li>
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}
