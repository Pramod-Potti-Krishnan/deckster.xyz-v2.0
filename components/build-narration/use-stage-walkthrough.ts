"use client"

import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { NarrationPhase } from '@/lib/build-narration-heuristics'

const WALK_STEP_MS = 1400

export interface StageWalkthroughArgs {
  enabled: boolean
  phase: NarrationPhase
  slideCount: number
  /** Freshest built slide (narration.focusSlide) — followed during the build. */
  focusSlide: number | null
  /** 0-based viewer navigation (postMessage goToSlide — never remounts). */
  navigate: ((slideIndex: number) => void) | null
  /** The viewer's current 0-based slide — user navigation cancels automation. */
  currentSlideIndex: number
}

/**
 * Canvas v2 R3 — the deck walkthrough (replaces D11's outline walkthrough):
 * during strawman/awaiting the real strawman deck auto-steps once through its
 * slides, then returns to slide 1; during building/qa the center follows each
 * freshly built slide (which also forces the layout viewer to render slides
 * inserted after iframe load). Any user navigation cancels automation for the
 * remainder of that phase. Reduced motion: no stepping; build-follow stays
 * (it is a page turn, not decoration).
 */
export function useStageWalkthrough({
  enabled,
  phase,
  slideCount,
  focusSlide,
  navigate,
  currentSlideIndex,
}: StageWalkthroughArgs) {
  const reduced = useReducedMotion()
  const lastCommandedRef = useRef<number | null>(null)
  const cancelledRef = useRef(false)
  const phaseRef = useRef<NarrationPhase>(phase)

  // Phase change re-arms automation and clears the cancel latch.
  useEffect(() => {
    if (phaseRef.current !== phase) {
      phaseRef.current = phase
      cancelledRef.current = false
      lastCommandedRef.current = null
    }
  }, [phase])

  // User navigation detection: a slide index we did not command cancels
  // automation for the remainder of the phase.
  useEffect(() => {
    if (!enabled) return
    if (lastCommandedRef.current === null) return
    if (currentSlideIndex !== lastCommandedRef.current) {
      cancelledRef.current = true
    }
  }, [enabled, currentSlideIndex])

  // Strawman walkthrough: step 0..N-1 once, then settle on 0.
  useEffect(() => {
    if (!enabled || !navigate) return
    if (phase !== 'strawman' && phase !== 'awaiting_user') return
    if (reduced || slideCount <= 1 || cancelledRef.current) return
    let i = 0
    lastCommandedRef.current = 0
    navigate(0)
    const t = setInterval(() => {
      if (cancelledRef.current) {
        clearInterval(t)
        return
      }
      i += 1
      if (i >= slideCount) {
        clearInterval(t)
        lastCommandedRef.current = 0
        navigate(0)
        return
      }
      lastCommandedRef.current = i
      navigate(i)
    }, WALK_STEP_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, phase, slideCount, reduced, navigate])

  // Build follow: page to each freshly built slide.
  useEffect(() => {
    if (!enabled || !navigate) return
    if (phase !== 'building' && phase !== 'qa' && phase !== 'finalizing') return
    if (cancelledRef.current || focusSlide === null) return
    lastCommandedRef.current = focusSlide
    navigate(focusSlide)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, phase, focusSlide, navigate])
}
