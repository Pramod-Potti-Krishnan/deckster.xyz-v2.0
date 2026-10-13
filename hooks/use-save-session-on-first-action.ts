import { useCallback, useRef } from 'react'
import { debugLog } from '@/lib/debug-log'
import { STUDIO_SESSION_HYGIENE_ENABLED, shouldSaveSessionOnFirstAction } from '@/lib/studio-session-hygiene'

/**
 * NEXT_PUBLIC_STUDIO_SESSION_HYGIENE (fix-forward for #361/#368): save the session row on the user's FIRST state-changing action.
 *
 * With the flag on, a bare /builder is a local, unsaved session and writes nothing (Director's automatic blank-deck frame
 * included). That is right until the user does something that makes the session worth keeping: apply a theme, pick a
 * template, add a slide or an element on the blank canvas. Without a row, a second tab (or another device) opening that URL
 * got "We couldn't find this session", because the "unsaved, ours" marker lives in this tab's sessionStorage only.
 *
 * The callback this hook returns wraps the Builder's existing draft-session creator (useBuilderSession.handleRequestSession,
 * the same one uploads use): POST the current id, mark it saved, clear the per-tab unsaved marker. Then it sends, once, the
 * blank-deck metadata (blankPresentationUrl/Id and the like) that Director's automatic frame delivered while there was no row
 * and that updateMetadata held back. It is safe to call from every trigger and as often as a user clicks:
 *  - flag off, no session yet, or a session that is already saved: it does nothing at all;
 *  - two triggers close together (a theme pick, then a template pick) share one request, and once this tab saved the id it
 *    never asks again, even before React has re-rendered `isUnsavedSession` (so there is exactly one POST);
 *  - a failure is logged and swallowed: the user's click keeps working, and the next one tries again.
 *
 * Triggers must be user actions only. Director's presentation_init, a bare visit and an idle tab are not triggers.
 */
export interface SaveSessionOnFirstActionOptions {
  currentSessionId: string | null
  isUnsavedSession: boolean
  /** useBuilderSession's handleRequestSession: POSTs the current id, marks it saved and clears the unsaved marker. */
  requestSession: () => Promise<void>
  /** useSessionPersistence's sendDeferredMetadata. */
  sendDeferredMetadata?: (sessionId: string) => Promise<void>
}

export function useSaveSessionOnFirstAction(options: SaveSessionOnFirstActionOptions): () => Promise<boolean> {
  // Latest render's values, read at call time: the callback below is stable and is held in refs by earlier-declared handlers.
  const latest = useRef(options)
  latest.current = options
  const savedHereRef = useRef<string | null>(null)
  const inFlightRef = useRef<{ sessionId: string; promise: Promise<boolean> } | null>(null)

  return useCallback((): Promise<boolean> => {
    if (!STUDIO_SESSION_HYGIENE_ENABLED) return Promise.resolve(false)
    const { currentSessionId, isUnsavedSession, requestSession, sendDeferredMetadata } = latest.current
    if (!currentSessionId) return Promise.resolve(false)
    const inFlight = inFlightRef.current
    if (inFlight && inFlight.sessionId === currentSessionId) return inFlight.promise
    if (!shouldSaveSessionOnFirstAction(STUDIO_SESSION_HYGIENE_ENABLED, {
      sessionId: currentSessionId, isUnsavedSession, savedHereId: savedHereRef.current,
    })) return Promise.resolve(false)

    const promise = (async () => {
      try {
        debugLog('[SESSION-HYGIENE] First user action on an unsaved session: saving the row for', currentSessionId)
        await requestSession()
        savedHereRef.current = currentSessionId
        await sendDeferredMetadata?.(currentSessionId)
        return true
      } catch (error) {
        console.warn('⚠️ [SESSION-HYGIENE] Could not save the session on the first action; the next action will try again:', error)
        return false
      }
    })().finally(() => {
      if (inFlightRef.current?.sessionId === currentSessionId) inFlightRef.current = null
    })
    inFlightRef.current = { sessionId: currentSessionId, promise }
    return promise
  }, [])
}
