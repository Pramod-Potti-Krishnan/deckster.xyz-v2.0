"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { STUDIO_SB_MAX_SOURCE_ENTITIES, studioAggregateSources, type StudioSource } from "@/lib/studio-p2-second-brain"

// PASS2 SB-02 (NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN). The one read behind the read-only "Sources" list, shared by the stand-alone popover (StudioP2Sources) and the header menu that
// holds it beside Import / Refresh / Settings (StudioP2SourcesMenu, both flags on): the sources the graph's own evidence names, taken from the node-detail reads of the most reinforced
// entities (GET /api/knowledge-graph/nodes/<id>, the same read the inspector makes). Reads only after `open` is first true, never writes, and is dropped with the page.
export type StudioSourcesPhase = "idle" | "loading" | "ready"
export interface StudioSourcesRead {
  phase: StudioSourcesPhase
  sources: StudioSource[]
  /** How many of the entity reads failed (the list is then partial). */
  failed: number
  /** Reads the entities again (the "Try again" of a partial list). */
  retry: () => void
}

export function useStudioP2Sources(entities: ReadonlyArray<{ node_id: string }>, open: boolean): StudioSourcesRead {
  const [phase, setPhase] = useState<StudioSourcesPhase>("idle")
  const [sources, setSources] = useState<StudioSource[]>([])
  const [failed, setFailed] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const startedRef = useRef(-1)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const ids = entities.slice(0, STUDIO_SB_MAX_SOURCE_ENTITIES).map(entity => entity.node_id).filter(Boolean)
  const idsKey = ids.join("|")

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  // The list belongs to the entities it was read for: a refreshed graph with other top entities reads again the next time the panel is open.
  useEffect(() => {
    startedRef.current = -1
    setPhase("idle")
  }, [idsKey])

  useEffect(() => {
    if (!open || startedRef.current === attempt) return
    startedRef.current = attempt
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setPhase("loading")
    void (async () => {
      const details: unknown[] = []
      let unreadable = 0
      await Promise.all(ids.map(async id => {
        try {
          const response = await fetch(`/api/knowledge-graph/nodes/${encodeURIComponent(id)}`, { signal: controller.signal })
          if (!response.ok) throw new Error("unreadable")
          details.push(await response.json())
        } catch {
          unreadable += 1
        }
      }))
      if (!mountedRef.current || controller.signal.aborted) return
      setSources(studioAggregateSources(details))
      setFailed(unreadable)
      setPhase("ready")
    })()
  }, [open, attempt, idsKey])

  const retry = useCallback(() => setAttempt(current => current + 1), [])
  return { phase, sources, failed, retry }
}
