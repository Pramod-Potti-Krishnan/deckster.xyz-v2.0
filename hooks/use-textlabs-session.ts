'use client'

import { useState, useCallback, useRef } from 'react'
import { createSession } from '@/lib/textlabs-client'

/**
 * Manages a Text Labs session tied to a presentation.
 * Lazy creation on first ensureSession() call.
 */
export function useTextLabsSession(presentationId: string | null) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const creatingRef = useRef(false)

  const ensureSession = useCallback(async (signal?: AbortSignal): Promise<string> => {
    if (signal?.aborted) throw new DOMException('Generation aborted', 'AbortError')
    // Return existing session
    if (sessionId) return sessionId

    // Prevent concurrent creation
    if (creatingRef.current) {
      // Wait for in-flight creation
      return new Promise((resolve, reject) => {
        const onAbort = () => {
          clearInterval(interval)
          reject(new DOMException('Generation aborted', 'AbortError'))
        }
        const interval = setInterval(() => {
          if (!creatingRef.current) {
            clearInterval(interval)
            signal?.removeEventListener('abort', onAbort)
            if (sessionId) {
              resolve(sessionId)
            } else {
              reject(new Error('Session creation failed'))
            }
          }
        }, 100)
        signal?.addEventListener('abort', onAbort, { once: true })
        if (signal?.aborted) onAbort()
      })
    }

    creatingRef.current = true
    setIsCreating(true)
    setError(null)

    try {
      const response = await createSession(presentationId, signal)
      const newSessionId = response.session_id
      setSessionId(newSessionId)
      console.log('[TextLabs] Session created:', newSessionId)
      return newSessionId
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session'
      setError(message)
      console.error('[TextLabs] Session creation failed:', err)
      throw err
    } finally {
      creatingRef.current = false
      setIsCreating(false)
    }
  }, [presentationId, sessionId])

  const resetSession = useCallback(() => {
    setSessionId(null)
    setError(null)
  }, [])

  return {
    sessionId,
    isCreating,
    error,
    ensureSession,
    resetSession,
  }
}
