"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { STUDIO_SB_SESSION_MAX_PAGES, studioIndexSessions, studioSessionsPageUrl } from "@/lib/studio-p2-second-brain"

// PASS2 SB-10 (NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN). The person's own deck list (GET /api/sessions, read only), read once, the first time an entity is selected, so the inspector can
// show deck titles for an entity's contributing sessions. Never reads before `enabled`, never writes, and is dropped with the page (the page is keyed by account).
export type StudioDeckDirectoryStatus = "idle" | "loading" | "ready" | "error"
export interface StudioDeckDirectory {
  status: StudioDeckDirectoryStatus
  byId: Record<string, { title: string | null; slideCount: number | null }>
  reload: () => void
}

export function useStudioP2DeckTitles(enabled: boolean): StudioDeckDirectory {
  const [state, setState] = useState<{ status: StudioDeckDirectoryStatus; byId: StudioDeckDirectory["byId"] }>({ status: "idle", byId: {} })
  const [attempt, setAttempt] = useState(0)
  const startedRef = useRef(-1)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!enabled || startedRef.current === attempt) return
    startedRef.current = attempt
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setState({ status: "loading", byId: {} })
    void (async () => {
      try {
        const byId: StudioDeckDirectory["byId"] = {}
        for (let page = 0; page < STUDIO_SB_SESSION_MAX_PAGES; page++) {
          const response = await fetch(studioSessionsPageUrl(page), { signal: controller.signal })
          if (!response.ok) throw new Error("Deck list unavailable")
          const body = await response.json()
          studioIndexSessions(byId, body?.sessions)
          if (!body?.pagination?.hasMore) break
        }
        if (mountedRef.current && !controller.signal.aborted) setState({ status: "ready", byId })
      } catch {
        if (mountedRef.current && !controller.signal.aborted) setState({ status: "error", byId: {} })
      }
    })()
  }, [enabled, attempt])

  const reload = useCallback(() => setAttempt(current => current + 1), [])
  return { status: state.status, byId: state.byId, reload }
}
