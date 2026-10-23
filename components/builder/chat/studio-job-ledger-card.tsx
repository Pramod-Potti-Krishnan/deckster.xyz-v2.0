"use client"

import { useEffect, useState } from "react"
import { AlertCircle } from "lucide-react"
import { createJobLedgerStore, jobLedgerCards, nextJobRetryWakeAt, type JobLedgerStore } from "@/lib/studio-job-ledger"
import "./studio-job-ledger-card.css"

/** This tab's job ledger (P3-4c, flag NEXT_PUBLIC_STUDIO_JOB_LEDGER): the Builder page hands its intake to the Director socket hook. */
export const studioJobLedger: JobLedgerStore = createJobLedgerStore()

/**
 * P3-4 slice C (flag NEXT_PUBLIC_STUDIO_JOB_LEDGER, Studio shell only, default off). One calm card at the end of the chat for each
 * Director job of this session that failed or timed out (a row another row retries shows none), in the CHAT_RECOVERY card's look
 * (studio-recovery-card.css) with an alert icon: Studio's words, Retry (frame-route rows only; it sends job_retry once and stays
 * disabled until a reply or 15 s) and Dismiss (hides that card in this tab; nothing is sent). Nothing here is retried automatically.
 */
export function StudioJobLedgerCards({ sessionId, sendJobRetry, store = studioJobLedger }: {
  sessionId: string | null | undefined
  sendJobRetry: (jobId: string) => boolean
  store?: JobLedgerStore
}) {
  const [, rerender] = useState(0)
  const seen = store.version()
  useEffect(() => {
    const unsubscribe = store.subscribe(() => rerender(n => n + 1))
    if (store.version() !== seen) rerender(n => n + 1) // a row that landed between this render and the subscription
    return unsubscribe
  }, [store]) // eslint-disable-line react-hooks/exhaustive-deps -- `seen` is the version this render read
  const ledger = store.ledger(sessionId || '')
  const now = Date.now()
  const cards = sessionId ? jobLedgerCards(ledger, now) : []
  const wakeAt = sessionId ? nextJobRetryWakeAt(ledger, now) : null
  useEffect(() => {
    if (wakeAt === null) return
    const timer = setTimeout(() => rerender(n => n + 1), Math.max(0, wakeAt - Date.now()))
    return () => clearTimeout(timer)
  }, [wakeAt])
  if (!sessionId || cards.length === 0) return null
  return (
    <div data-studio-job-ledger-list="true">
      {cards.map(card => (
        <div key={card.jobId} data-studio-job-ledger={card.state} data-studio-job-ledger-kind={card.kind} data-studio-job-ledger-id={card.jobId} role="note" aria-label={card.title}>
          <AlertCircle size={14} aria-hidden="true" />
          <div>
            <p data-studio-job-ledger-part="title">{card.title}</p>
            {card.body ? <p data-studio-job-ledger-part="body">{card.body}</p> : null}
            <div data-studio-job-ledger-part="actions">
              {card.retry !== 'none' ? (
                <button type="button" data-studio-job-ledger-part="retry" disabled={card.retry === 'waiting'} aria-busy={card.retry === 'waiting'}
                  onClick={() => { store.retry(sessionId, card.jobId, sendJobRetry) }}>
                  {card.retry === 'waiting' ? 'Retrying…' : 'Retry'}
                </button>
              ) : null}
              <button type="button" data-studio-job-ledger-part="dismiss" onClick={() => store.dismiss(sessionId, card.jobId)}>Dismiss</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
