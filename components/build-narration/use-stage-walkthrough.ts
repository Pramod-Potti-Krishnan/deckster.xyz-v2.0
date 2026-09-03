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
  // Recently commanded indexes (small window): the viewer reports slide
  // changes with polling lag, so a report one step behind a fresh command is
  // still ours — only an index we never commanded recently is user navigation.
  const recentCommandsRef = useRef<number[]>([])
  const cancelledRef = useRef(false)
  const phaseRef = useRef<NarrationPhase>(phase)

  const command = (index: number, navigateFn: (i: number) => void) => {
    recentCommandsRef.current = [...recentCommandsRef.current.slice(-2), index]
    navigateFn(index)
  }

  // Phase change re-arms automation and clears the cancel latch.
  useEffect(() => {
    if (phaseRef.current !== phase) {
      phaseRef.current = phase
      cancelledRef.current = false
      recentCommandsRef.current = []
    }
  }, [phase])

  // User navigation detection: a slide index we did not recently command
  // cancels automation for the remainder of the phase.
  useEffect(() => {
    if (!enabled) return
    if (recentCommandsRef.current.length === 0) return
    if (!recentCommandsRef.current.includes(currentSlideIndex)) {
      cancelledRef.current = true
    }
  }, [enabled, currentSlideIndex])

  // Strawman walkthrough: step 0..N-1 once, then settle on 0.
  useEffect(() => {
    if (!enabled || !navigate) return
    if (phase !== 'strawman' && phase !== 'awaiting_user') return
    if (reduced || slideCount <= 1 || cancelledRef.current) return
    let i = 0
    command(0, navigate)
    const t = setInterval(() => {
      if (cancelledRef.current) {
        clearInterval(t)
        return
      }
      i += 1
      if (i >= slideCount) {
        clearInterval(t)
        command(0, navigate)
        return
      }
      command(i, navigate)
    }, WALK_STEP_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, phase, slideCount, reduced, navigate])

  // Build follow: page to each freshly built slide.
  useEffect(() => {
    if (!enabled || !navigate) return
    if (phase !== 'building' && phase !== 'qa' && phase !== 'finalizing') return
    if (cancelledRef.current || focusSlide === null) return
    command(focusSlide, navigate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, phase, focusSlide, navigate])
}
