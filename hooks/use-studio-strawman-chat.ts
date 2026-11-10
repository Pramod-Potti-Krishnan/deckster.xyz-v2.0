"use client"

// STRAWMAN CHAT (NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT, default off): the one fact Studio keeps nowhere else, whether Director's build_phase said auto_proceed === true for this build (F-06).
// The page's narration handlers ref is what the socket hook calls for every typed build_phase frame; this hook wraps its onBuildPhase (as chat clean's notes hook does, and it is declared after that one)
// and hands each frame to lib/studio-strawman-chat.ts, which folds it. The page's own handler is not edited. Off, nothing is wrapped, kept or listened to.
import { useEffect, useRef, useState } from 'react'
import {
  STRAWMAN_CHAT_NO_AUTO_PROCEED,
  strawmanChatAutoProceedFor,
  strawmanChatAutoProceedStep,
  type StrawmanChatAutoProceed,
} from '@/lib/studio-strawman-chat'

type BuildPhaseHandler = (payload: unknown, ownerSessionId?: string) => void
type BuildPhaseHandlers = { onBuildPhase?: BuildPhaseHandler }

export interface UseStudioStrawmanChatInput {
  enabled: boolean
  /** The displayed session: a frame owned by another session is ignored. */
  sessionId: string | null | undefined
  /** The build the narration is on (null on the heuristic path: nothing is known, so nothing is auto). */
  buildId: string | null | undefined
  /** The page's narration handlers ref (the socket hook calls its onBuildPhase). */
  handlers?: { current: BuildPhaseHandlers | Record<string, never> } | null
}

const WRAPPED = Symbol.for('deckster.studio-strawman-chat.onBuildPhase')

export function useStudioStrawmanChat(input: UseStudioStrawmanChatInput) {
  const [seen, setSeen] = useState<StrawmanChatAutoProceed>(STRAWMAN_CHAT_NO_AUTO_PROCEED)
  const latestRef = useRef(input)
  latestRef.current = input

  // The page's own effect fills the ref whenever its inputs change (a fresh object, so the wrapper is gone); this one has no deps, runs after every commit, and wraps again when the handler is not ours.
  // A wrapper keeps the markers of the wrappers under it, so a hook that checks its own marker on the outermost handler (chat clean's) does not wrap a second time.
  useEffect(() => {
    const ref = latestRef.current.handlers
    if (!latestRef.current.enabled || !ref) return
    const current = ref.current as BuildPhaseHandlers
    const previous = current.onBuildPhase as (BuildPhaseHandler & { [WRAPPED]?: true }) | undefined
    if (typeof previous !== 'function' || previous[WRAPPED]) return
    const wrapped = ((payload, ownerSessionId) => {
      previous(payload, ownerSessionId)
      const now = latestRef.current
      if (!now.enabled) return
      setSeen(before => strawmanChatAutoProceedStep(before, payload as Parameters<typeof strawmanChatAutoProceedStep>[1], ownerSessionId, now.sessionId))
    }) as BuildPhaseHandler & Record<symbol, unknown>
    for (const key of Object.getOwnPropertySymbols(previous)) wrapped[key] = (previous as unknown as Record<symbol, unknown>)[key]
    wrapped[WRAPPED] = true
    ref.current = { ...current, onBuildPhase: wrapped }
  })

  return { autoProceed: input.enabled && strawmanChatAutoProceedFor(seen, input.buildId) }
}
