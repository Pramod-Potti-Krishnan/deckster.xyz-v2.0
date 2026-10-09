"use client"

import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  createRailLivePreviewController,
  railPreviewSlots,
  type RailLivePreviewController,
} from '@/lib/rail-live-preview'

/**
 * Whether one rail card may show its live mini-preview frame right now (F9-A).
 *
 * `eligible` is the card's own rule (an approved frame URL exists); the other half is visibility:
 * an IntersectionObserver on the element behind `hostRef` reports when the card is on screen.
 * The frame is mounted only while the card is eligible AND visible AND holds one of the rail's
 * few shared slots (lib/rail-live-preview.ts), and `mounted` goes false in the same render in
 * which `eligible` does, so a frame never outlives the reason for it. Without an
 * IntersectionObserver nothing is ever mounted. Never throws, never makes a request.
 */
export function useRailLivePreview(eligible: boolean): { hostRef: RefObject<HTMLDivElement | null>; mounted: boolean } {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<RailLivePreviewController | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const controller = createRailLivePreviewController({ pool: railPreviewSlots, onChange: setMounted })
    controllerRef.current = controller
    const host = hostRef.current
    let observer: IntersectionObserver | null = null
    if (host && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        const latest = entries[entries.length - 1]
        if (latest) controller.setVisible(latest.isIntersecting)
      })
      observer.observe(host)
    }
    return () => {
      observer?.disconnect()
      controller.dispose()
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [])

  useEffect(() => { controllerRef.current?.setEligible(eligible) }, [eligible])

  return { hostRef, mounted: mounted && eligible }
}
