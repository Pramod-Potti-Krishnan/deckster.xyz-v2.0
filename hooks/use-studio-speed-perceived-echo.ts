"use client"

// FRONTEND-2, NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED (exact "true", default off): the state and timers of the "Sending…" echo (lib/studio-speed-perceived.ts
// says what it is and why the end state stays the base's). The page wraps the composer's submit with `wrapSubmit` and hands `echo` to the chat; both
// only with the flag on. Off: `wrapSubmit` returns the handler it was given and `echo` is always null; no state is ever set and no timer is started.
import { useCallback, useEffect, useRef, useState } from 'react'
import { snapshotAttachedUploads, type UserChatMessage } from '@/lib/user-message-attachments'
import {
  STUDIO_SPEED_PERCEIVED_ENABLED,
  SPEED_ECHO_FAILED_MS,
  SPEED_ECHO_REVEAL_MS,
  speedEchoBegin,
  speedEchoFinished,
  speedEchoInFlight,
  speedEchoReveal,
  speedEchoSettle,
  speedEchoText,
  speedEchoView,
  type SpeedEchoState,
  type SpeedEchoView,
} from '@/lib/studio-speed-perceived'

export { STUDIO_SPEED_PERCEIVED_ENABLED } from '@/lib/studio-speed-perceived'

type UploadCandidates = Parameters<typeof snapshotAttachedUploads>[0]

export interface StudioSpeedPerceivedEchoInput {
  /** The page's committed user turns (session.userMessages). */
  userMessages: readonly UserChatMessage[]
  /** The session the chat shows (currentSessionId || wsSessionId). */
  scopeKey: string | null | undefined
  /** The composer's text; what a plain submit sends. */
  inputMessage: string
  /** The composer's files; the echo shows the ones the page would attach. */
  uploadedFiles?: UploadCandidates | null
  /** The page's manual-deck choice is open (pendingManualDeckBuild): a settled send is waiting on the user, not failed. */
  choiceOpen?: boolean
}

export interface StudioSpeedPerceivedEcho {
  readonly echo: SpeedEchoView | null
  readonly wrapSubmit: <A extends unknown[], R>(submit: (...args: A) => R) => (...args: A) => R
}

export function useStudioSpeedPerceivedEcho(input: StudioSpeedPerceivedEchoInput): StudioSpeedPerceivedEcho {
  const [echo, setEcho] = useState<SpeedEchoState | null>(null)
  const latestRef = useRef(input)
  latestRef.current = input
  const echoRef = useRef<SpeedEchoState | null>(echo)
  echoRef.current = echo
  const tokenRef = useRef(0)
  const revealTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>())

  const context = {
    userMessages: input.userMessages,
    scopeKey: input.scopeKey ?? null,
    inputMessage: input.inputMessage,
    choiceOpen: Boolean(input.choiceOpen),
  }
  const finished = speedEchoFinished(echo, context)
  const view = STUDIO_SPEED_PERCEIVED_ENABLED ? speedEchoView(echo, context) : null

  // A finished echo is dropped (it is already not drawn; this only lets go of it).
  useEffect(() => {
    if (finished) setEcho(previous => (previous === echo ? null : previous))
  }, [finished, echo])

  // A "Not sent" echo leaves on its own after SPEED_ECHO_FAILED_MS.
  const failedToken = echo && echo.settled && echo.revealed ? echo.token : null
  useEffect(() => {
    if (failedToken === null) return
    const timer = setTimeout(() => setEcho(previous => (previous?.token === failedToken ? null : previous)), SPEED_ECHO_FAILED_MS)
    return () => clearTimeout(timer)
  }, [failedToken])

  useEffect(() => () => {
    for (const timer of revealTimersRef.current) clearTimeout(timer)
    revealTimersRef.current.clear()
  }, [])

  const wrapSubmit = useCallback(<A extends unknown[], R>(submit: (...args: A) => R) => {
    if (!STUDIO_SPEED_PERCEIVED_ENABLED) return submit
    return (...args: A): R => {
      const current = latestRef.current
      const text = speedEchoText(current.inputMessage)
      const scopeKey = current.scopeKey ?? null
      if (!text || speedEchoInFlight(echoRef.current, text, scopeKey)) return submit(...args)
      const token = ++tokenRef.current
      const next = speedEchoBegin({
        token, text, scopeKey,
        attachments: snapshotAttachedUploads(current.uploadedFiles ?? []),
        userMessages: current.userMessages,
      })
      echoRef.current = next
      setEcho(next)
      const reveal = setTimeout(() => {
        revealTimersRef.current.delete(reveal)
        setEcho(previous => speedEchoReveal(previous, token))
      }, SPEED_ECHO_REVEAL_MS)
      revealTimersRef.current.add(reveal)
      const settle = () => { setEcho(previous => speedEchoSettle(previous, token)) }
      let result: R
      try {
        result = submit(...args)
      } catch (error) {
        settle()
        throw error
      }
      Promise.resolve(result).then(settle, settle)
      return result
    }
  }, [])

  return { echo: view, wrapSubmit }
}
