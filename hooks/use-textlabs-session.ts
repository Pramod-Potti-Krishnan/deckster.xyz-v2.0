'use client'

import { useCallback, useRef, useState } from 'react'
import { createSession } from '@/lib/textlabs-client'

interface SessionViewState {
  presentationId: string | null
  sessionId: string | null
  isCreating: boolean
  error: string | null
}

interface InFlightSession {
  presentationId: string | null
  epoch: number
  promise: Promise<string>
}

function waitWithAbort(promise: Promise<string>, signal?: AbortSignal): Promise<string> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(new DOMException('Generation aborted', 'AbortError'))

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Generation aborted', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      value => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      error => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

/**
 * Manages a Text Labs session tied to exactly one displayed presentation.
 * Lazy creation on first ensureSession() call. A deck ownership transition
 * invalidates both a cached session and any creation finishing for the old ID.
 */
export function useTextLabsSession(presentationId: string | null) {
  const [viewState, setViewState] = useState<SessionViewState>({
    presentationId,
    sessionId: null,
    isCreating: false,
    error: null,
  })
  const activePresentationRef = useRef(presentationId)
  const epochRef = useRef(0)
  const sessionRef = useRef<{ presentationId: string | null; sessionId: string | null }>({
    presentationId,
    sessionId: null,
  })
  const inFlightRef = useRef<InFlightSession | null>(null)

  // Clear ownership synchronously during the render that receives a new deck;
  // an effect would leave one render where a stale session could still escape.
  if (activePresentationRef.current !== presentationId) {
    activePresentationRef.current = presentationId
    epochRef.current += 1
    sessionRef.current = { presentationId, sessionId: null }
  }

  const ensureSession = useCallback(async (signal?: AbortSignal): Promise<string> => {
    if (signal?.aborted) throw new DOMException('Generation aborted', 'AbortError')

    const targetPresentationId = activePresentationRef.current
    const targetEpoch = epochRef.current
    const currentSession = sessionRef.current
    if (
      currentSession.presentationId === targetPresentationId &&
      currentSession.sessionId
    ) {
      return currentSession.sessionId
    }

    const existingCreation = inFlightRef.current
    if (
      existingCreation?.presentationId === targetPresentationId &&
      existingCreation.epoch === targetEpoch
    ) {
      return waitWithAbort(existingCreation.promise, signal)
    }

    setViewState({
      presentationId: targetPresentationId,
      sessionId: null,
      isCreating: true,
      error: null,
    })

    let creationPromise: Promise<string>
    creationPromise = createSession(targetPresentationId, signal)
      .then(response => {
        if (
          activePresentationRef.current !== targetPresentationId ||
          epochRef.current !== targetEpoch
        ) {
          throw new Error('The presentation changed while the element session was being created.')
        }
        if (!response.session_id) throw new Error('Text Labs returned an invalid session.')

        sessionRef.current = {
          presentationId: targetPresentationId,
          sessionId: response.session_id,
        }
        setViewState({
          presentationId: targetPresentationId,
          sessionId: response.session_id,
          isCreating: false,
          error: null,
        })
        console.log('[TextLabs] Session created:', response.session_id)
        return response.session_id
      })
      .catch(error => {
        if (
          activePresentationRef.current === targetPresentationId &&
          epochRef.current === targetEpoch
        ) {
          const message = error instanceof Error ? error.message : 'Failed to create session'
          setViewState({
            presentationId: targetPresentationId,
            sessionId: null,
            isCreating: false,
            error: message,
          })
          console.error('[TextLabs] Session creation failed:', error)
        }
        throw error
      })
      .finally(() => {
        if (inFlightRef.current?.promise === creationPromise) {
          inFlightRef.current = null
        }
      })

    inFlightRef.current = {
      presentationId: targetPresentationId,
      epoch: targetEpoch,
      promise: creationPromise,
    }
    return waitWithAbort(creationPromise, signal)
  }, [])

  const resetSession = useCallback(() => {
    const targetPresentationId = activePresentationRef.current
    epochRef.current += 1
    sessionRef.current = { presentationId: targetPresentationId, sessionId: null }
    inFlightRef.current = null
    setViewState({
      presentationId: targetPresentationId,
      sessionId: null,
      isCreating: false,
      error: null,
    })
  }, [])

  const ownedView = viewState.presentationId === presentationId
    ? viewState
    : {
        presentationId,
        sessionId: null,
        isCreating: false,
        error: null,
      }

  return {
    sessionId: ownedView.sessionId,
    isCreating: ownedView.isCreating,
    error: ownedView.error,
    ensureSession,
    resetSession,
  }
}
