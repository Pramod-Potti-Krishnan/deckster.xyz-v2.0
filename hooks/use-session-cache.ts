/**
 * Browser-level session caching using sessionStorage
 *
 * Provides instant restoration of session state across tab switches
 * and page refreshes without requiring database round-trips.
 *
 * Architecture:
 * - Tier 1: React State (in-memory, fast, lost on unmount)
 * - Tier 2: Browser Cache (sessionStorage, survives tab switches)
 * - Tier 3: Database (permanent, cross-device, slower)
 */

import { useCallback, useEffect, useRef } from 'react'
import { DirectorMessage } from './use-deckster-websocket-v2'

const CACHE_VERSION = 1 // Increment when schema changes
const DEFAULT_TTL = 24 * 60 * 60 * 1000 // 24 hours
const MAX_MESSAGES = 500 // Limit to prevent quota issues

// Cache key generation
const CACHE_KEYS = {
  SESSION_STATE: (sessionId: string) => `deckster_session_${sessionId}`,
  METADATA: (sessionId: string) => `deckster_metadata_${sessionId}`,
}

// Cached session state structure
export interface CachedSessionState {
  // WebSocket messages
  messages: DirectorMessage[]
  userMessages: Array<{ id: string; text: string; timestamp: number }>

  // Presentation URLs (both versions)
  presentationUrl: string | null
  strawmanPreviewUrl: string | null
  finalPresentationUrl: string | null
  presentationId: string | null
  strawmanPresentationId: string | null
  finalPresentationId: string | null
  activeVersion: 'strawman' | 'final'

  // Slide metadata
  slideCount: number | null
  slideStructure: any | null
  currentStatus: any | null

  // Cache metadata
  lastUpdated: number
  version: number
}

export interface SessionCacheOptions {
  sessionId: string
  enabled?: boolean
  ttl?: number // Time to live in milliseconds
}

export interface SessionCache {
  // Read operations
  getCachedState: () => CachedSessionState | null
  getCachedMessages: () => DirectorMessage[] | null
  getCachedUserMessages: () => Array<{ id: string; text: string; timestamp: number }> | null

  // Write operations (synchronous)
  setCachedState: (state: Partial<CachedSessionState>) => void
  appendMessage: (message: DirectorMessage, userText?: string) => void
  updateMetadata: (updates: Partial<CachedSessionState>) => void

  // Utility
  clearCache: () => void
  isCacheValid: () => boolean
  getLastSyncTime: () => number | null
}

export function useSessionCache(options: SessionCacheOptions): SessionCache {
  const { sessionId, enabled = true, ttl = DEFAULT_TTL } = options
  const sessionIdRef = useRef(sessionId)

  // Update session ID ref when it changes
  useEffect(() => {
    if (sessionIdRef.current !== sessionId) {
      console.log(`🔄 Session ID changed from ${sessionIdRef.current} to ${sessionId}`)
      sessionIdRef.current = sessionId
      // Clear old session cache when session changes
      if (sessionIdRef.current) {
        const oldKey = CACHE_KEYS.SESSION_STATE(sessionIdRef.current)
        try {
          sessionStorage.removeItem(oldKey)
          console.log(`🗑️ Cleared cache for old session: ${sessionIdRef.current}`)
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }, [sessionId])

  /**
   * Get the complete cached session state
   */
  const getCachedState = useCallback((): CachedSessionState | null => {
    if (!enabled || !sessionId) return null

    try {
      const key = CACHE_KEYS.SESSION_STATE(sessionId)
      const cached = sessionStorage.getItem(key)

      if (!cached) {
        return null
      }

      const parsed = JSON.parse(cached) as CachedSessionState
      return parsed
    } catch (error) {
      console.error('❌ Failed to read from cache:', error)
      return null
    }
  }, [enabled, sessionId])

  /**
   * Check if cached data is still valid (not expired)
   */
  const isCacheValid = useCallback((): boolean => {
    const cached = getCachedState()
    if (!cached) return false

    // Check version
    if (cached.version !== CACHE_VERSION) {
      console.log('❌ Cache version mismatch:', { cached: cached.version, current: CACHE_VERSION })
      return false
    }

    // Check TTL
    const age = Date.now() - cached.lastUpdated
    if (age > ttl) {
      console.log('❌ Cache expired (TTL exceeded):', { age, ttl })
      return false
    }

    return true
  }, [getCachedState, ttl])

  /**
   * Get cached messages only
   */
  const getCachedMessages = useCallback((): DirectorMessage[] | null => {
    const state = getCachedState()
    return state?.messages || null
  }, [getCachedState])

  /**
   * Get cached user messages only
   */
  const getCachedUserMessages = useCallback(() => {
    const state = getCachedState()
    return state?.userMessages || null
  }, [getCachedState])

  /**
   * Get last sync timestamp
   */
  const getLastSyncTime = useCallback((): number | null => {
    const state = getCachedState()
    return state?.lastUpdated || null
  }, [getCachedState])

  /**
   * Trim cache to prevent quota exceeded errors
   */
  const trimCache = useCallback((state: Partial<CachedSessionState>): Partial<CachedSessionState> => {
    const trimmed = { ...state }

    // Trim messages to last N items
    if (trimmed.messages && trimmed.messages.length > MAX_MESSAGES) {
      console.warn(`⚠️ Trimming messages from ${trimmed.messages.length} to ${MAX_MESSAGES}`)
      trimmed.messages = trimmed.messages.slice(-MAX_MESSAGES)
    }

    if (trimmed.userMessages && trimmed.userMessages.length > MAX_MESSAGES) {
      console.warn(`⚠️ Trimming user messages from ${trimmed.userMessages.length} to ${MAX_MESSAGES}`)
      trimmed.userMessages = trimmed.userMessages.slice(-MAX_MESSAGES)
    }

    return trimmed
  }, [])

  /**
   * Set cached state (synchronous write)
   */
  const setCachedState = useCallback((state: Partial<CachedSessionState>): void => {
    if (!enabled || !sessionId) return

    try {
      const key = CACHE_KEYS.SESSION_STATE(sessionId)
      const existing = getCachedState() || {} as CachedSessionState

      const updated: CachedSessionState = {
        ...existing,
        ...state,
        lastUpdated: Date.now(),
        version: CACHE_VERSION,
      }

      sessionStorage.setItem(key, JSON.stringify(updated))

      // Log cache writes in development (but not too verbose)
      if (process.env.NODE_ENV === 'development') {
        const hasNewMessage = state.messages && state.messages.length !== existing.messages?.length
        if (hasNewMessage) {
          console.log('💾 Cache updated:', {
            messages: updated.messages?.length || 0,
            userMessages: updated.userMessages?.length || 0,
            presentations: {
              strawman: !!updated.strawmanPreviewUrl,
              final: !!updated.finalPresentationUrl,
            }
          })
        }
      }
    } catch (error) {
      // Handle quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('⚠️ sessionStorage quota exceeded, attempting to trim cache')

        try {
          const trimmed = trimCache(state)
          const key = CACHE_KEYS.SESSION_STATE(sessionId)
          const existing = getCachedState() || {} as CachedSessionState

          const updated: CachedSessionState = {
            ...existing,
            ...trimmed,
            lastUpdated: Date.now(),
            version: CACHE_VERSION,
          }

          sessionStorage.setItem(key, JSON.stringify(updated))
          console.log('✅ Cache trimmed and saved successfully')
        } catch (retryError) {
          console.error('❌ Failed to save even after trimming:', retryError)
          // Gracefully degrade - cache writes fail but app continues
        }
      } else {
        console.error('❌ Failed to write to cache:', error)
      }
    }
  }, [enabled, sessionId, getCachedState, trimCache])

  /**
   * Append a single message to cache (optimized for frequent writes)
   */
  const appendMessage = useCallback((message: DirectorMessage, userText?: string): void => {
    if (!enabled || !sessionId) return

    try {
      const existing = getCachedState() || {} as CachedSessionState
      const messages = existing.messages || []
      const userMessages = existing.userMessages || []

      // Add message to messages array
      const updatedMessages = [...messages, message]

      // If this is a user message, also add to userMessages array
      let updatedUserMessages = userMessages
      if (userText) {
        updatedUserMessages = [
          ...userMessages,
          {
            id: message.message_id,
            text: userText,
            timestamp: Date.now(),
          }
        ]
      }

      // Write to cache
      setCachedState({
        messages: updatedMessages,
        userMessages: updatedUserMessages,
      })
    } catch (error) {
      console.error('❌ Failed to append message to cache:', error)
    }
  }, [enabled, sessionId, getCachedState, setCachedState])

  /**
   * Update metadata only (presentation URLs, slide counts, etc.)
   */
  const updateMetadata = useCallback((updates: Partial<CachedSessionState>): void => {
    if (!enabled || !sessionId) return

    setCachedState(updates)
  }, [enabled, sessionId, setCachedState])

  /**
   * Clear the cache for this session
   */
  const clearCache = useCallback((): void => {
    if (!sessionId) return

    try {
      const key = CACHE_KEYS.SESSION_STATE(sessionId)
      sessionStorage.removeItem(key)
      console.log(`🗑️ Cleared cache for session: ${sessionId}`)
    } catch (error) {
      console.error('❌ Failed to clear cache:', error)
    }
  }, [sessionId])

  // Return the cache interface
  return {
    getCachedState,
    getCachedMessages,
    getCachedUserMessages,
    isCacheValid,
    getLastSyncTime,
    setCachedState,
    appendMessage,
    updateMetadata,
    clearCache,
  }
}
