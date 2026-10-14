import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import {
  advanceBlankStartCarry,
  browserBlankStartStorage,
  decideBlankStart,
  forgetBlankStart,
  hasBlankStart,
  rememberBlankStart,
  type BlankStartCarry,
} from '@/lib/studio-blank-start-new-session'

/**
 * NEXT_PUBLIC_STUDIO_BLANK_START_NEW_SESSION (default off; lib/studio-blank-start-new-session.ts has the cause): the page's wiring for
 * "Start on a blank canvas". Called after the page's own per-session reset of blankPlaceholderDismissed, so its effects run after it.
 *
 * With `enabled` false every effect returns at once (no storage read or write) and the page keeps passing its own dismiss handler.
 * With it true:
 *  - a session whose blank canvas the user started opens on that canvas again after a reload (the dismissal is restored before the
 *    first paint: a layout effect, then again after the page's passive reset, which React runs before re-rendering, so no frame shows
 *    the landing and then hides it);
 *  - a dismissal, from either button, is remembered for its session; a session with a real (generated or authored) deck is forgotten;
 *  - the returned handler opens a NEW session (the Builder's New flow) when the current one already holds a started deck, and then
 *    starts the new session's own blank canvas with the page's dismiss handler once its blank deck is owned; otherwise it dismisses.
 * It never makes a request and never saves a session row (no POST or PATCH: a started, still unsaved canvas stays unsaved).
 */
export interface StudioBlankStartOptions {
  enabled: boolean
  ownerId: string
  sessionId: string | null
  unsavedSession: boolean
  dismissed: boolean
  setDismissed: (dismissed: boolean) => void
  hasOwnedSelection: boolean
  showLanding: boolean
  /** The session shows a generated or authored deck: its blank-canvas memory is no longer needed. */
  hasRealDeck: boolean
  /** The page's handleDismissBlankPlaceholder. */
  dismiss: () => void
  /** The page's New flow (handleNewChatWrapped). */
  startNewSession: () => void
}

export function useStudioBlankStart(options: StudioBlankStartOptions): () => void {
  const latest = useRef(options)
  latest.current = options
  const { enabled, ownerId, sessionId, dismissed, hasOwnedSelection, showLanding, hasRealDeck } = options

  // Restore the choice for the session that just loaded: before paint, and again after the page's passive reset for that session.
  const restore = () => {
    if (enabled && hasBlankStart(browserBlankStartStorage(), ownerId, sessionId)) latest.current.setDismissed(true)
  }
  useLayoutEffect(restore, [enabled, ownerId, sessionId])
  useEffect(restore, [enabled, ownerId, sessionId])

  // Remember a dismissal for its own session (the commit that switches sessions still carries the previous session's value: skipped),
  // and forget a session once it has a real deck.
  const rememberedSessionRef = useRef(sessionId)
  useEffect(() => {
    const sameSession = rememberedSessionRef.current === sessionId
    rememberedSessionRef.current = sessionId
    if (!enabled) return
    if (hasRealDeck) forgetBlankStart(browserBlankStartStorage(), ownerId, sessionId)
    else if (sameSession && dismissed) rememberBlankStart(browserBlankStartStorage(), ownerId, sessionId)
  }, [enabled, ownerId, sessionId, dismissed, hasRealDeck])

  // Start the new session's blank canvas once its own blank deck is owned.
  const carryRef = useRef<BlankStartCarry | null>(null)
  useEffect(() => {
    if (!enabled) return
    const step = advanceBlankStartCarry(carryRef.current, { sessionId, hasOwnedSelection, showLanding })
    carryRef.current = step.carry
    if (step.dismiss) latest.current.dismiss()
  }, [enabled, sessionId, hasOwnedSelection, showLanding])

  return useCallback(() => {
    const current = latest.current
    const decision = decideBlankStart({
      enabled: current.enabled,
      sessionId: current.sessionId,
      started: current.enabled && hasBlankStart(browserBlankStartStorage(), current.ownerId, current.sessionId),
      unsavedSession: current.unsavedSession,
    })
    if (decision === 'new_session') {
      carryRef.current = { from: current.sessionId, to: null }
      current.startNewSession()
      return
    }
    current.dismiss()
  }, [])
}
