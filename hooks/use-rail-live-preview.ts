"use client"

import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  RAIL_LIVE_PREVIEW_PENDING_GRACE_MS,
  createRailLivePreviewController,
  railBoxVisible,
  railPreviewSlots,
  type RailBox,
  type RailLivePreviewController,
} from '@/lib/rail-live-preview'

/**
 * Whether the element is on screen right now: inside the viewport and inside every ancestor that clips it (a scroll
 * container, an overflow-hidden panel). Read straight from layout, so it needs no rendered frame. Never throws.
 */
function hostOnScreen(host: HTMLElement): boolean {
  try {
    const clips: RailBox[] = [{ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }]
    for (let el = host.parentElement; el && el !== document.documentElement; el = el.parentElement) {
      const style = getComputedStyle(el)
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') clips.push(el.getBoundingClientRect())
    }
    return railBoxVisible(host.getBoundingClientRect(), clips)
  } catch {
    return false
  }
}

/**
 * Whether one rail card may show its live mini-preview frame right now (F9-A).
 *
 * `eligible` is the card's own rule (an approved frame URL exists, and the status allows it); the other half is
 * visibility: an IntersectionObserver on the element behind `hostRef` reports when the card is on screen.
 * The frame is mounted only while the card is eligible AND visible AND holds one of the rail's
 * few shared slots (lib/rail-live-preview.ts), and `mounted` goes false in the same render in
 * which `eligible` does, so a frame never outlives the reason for it. Without an
 * IntersectionObserver nothing is ever mounted. Never throws, never makes a request.
 *
 * The observer's first answer only arrives once the browser has rendered a frame, which a hidden or throttled page does
 * not do for as long as it stays that way. Until the observer has answered, the card's own geometry stands in for it
 * (checked when the card first becomes eligible), so a card that is already on screen mounts at once. The observer
 * always has the last word: its first answer replaces the stand-in, and the stand-in is never consulted again.
 */
export function useRailLivePreview(eligible: boolean): { hostRef: RefObject<HTMLDivElement | null>; mounted: boolean } {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<RailLivePreviewController | null>(null)
  // true once an IntersectionObserver is watching the host; true once it has answered at least once.
  const observingRef = useRef(false)
  const answeredRef = useRef(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const controller = createRailLivePreviewController({ pool: railPreviewSlots, onChange: setMounted })
    controllerRef.current = controller
    const host = hostRef.current
    let observer: IntersectionObserver | null = null
    observingRef.current = false
    answeredRef.current = false
    if (host && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        const latest = entries[entries.length - 1]
        if (!latest) return
        answeredRef.current = true
        controller.setVisible(latest.isIntersecting)
      })
      observer.observe(host)
      observingRef.current = true
    }
    return () => {
      observer?.disconnect()
      observingRef.current = false
      controller.dispose()
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [])

  useEffect(() => {
    const controller = controllerRef.current
    if (!controller) return
    controller.setEligible(eligible)
    // Not yet heard from the observer: ask the layout directly whether the card is on screen.
    const host = hostRef.current
    if (eligible && host && observingRef.current && !answeredRef.current && hostOnScreen(host)) controller.setVisible(true)
  }, [eligible])

  return { hostRef, mounted: mounted && eligible }
}

/**
 * True once `pending` has stayed true for `graceMs` without a break (a client-side timer started when the card was first
 * seen pending; no request to anyone). Going false resets it. Layout can keep answering `pending` for ten minutes about a
 * slide that will never get a preview; the grace period is how long the card trusts that answer before it shows the slide.
 */
export function useRailPendingGrace(pending: boolean, graceMs: number = RAIL_LIVE_PREVIEW_PENDING_GRACE_MS): boolean {
  const [elapsed, setElapsed] = useState(false)

  useEffect(() => {
    if (!pending) {
      setElapsed(false)
      return
    }
    const timer = setTimeout(() => setElapsed(true), graceMs)
    return () => clearTimeout(timer)
  }, [pending, graceMs])

  return pending && elapsed
}
