"use client"

// FRONTEND-1 (F-04, F-07; flag NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE): keeps the viewer on the slide the user was on when the built deck replaces Director's strawman preview deck on the stage.
// lib/studio-strawman-stage.ts decides everything (pure); this hook holds what the page cannot: the slide remembered while the strawman showed, the return in flight, and the wait for the built deck's viewer.
// The swap itself is not made here: it is the page's effective presentation URL changing from the slide_update preview_url (hooks/use-deckster-websocket-v2.ts, activeVersion "strawman") to the build's deck (the Studio
// partial stage on the first slide_built, else the presentation_url, activeVersion "final"). A new viewer opens on slide 1; this takes it back with the viewer's own goToSlide once its safety says ready for that deck.
// Flag off (the default): the effects return at once; nothing is stored, timed or sent.
import { useEffect, useRef, useState } from 'react'
import {
  STUDIO_STRAWMAN_STAGE_ENABLED,
  initialStrawmanStageState,
  strawmanStageHold,
  strawmanStageKeepStep,
  strawmanStageStep,
  strawmanStageWent,
  type StrawmanStagePending,
  type StrawmanStagePhase,
  type StrawmanStageState,
} from '@/lib/studio-strawman-stage'

export interface StudioStrawmanStageInput {
  phase: StrawmanStagePhase
  /** The deck on the stage, and the slide the viewer is on (0-based). */
  presentationId: string | null | undefined
  currentSlideIndex: number
  /** The build has started (generating, or a build phase): the viewer's own drop to slide 1 before the stage swaps is not the user's choice. */
  buildStarted: boolean
  /** Slides the displayed deck holds, when the page knows. */
  slideCount: number | null | undefined
  goToSlide: ((index: number) => Promise<void>) | null | undefined
  viewerSafety: { presentationId: string | null; ready: boolean; busy: boolean; error: boolean } | null | undefined
}

/** True while the narration's own page turns should stand down (the page was taken back to the user's slide and the build is running). */
export function useStudioStrawmanStage(input: StudioStrawmanStageInput): boolean {
  const latestRef = useRef(input)
  latestRef.current = input
  const stateRef = useRef<StrawmanStageState>(initialStrawmanStageState())
  const [pending, setPending] = useState<StrawmanStagePending | null>(null)
  const [tick, setTick] = useState(0)
  const [held, setHeld] = useState(false)

  // What the stage shows, once per change of deck, phase, slide or build start (the user's last slide is read before the new viewer reports its own; once the build has started, a drop to slide 1 is the viewer's, not the user's).
  useEffect(() => {
    if (!STUDIO_STRAWMAN_STAGE_ENABLED) return
    const before = stateRef.current
    const after = strawmanStageStep(before, { phase: input.phase, presentationId: input.presentationId, index: input.currentSlideIndex, now: Date.now(), buildStarted: input.buildStarted })
    stateRef.current = after
    if (after.pending !== before.pending) setPending(after.pending)
    if (Boolean(after.held) !== Boolean(before.held)) setHeld(Boolean(after.held))
  }, [input.phase, input.presentationId, input.currentSlideIndex, input.buildStarted])

  // The return: wait for the built deck's viewer, then go to the slide.
  useEffect(() => {
    if (!STUDIO_STRAWMAN_STAGE_ENABLED || !pending) return
    const current = latestRef.current
    const safety = current.viewerSafety
    const step = strawmanStageKeepStep({
      pending, now: Date.now(), hasViewerApi: typeof current.goToSlide === 'function',
      viewerReady: Boolean(safety && safety.ready && !safety.busy && !safety.error && safety.presentationId === pending.presentationId),
      slideCount: current.slideCount,
    })
    if (step.action === 'drop') { stateRef.current = { ...stateRef.current, pending: null }; setPending(null); return }
    if (step.action === 'wait') {
      const timer = setTimeout(() => setTick(value => value + 1), step.retryInMs)
      return () => clearTimeout(timer)
    }
    stateRef.current = strawmanStageWent(stateRef.current)
    setPending(null)
    setHeld(true)
    void Promise.resolve(current.goToSlide!(step.index)).catch(() => {})
  }, [pending, tick, input.goToSlide, input.viewerSafety, input.slideCount])
  return STUDIO_STRAWMAN_STAGE_ENABLED && strawmanStageHold({ held, phase: input.phase, buildStarted: input.buildStarted })
}
