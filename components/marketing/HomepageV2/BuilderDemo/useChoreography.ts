"use client"

import { useEffect, useReducer, useRef } from "react"
import type { RefObject } from "react"
import type { AgentId } from "@/lib/marketing/homepage-v2-content"
import { LOOP_DURATION_MS, STEPS } from "./choreography.data"
import type { ChoreoState, ChoreoStep } from "./types"
import { INITIAL_STATE } from "./types"

type Action =
  | { type: "apply"; step: ChoreoStep }
  | { type: "snap_final" }

function applyStep(state: ChoreoState, step: ChoreoStep): ChoreoState {
  switch (step.kind) {
    case "scope":
      return { ...state, scope: step.scope }
    case "chat":
      // Idempotent: don't re-add the same id if state already has it
      if (state.chatLines.some((l) => l.id === step.line.id)) return state
      return { ...state, chatLines: [...state.chatLines, step.line] }
    case "agent_pulse_start": {
      const next = new Set(state.pulsingAgents)
      next.add(step.agent)
      return { ...state, pulsingAgents: next }
    }
    case "agent_pulse_stop": {
      const next = new Set(state.pulsingAgents)
      next.delete(step.agent)
      return { ...state, pulsingAgents: next }
    }
    case "theme":
      return { ...state, slideBg: step.bgColor }
    case "element_add":
      if (state.slideElements.some((e) => e.id === step.element.id)) return state
      return {
        ...state,
        slideElements: [...state.slideElements, step.element],
      }
    case "reset":
      return {
        ...INITIAL_STATE,
        pulsingAgents: new Set<AgentId>(),
        seq: state.seq + 1,
      }
  }
}

function reducer(state: ChoreoState, action: Action): ChoreoState {
  switch (action.type) {
    case "apply":
      return applyStep(state, action.step)
    case "snap_final": {
      // Apply every non-reset step exactly once. Used for reduced-motion.
      let next: ChoreoState = { ...INITIAL_STATE, pulsingAgents: new Set() }
      for (const step of STEPS) {
        if (step.kind === "reset") continue
        next = applyStep(next, step)
      }
      // After snapping to final state, agents shouldn't be left mid-pulse.
      next = { ...next, pulsingAgents: new Set() }
      return next
    }
  }
}

interface UseChoreographyArgs {
  containerRef: RefObject<HTMLElement | null>
  reducedMotion: boolean
}

export function useChoreography({
  containerRef,
  reducedMotion,
}: UseChoreographyArgs): ChoreoState {
  const [state, dispatch] = useReducer(
    reducer,
    INITIAL_STATE,
    (init) => ({ ...init, pulsingAgents: new Set<AgentId>() }),
  )

  // Mutable runtime refs for the rAF loop. These are not React state because
  // changing them must not trigger re-renders.
  const startedAtRef = useRef<number>(0)
  const pointerRef = useRef<number>(0)
  const pausedAtRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const visibleRef = useRef<boolean>(false)
  const focusedRef = useRef<boolean>(true)

  // Reduced-motion: snap once to final state, never run the loop.
  useEffect(() => {
    if (!reducedMotion) return
    dispatch({ type: "snap_final" })
  }, [reducedMotion])

  useEffect(() => {
    if (reducedMotion) return
    if (typeof window === "undefined") return

    const node = containerRef.current
    if (!node) return

    const tick = () => {
      const now = performance.now()
      if (startedAtRef.current === 0) startedAtRef.current = now
      const elapsed = now - startedAtRef.current

      while (
        pointerRef.current < STEPS.length &&
        STEPS[pointerRef.current].t <= elapsed
      ) {
        const step = STEPS[pointerRef.current]
        dispatch({ type: "apply", step })
        pointerRef.current += 1
        if (step.kind === "reset") {
          // Restart the loop in place
          startedAtRef.current = now
          pointerRef.current = 0
          break
        }
      }

      // Safety net: if pointer somehow ran past array length without a reset
      // (shouldn't happen — reset is always the last step), wrap around.
      if (
        pointerRef.current >= STEPS.length &&
        elapsed >= LOOP_DURATION_MS
      ) {
        startedAtRef.current = now
        pointerRef.current = 0
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    const start = () => {
      if (rafRef.current != null) return
      // Resume: shift startedAt forward by the paused duration so elapsed
      // continues from where we stopped (timeline freezes during pause).
      if (pausedAtRef.current != null) {
        const pausedFor = performance.now() - pausedAtRef.current
        startedAtRef.current += pausedFor
        pausedAtRef.current = null
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    const stop = () => {
      if (rafRef.current == null) return
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      pausedAtRef.current = performance.now()
    }

    const sync = () => {
      const shouldRun = visibleRef.current && focusedRef.current
      if (shouldRun) start()
      else stop()
    }

    const io = new IntersectionObserver(
      (entries) => {
        visibleRef.current = entries[0]?.isIntersecting ?? false
        sync()
      },
      { threshold: 0.2 },
    )
    io.observe(node)

    focusedRef.current = document.visibilityState === "visible"
    const onVis = () => {
      focusedRef.current = document.visibilityState === "visible"
      sync()
    }
    document.addEventListener("visibilitychange", onVis)

    return () => {
      io.disconnect()
      document.removeEventListener("visibilitychange", onVis)
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      // Reset for next mount
      startedAtRef.current = 0
      pointerRef.current = 0
      pausedAtRef.current = null
      visibleRef.current = false
      focusedRef.current = true
    }
  }, [containerRef, reducedMotion])

  return state
}
