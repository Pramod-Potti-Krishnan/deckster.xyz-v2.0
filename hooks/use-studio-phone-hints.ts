"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  STUDIO_PHONE_FULLSCREEN_TARGET,
  STUDIO_PHONE_HINTS_ENABLED,
  studioPhoneFullscreenCanTry,
  studioPhoneFullscreenNext,
  studioPhoneSwipeDirection,
  type StudioPhoneFullscreenState,
} from "@/lib/studio-phone-hints"

// STUDIO PHONE HINTS (NEXT_PUBLIC_STUDIO_PHONE_HINTS, default off; FRONTEND-1, F-13 PR 2): the swipe and Full screen. Every decision is lib/studio-phone-hints.ts; nothing here edits the viewer.

/** The viewer's own keyboard navigation (the arrow keys it already handles on the window: its next / previous handlers, the ones the arrows had), as the key it listens for. */
const SWIPE_KEYS = { next: "ArrowRight", prev: "ArrowLeft" } as const
const SLIDE_SPACE = '[data-studio-slide-space="true"]'

/**
 * Swipe left / right on the slide space: the next / previous slide through the viewer's own keyboard handler (a key press the page dispatches on the body, which is what the arrows and the keyboard do, so the viewer's own guards, a build in progress or a
 * panel over the canvas, apply), nothing past either end. The stylesheet (keyed to the swipe attribute) sets touch-action: pan-y on the slide space and lets the touches through the slide's frame, which would otherwise keep them; this only listens: on the document, so a
 * viewer that mounts again is still heard, for a touch that starts inside the slide space. Nothing is attached with the flag off or while a swipe is not allowed. `onSwiped` is told after each swipe that changed the slide.
 */
export function useStudioPhoneSwipe(on: boolean, slide: number, count: number, onSwiped: () => void) {
  const latest = useRef({ slide, count, onSwiped })
  latest.current = { slide, count, onSwiped }
  useEffect(() => {
    if (!STUDIO_PHONE_HINTS_ENABLED || !on) return
    let start: { x: number; y: number; t: number; id: number } | null = null
    const inside = (event: Event) => event.target instanceof Element && event.target.closest(SLIDE_SPACE) !== null
    const onDown = (event: PointerEvent) => { start = inside(event) ? { x: event.clientX, y: event.clientY, t: event.timeStamp, id: event.pointerId } : null }
    const onUp = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return
      const from = start
      start = null
      const direction = studioPhoneSwipeDirection({ dx: event.clientX - from.x, dy: event.clientY - from.y, dt: event.timeStamp - from.t, slide: latest.current.slide, count: latest.current.count })
      if (!direction) return
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: SWIPE_KEYS[direction], bubbles: true, cancelable: true }))
      latest.current.onSwiped()
    }
    const onCancel = () => { start = null }
    document.addEventListener("pointerdown", onDown, true)
    document.addEventListener("pointerup", onUp, true)
    document.addEventListener("pointercancel", onCancel, true)
    return () => {
      document.removeEventListener("pointerdown", onDown, true)
      document.removeEventListener("pointerup", onUp, true)
      document.removeEventListener("pointercancel", onCancel, true)
    }
  }, [on])
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
