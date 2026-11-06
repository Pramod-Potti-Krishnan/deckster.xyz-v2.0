"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useChatSessions } from '@/hooks/use-chat-sessions'
import { COMPOSER_READY_KEY_PREFIX, requireComposerServiceUrl } from '@/lib/composer-library'
import { evaluateLayoutViewerUrl } from '@/lib/layout-viewer-url-policy'
import { LAYOUT_VIEWER_URL_POLICY } from '@/lib/layout-service-client'
import { uploadFileToResearcher } from '@/lib/researcher-upload'
import {
  DECK_IMPORT_POLL_RETRIES, DECK_IMPORT_START_ENDPOINT, DECK_IMPORT_WATCH_LIMIT_MS, DECK_IMPORT_WORDS, deckImportAcceptedJobId, deckImportBuilderHref,
  deckImportFileError, deckImportJobEndpoint, deckImportPendingKey, deckImportReadyResult, deckImportStartBody, deckImportStartFailure, deckImportTitle, deckImportView, parseDeckImportPending, rememberDeckImported,
  type DeckImportFailure, type DeckImportPending, type DeckImportSummary, type DeckImportView,
} from '@/lib/studio-deck-import'

// STUDIO DECK IMPORT (flag NEXT_PUBLIC_STUDIO_DECK_IMPORT, default off; the entry draws this dialog only with the flag on). The state of one import: choose a file, upload it to Researcher
// storage (storageOnly, as the template upload does), ask the proxy to start the import, poll it, then stage the result like a "Use original" result and open the Builder on it.
// A failed import can be started again (a NEW session id, upload and job); there is no partial retry. The job being waited on is kept in sessionStorage, so reopening the dialog (or
// reloading) picks it up again. Closing the dialog is not allowed while it works. Everything about what a job means lives in lib/studio-deck-import.ts.

export type DeckImportPhase = 'choose' | 'working' | 'ready' | 'failed'
export interface DeckImportWorking { words: string; detail: string | null; progress: { label: string; done: number; total: number } | null; eta: string | null; waiting: boolean }

const pause = (ms: number, signal: AbortSignal) => new Promise<boolean>(resolve => {
  if (signal.aborted) { resolve(false); return }
  const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(false) }
  const timer = setTimeout(() => { signal.removeEventListener('abort', done); resolve(true) }, ms)
  signal.addEventListener('abort', done, { once: true })
})

export function useStudioDeckImport(open: boolean) {
  const { user } = useAuth()
  const { createSession } = useChatSessions()
  const userId: string | undefined = user?.id || user?.email || undefined
  const [phase, setPhase] = useState<DeckImportPhase>('choose')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [working, setWorking] = useState<DeckImportWorking | null>(null)
  const [failure, setFailure] = useState<DeckImportFailure | null>(null)
  const [summary, setSummary] = useState<DeckImportSummary | null>(null)
  const [openHref, setOpenHref] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const fail = useCallback((signal: AbortSignal, reason: DeckImportFailure, pendingKey?: string) => {
    if (signal.aborted) return
    if (pendingKey) { try { sessionStorage.removeItem(pendingKey) } catch { /* nothing stored */ } }
    setWorking(null)
    setFailure(reason)
    setPhase('failed')
  }, [])

  // One poll loop for one job, from the start request or from a stored record.
  const watch = useCallback(async (pending: DeckImportPending, signal: AbortSignal, uid: string) => {
    const pendingKey = deckImportPendingKey(uid)
    const startedAt = Date.now()
    let transient = 0
    for (;;) {
      if (signal.aborted) return
      let job: unknown
      try {
        const response = await fetch(deckImportJobEndpoint(pending.job_id), { cache: 'no-store', signal })
        const body: unknown = await response.json().catch(() => null)
        if (signal.aborted) return
        if (!response.ok) {
          if ([502, 503, 504].includes(response.status) && ++transient <= DECK_IMPORT_POLL_RETRIES) {
            if (!await pause(3000, signal)) return
            continue
          }
          return fail(signal, deckImportStartFailure(response.status, body), pendingKey)
        }
        job = body
        transient = 0
      } catch {
        if (signal.aborted) return
        if (++transient <= DECK_IMPORT_POLL_RETRIES) {
          if (!await pause(3000, signal)) return
          continue
        }
        return fail(signal, { message: DECK_IMPORT_WORDS.LOST_TOUCH, retryable: true }, pendingKey)
      }
      const view: DeckImportView = deckImportView(job)
      if (view.kind === 'failed') return fail(signal, { message: view.message, retryable: view.retryable }, pendingKey)
      if (view.kind === 'ready') {
        const ready = deckImportReadyResult(view.result, pending.session_id)
        try {
          if (!ready) throw new Error('not this session\'s deck')
          // The same guards "Use original" applies before it stages a Composer deck.
          requireComposerServiceUrl(process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL, 'layout-builder-v75-uat.up.railway.app')
          requireComposerServiceUrl(new URL(ready.viewer_url).origin, 'layout-builder-v75-uat.up.railway.app')
          if (evaluateLayoutViewerUrl(ready.viewer_url, LAYOUT_VIEWER_URL_POLICY).status !== 'allowed') throw new Error('unapproved viewer address')
          sessionStorage.setItem(`${COMPOSER_READY_KEY_PREFIX}${pending.session_id}`, JSON.stringify({ user_id: uid, result: ready }))
          sessionStorage.removeItem(pendingKey)
        } catch {
          return fail(signal, { message: DECK_IMPORT_WORDS.OPEN_FAILED, retryable: true }, pendingKey)
        }
        if (signal.aborted) return
        // This browser now knows the session is an import: the Builder draws its note (the design is kept) only for such a session. Never fails the open.
        try { rememberDeckImported(window.localStorage, uid, pending.session_id) } catch { /* no localStorage: the note is not shown */ }
        const href = deckImportBuilderHref(pending.session_id)
        setWorking(null)
        setSummary(view.summary)
        setOpenHref(href)
        setPhase('ready')
        // Nothing to report: straight into the Builder. Something changed (or the notes were not kept): the person reads it first and opens the deck.
        if (!view.summary.banner && !view.summary.notesLine) window.location.assign(href)
        return
      }
      setWorking({ words: view.words, detail: view.detail, progress: view.progress, eta: view.eta, waiting: view.waiting })
      if (Date.now() - startedAt > DECK_IMPORT_WATCH_LIMIT_MS) return fail(signal, { message: DECK_IMPORT_WORDS.TIMEOUT, retryable: true }, pendingKey)
      if (!await pause(view.nextMs, signal)) return
    }
  }, [fail])

  const begin = useCallback(async () => {
    if (!file || !userId || phase === 'working') return
    const refusal = deckImportFileError(file)
    if (refusal) { setFileError(refusal); return }
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const { signal } = controller
    setFileError(null); setFailure(null); setSummary(null); setOpenHref(null)
    setPhase('working')
    setWorking({ words: 'Uploading your file…', detail: null, progress: null, eta: null, waiting: false })
    try {
      // The same guard as the template upload: Composer's flows talk to the UAT Researcher or a local one, never the older production default.
      try { requireComposerServiceUrl(process.env.NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL, 'researcher-v11-uat.up.railway.app') }
      catch { return fail(signal, { message: DECK_IMPORT_WORDS.IMPORT_UNAVAILABLE, retryable: false }) }
      // One fresh id is both the Researcher upload session and the Director session the deck is adopted into.
      const sessionId = crypto.randomUUID()
      if (!await createSession(sessionId, deckImportTitle(file.name))) return fail(signal, { message: DECK_IMPORT_WORDS.START_FAILED, retryable: true })
      if (signal.aborted) return
      const uploaded = await uploadFileToResearcher({
        sessionId, userId, file, intent: 'composer_template', storageOnly: true,
        onProgress: ({ percent }) => { if (!signal.aborted) setWorking({ words: `Uploading your file: ${percent}%`, detail: null, progress: null, eta: null, waiting: false }) },
      })
      if (signal.aborted) return
      setWorking({ words: 'Starting the import…', detail: null, progress: null, eta: null, waiting: false })
      let response: Response
      try {
        response = await fetch(DECK_IMPORT_START_ENDPOINT, {
          method: 'POST', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deckImportStartBody({ sessionId, researcherSessionId: uploaded.researcherSessionId, storagePath: uploaded.storagePath, fileName: file.name })),
        })
      } catch {
        return fail(signal, { message: DECK_IMPORT_WORDS.START_FAILED, retryable: true })
      }
      const body: unknown = await response.json().catch(() => null)
      if (signal.aborted) return
      const jobId = response.ok ? deckImportAcceptedJobId(body) : null
      if (!jobId) return fail(signal, response.ok ? { message: DECK_IMPORT_WORDS.START_FAILED, retryable: true } : deckImportStartFailure(response.status, body))
      const pending: DeckImportPending = { job_id: jobId, session_id: sessionId, file_name: file.name }
      try { sessionStorage.setItem(deckImportPendingKey(userId), JSON.stringify(pending)) } catch { /* the import still runs; only a reload cannot pick it up */ }
      await watch(pending, signal, userId)
    } catch (reason) {
      if (signal.aborted) return
      // The upload helper's own messages ("Storage upload failed (403)") are human-readable; anything else is the plain start failure.
      const message = reason && typeof (reason as { message?: unknown }).message === 'string' ? (reason as { message: string }).message : ''
      fail(signal, { message: message || DECK_IMPORT_WORDS.START_FAILED, retryable: true })
    }
  }, [file, userId, phase, createSession, fail, watch])

  // Reopening the dialog while an import is stored picks it up again.
  useEffect(() => {
    if (!open || !userId) return
    let pending: DeckImportPending | null = null
    try { pending = parseDeckImportPending(JSON.parse(sessionStorage.getItem(deckImportPendingKey(userId)) || 'null')) } catch { /* no record */ }
    if (!pending) return
    const controller = new AbortController()
    controllerRef.current?.abort()
    controllerRef.current = controller
    setPhase('working')
    setWorking({ words: 'Reconnecting to your import…', detail: null, progress: null, eta: null, waiting: false })
    void watch(pending, controller.signal, userId)
    return () => { controller.abort() }
  }, [open, userId, watch])

  const choose = useCallback((next: File | null) => {
    setFile(next)
    setFileError(next ? deckImportFileError(next) : null)
    setFailure(null)
    setPhase('choose')
  }, [])

  const reset = useCallback(() => {
    controllerRef.current?.abort()
    setFile(null); setFileError(null); setFailure(null); setWorking(null); setSummary(null); setOpenHref(null)
    setPhase('choose')
  }, [])

  // Leaving the page (or closing the dialog's owner) stops the polling; the stored job lets the next visit pick it up.
  useEffect(() => () => { controllerRef.current?.abort() }, [])

  const openDeck = useCallback(() => { if (openHref) window.location.assign(openHref) }, [openHref])

  return { phase, file, fileError, working, failure, summary, choose, begin, reset, openDeck, canStart: !!file && !fileError && !!userId && phase !== 'working' }
}
