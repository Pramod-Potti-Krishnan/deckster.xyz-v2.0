"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react"
import {
  STUDIO_PHONE_FULLSCREEN_TARGET,
  STUDIO_PHONE_HINTS_ENABLED,
  studioPhoneFullscreenCanTry,
  studioPhoneFullscreenNext,
  studioPhoneSwipeDirection,
  type StudioPhoneFullscreenState,
} from "@/lib/studio-phone-hints"

// STUDIO PHONE HINTS (NEXT_PUBLIC_STUDIO_PHONE_HINTS, default off; FRONTEND-1, F-13 PR 2): the state the hints share between the page (which knows when a swipe is allowed) and the viewer (which owns the slide and its navigation),
// the swipe itself, and Full screen. A small module store, because the page's hints and the viewer never share a parent that could carry it. Every decision is lib/studio-phone-hints.ts.

interface SwipeStore { on: boolean; swipes: number }
let store: SwipeStore = { on: false, swipes: 0 }
const listeners = new Set<() => void>()
const SERVER_STORE: SwipeStore = { on: false, swipes: 0 }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const getSnapshot = () => store
const getServerSnapshot = () => SERVER_STORE
const update = (next: Partial<SwipeStore>) => {
  const merged = { ...store, ...next }
  if (merged.on === store.on && merged.swipes === store.swipes) return
  store = merged
  listeners.forEach(listener => listener())
}

/** Whether a swipe changes the slide right now, and how many have (the hint ends with the first). */
export function useStudioPhoneSwipeState(): SwipeStore {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** The page tells the store whether a swipe is allowed (portrait slide view or the full-screen stage, not editing). */
export function setStudioPhoneSwipeOn(on: boolean) { update({ on }) }

/**
 * Swipe left / right on the slide space: next / previous slide through the viewer's own handlers (the arrows' and the keyboard's), nothing past either end. The stylesheet (keyed to the swipe attribute) sets touch-action: pan-y on the slide space and
 * lets the touches through the slide's frame, which would otherwise keep them; this only listens. Off the swipe's own state, and with the flag off, nothing is attached.
 */
export function useStudioPhoneSwipe(container: RefObject<HTMLElement | null>, onPrev: () => unknown, onNext: () => unknown, slide: number, count: number) {
  const { on } = useStudioPhoneSwipeState()
  const latest = useRef({ onPrev, onNext, slide, count })
  latest.current = { onPrev, onNext, slide, count }
  useEffect(() => {
    if (!STUDIO_PHONE_HINTS_ENABLED || !on) return
    const element = container.current
    if (!element) return
    let start: { x: number; y: number; t: number; id: number } | null = null
    const onDown = (event: PointerEvent) => { start = { x: event.clientX, y: event.clientY, t: event.timeStamp, id: event.pointerId } }
    const onUp = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return
      const from = start
      start = null
      const direction = studioPhoneSwipeDirection({ dx: event.clientX - from.x, dy: event.clientY - from.y, dt: event.timeStamp - from.t, slide: latest.current.slide, count: latest.current.count })
      if (!direction) return
      void (direction === "next" ? latest.current.onNext() : latest.current.onPrev())
      update({ swipes: store.swipes + 1 })
    }
    const onCancel = () => { start = null }
    element.addEventListener("pointerdown", onDown)
    element.addEventListener("pointerup", onUp)
    element.addEventListener("pointercancel", onCancel)
    return () => {
      element.removeEventListener("pointerdown", onDown)
      element.removeEventListener("pointerup", onUp)
      element.removeEventListener("pointercancel", onCancel)
    }
  }, [on, container])
}

/**
 * Full screen: the browser's, asked for INSIDE the tap (the handler calls enter() directly; nothing is awaited first), on the viewer's own box; a refusal (a rejected promise or a throw) or a browser with none (iPhone Safari) becomes a fixed 100dvh
 * stage of our own ('fallback', drawn by the stylesheet). The browser's own end (Escape, a system gesture) is followed on `fullscreenchange`. Never an orientation lock.
 */
export function useStudioPhoneFullscreen() {
  const [state, setState] = useState<StudioPhoneFullscreenState>("off")
  const current = useRef<StudioPhoneFullscreenState>("off")
  const move = useCallback((event: Parameters<typeof studioPhoneFullscreenNext>[1]) => {
    const next = studioPhoneFullscreenNext(current.current, event)
    current.current = next
    setState(next)
  }, [])
  const enter = useCallback(() => {
    const target = document.querySelector<HTMLElement>(STUDIO_PHONE_FULLSCREEN_TARGET)
    if (!target || !studioPhoneFullscreenCanTry({ fullscreenEnabled: document.fullscreenEnabled, hasRequest: typeof target.requestFullscreen === "function" })) { move("unsupported"); return }
    try {
      Promise.resolve(target.requestFullscreen()).then(() => move("granted"), () => move("refused"))
    } catch {
      move("refused")
    }
  }, [move])
  const exit = useCallback(() => {
    if (current.current === "native") { try { void document.exitFullscreen?.() } catch { /* the change event below ends it */ } return }
    move("exit")
  }, [move])
  useEffect(() => {
    if (!STUDIO_PHONE_HINTS_ENABLED) return
    const onChange = () => { if (!document.fullscreenElement) move("ended") }
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [move])
  useEffect(() => {
    if (state !== "fallback") return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") move("exit") }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [state, move])
  return { state, enter, exit }
}
