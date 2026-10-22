"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  STUDIO_KG_ASK_ENDPOINT, STUDIO_KG_ASK_TIMEOUT_MS, studioKgAskCheck, studioKgAskClientBody, studioKgAskErrorText, studioKgAskIsEmpty, studioKgAskNormalise,
  type StudioKgAskFailure, type StudioKgAskResult,
} from "@/lib/studio-kg-ask"

// "Ask your second brain" (NEXT_PUBLIC_STUDIO_KG_ASK): one question at a time to POST /api/knowledge-graph/query. Read only; nothing is written. A newer question, a clear, or leaving the
// page cancels the one in flight, and an answer that arrives for a question that is no longer the current one is never shown.

export type StudioKgAskPhase = "idle" | "loading" | "ready" | "empty" | "error"
export interface StudioKgAskState { phase: StudioKgAskPhase; asked: string; result: StudioKgAskResult | null; error: string | null }

const IDLE: StudioKgAskState = { phase: "idle", asked: "", result: null, error: null }

export function useStudioKgAsk() {
  const [state, setState] = useState<StudioKgAskState>(IDLE)
  const generationRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      controllerRef.current?.abort()
    }
  }, [])

  /** Sends the question. Returns false (and sends nothing) when the question is empty or too long. */
  const ask = useCallback((raw: string): boolean => {
    const checked = studioKgAskCheck(raw)
    if (!checked.ok) return false
    const generation = ++generationRef.current
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const current = () => mountedRef.current && generationRef.current === generation
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, STUDIO_KG_ASK_TIMEOUT_MS)
    const fail = (failure: StudioKgAskFailure) => { if (current()) setState({ phase: "error", asked: checked.question, result: null, error: studioKgAskErrorText(failure) }) }

    setState({ phase: "loading", asked: checked.question, result: null, error: null })
    void (async () => {
      try {
        const resp = await fetch(STUDIO_KG_ASK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(studioKgAskClientBody(checked.question)),
          signal: controller.signal,
        })
        if (!resp.ok) return fail({ status: resp.status })
        const result = studioKgAskNormalise(await resp.json().catch(() => null))
        if (!result) return fail({ unreadable: true })
        if (current()) setState({ phase: studioKgAskIsEmpty(result) ? "empty" : "ready", asked: checked.question, result, error: null })
      } catch {
        fail(timedOut ? { timeout: true } : { network: true })
      } finally {
        clearTimeout(timer)
        if (controllerRef.current === controller) controllerRef.current = null
      }
    })()
    return true
  }, [])

  /** Back to the idle hint; a question still in flight is cancelled. */
  const reset = useCallback(() => {
    generationRef.current += 1
    controllerRef.current?.abort()
    controllerRef.current = null
    setState(IDLE)
  }, [])

  return { state, ask, reset }
}
