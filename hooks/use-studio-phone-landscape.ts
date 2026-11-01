"use client"

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react"
import {
  STUDIO_PHONE_LANDSCAPE_ENABLED,
  STUDIO_PHONE_LANDSCAPE_QUERY,
  STUDIO_PHONE_STRIP_DEFAULT,
  studioPhoneRailOpen,
  studioPhoneStripToggle,
  studioPhoneWorkspaceWidth,
  type StudioPhoneStripState,
} from "@/lib/studio-phone-landscape"

// STUDIO PHONE LANDSCAPE (NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE, default off; FRONTEND-1, F-13 PR 1): the state the landscape stage shares between the page (which knows when the stage is on) and the viewer (which owns the thumbnail rail).
// A small module store, because the two never share a parent that could carry it. Every decision is lib/studio-phone-landscape.ts.

interface StageStore { stage: boolean; strip: StudioPhoneStripState }
let store: StageStore = { stage: false, strip: STUDIO_PHONE_STRIP_DEFAULT }
const listeners = new Set<() => void>()
const SERVER_STORE: StageStore = { stage: false, strip: STUDIO_PHONE_STRIP_DEFAULT }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const getSnapshot = () => store
const getServerSnapshot = () => SERVER_STORE
const update = (next: Partial<StageStore>) => {
  const merged = { ...store, ...next }
  if (merged.stage === store.stage && merged.strip === store.strip) return
  store = merged
  listeners.forEach(listener => listener())
}

/** The stage (on or off) and the strip's own state. */
export function useStudioPhoneStage(): StageStore {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** The page tells the store whether the landscape stage is on. A page that leaves takes the stage down with it. */
export function setStudioPhoneStage(stage: boolean) { update({ stage }) }

/** The strip's collapse / expand (its state is kept for the page's life, not written anywhere). */
export function toggleStudioPhoneStrip() { update({ strip: studioPhoneStripToggle(store.strip) }) }

/** A media query as a boolean: false on the server and until the browser has answered; follows `change` (a rotation on iOS and Android fires it). False for good with the flag off: nothing is listened to. */
export function useStudioPhoneQuery(query: string): boolean {
  const subscribeQuery = (listener: () => void) => {
    if (!STUDIO_PHONE_LANDSCAPE_ENABLED || typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {}
    const list = window.matchMedia(query)
    list.addEventListener("change", listener)
    return () => list.removeEventListener("change", listener)
  }
  const snapshot = () => STUDIO_PHONE_LANDSCAPE_ENABLED && typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches
  return useSyncExternalStore(subscribeQuery, snapshot, () => false)
}

// Where React cannot run a layout effect (the server render) an ordinary effect stands in; both are called the same way on every render.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * The page's workspace width, as the page decides by it, on a phone turned sideways: never over its own 880 px "one pane at a time" threshold (the stage hides the rail, so a 926 or 932 px phone's workspace is wider and the page would drop the stage).
 * Corrected before the browser paints, so no frame is drawn in the wrong layout. Does nothing with the flag off or off a phone turned sideways.
 */
export function useStudioPhoneWorkspaceClamp(workspaceWidth: number, setWorkspaceWidth: (width: number) => void) {
  const landscape = useStudioPhoneQuery(STUDIO_PHONE_LANDSCAPE_QUERY)
  useIsomorphicLayoutEffect(() => {
    if (!STUDIO_PHONE_LANDSCAPE_ENABLED) return
    const next = studioPhoneWorkspaceWidth(landscape, workspaceWidth)
    if (next !== workspaceWidth) setWorkspaceWidth(next)
  }, [landscape, workspaceWidth, setWorkspaceWidth])
}

/**
 * The viewer's thumbnail rail while the landscape stage is on: the rail is the stage strip's (its own open / collapsed state), and the viewer's own value (the portrait one, which can be closed on a phone) is
 * remembered when the stage goes on and put back when it goes off, so a rail opened sideways never squeezes the portrait slide. Off the stage, and with the flag off, it does nothing.
 */
export function useStudioPhoneLandscapeRail(showThumbnails: boolean, setShowThumbnails: (open: boolean) => void) {
  const { stage, strip } = useStudioPhoneStage()
  const remembered = useRef<boolean | null>(null)
  const latest = useRef(showThumbnails)
  latest.current = showThumbnails
  useEffect(() => {
    if (!STUDIO_PHONE_LANDSCAPE_ENABLED) return
    if (stage && remembered.current === null) remembered.current = latest.current
    if (!stage && remembered.current === null) return
    const open = studioPhoneRailOpen({ stage, strip, remembered: remembered.current, current: latest.current })
    if (!stage) remembered.current = null
    setShowThumbnails(open)
  }, [stage, strip, setShowThumbnails])
}
