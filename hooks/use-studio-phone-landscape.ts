"use client"

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react"
import {
  STUDIO_PHONE_LANDSCAPE_ENABLED,
  STUDIO_PHONE_LANDSCAPE_QUERY,
  STUDIO_PHONE_RAIL_TOGGLE,
  studioPhoneRailSync,
  studioPhoneWorkspaceWidth,
  type StudioPhoneStripState,
} from "@/lib/studio-phone-landscape"

// STUDIO PHONE LANDSCAPE (NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE, default off; FRONTEND-1, F-13 PR 1): the hooks the page and the stage component use. Every decision is lib/studio-phone-landscape.ts; nothing here edits the viewer.

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
 * The viewer's thumbnail rail while the landscape stage is on: the rail is the strip's (open or collapsed by its own state), made so with the viewer's OWN toggle (a click on the control the phone "..." menu uses too), and the viewer's own value (the portrait one,
 * which is closed on a phone) is remembered when the stage goes on and put back when it goes off, so a rail opened sideways never squeezes the portrait slide. The toggle can arrive after the stage (the viewer mounts later): the page is followed until it has answered.
 * Off the stage with nothing remembered, and with the flag off, it does nothing.
 */
export function useStudioPhoneRailSync(stage: boolean, strip: StudioPhoneStripState) {
  const remembered = useRef<boolean | null>(null)
  useEffect(() => {
    if (!STUDIO_PHONE_LANDSCAPE_ENABLED) return
    const sync = (): boolean => {
      const toggle = document.querySelector<HTMLElement>(STUDIO_PHONE_RAIL_TOGGLE)
      const railOpen = toggle ? toggle.getAttribute("aria-expanded") === "true" : null
      const next = studioPhoneRailSync({ stage, strip, railOpen, remembered: remembered.current })
      remembered.current = next.remembered
      if (next.click) toggle?.click()
      return next.done
    }
    if (sync()) return
    const observer = new MutationObserver(() => { if (sync()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [stage, strip])
}
