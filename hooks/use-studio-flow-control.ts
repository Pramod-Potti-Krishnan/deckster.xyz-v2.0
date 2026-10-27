"use client"

// P3-1 D "flow control" (Studio half): the state, timers and effects of the two flows. lib/studio-flow-control.ts decides everything (pure);
// this hook holds what the page cannot: the follow-the-build navigation in flight, Director's pause/settle acknowledgements, and the
// pending rebuild. The page hands it what it already owns (the viewer, the narration, the composer draft and its senders) and draws the
// bar it returns. Both flags off (the default): the refs it is given stay empty, no listener is added, no timer started, no request sent.
//   NEXT_PUBLIC_STUDIO_FLOW_FOCUS: deck_mutation / slide_built / slide_ready / slide_update / change_recorded for the displayed deck bring
//     that slide into view (on an overlay layout, the stage pane first), unless the user navigated by hand in the last 4 s or, mid-build, at all.
//     The build's first slide_built names its deck before anything else does (the stage still shows the outline): it is accepted as this build's.
//     The narration's own page turns (flowBus.programmatic) and the follow's own goToSlide are told apart from the user's navigation.
//   NEXT_PUBLIC_STUDIO_FLOW_AMEND: while a build is paused or stopped the composer can send, a calm line says so, and Resume / Rebuild
//     are offered. Rebuild = stop, wait for Director's `settled` (or 8 s), then send the draft as an ordinary message.
import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { FlowAmendBar } from '@/components/build-narration/flow-amend-bar'
import {
  STUDIO_FLOW_AMEND_ENABLED,
  STUDIO_FLOW_AMEND_INSTRUCTIONS_ENABLED,
  STUDIO_FLOW_FOCUS_ENABLED,
  flowAppliedHoldMs,
  flowAmendState,
  flowFocusAfterTarget,
  flowFocusMarkCommanded,
  flowFocusMarkSelf,
  flowFocusNoteSlideChange,
  flowFocusNoteUserNav,
  flowFocusStep,
  flowFocusTarget,
  flowRebuildStep,
  flowRebuildWakeInMs,
  flowResumeInstructions,
  flowBus,
  flowFocusEventFromFrame,
  flowSignalsReduce,
  initialFlowFocusState,
  initialFlowSignals,
  type FlowAmendControl,
  type FlowAmendState,
  type FlowFocusEvent,
  type FlowFocusPending,
  type FlowFocusState,
  type FlowRebuild,
  type FlowSignals,
} from '@/lib/studio-flow-control'

export interface StudioFlowControlInput {
  studioShell: boolean
  /** One pane at a time (narrow Studio): the stage may not be the one showing. */
  overlay: boolean
  revealStage: () => void
  /** The deck on the stage, and the deck the running build is filling (the stage swaps to it after the first slide). */
  displayedPresentationId: string | null | undefined
  buildPresentationId: string | null | undefined
  goToSlide: ((index: number) => Promise<void>) | null | undefined
  viewerSafety: { presentationId: string | null; ready: boolean; busy: boolean; error: boolean } | null | undefined
  narrationEnabled: boolean
  narration: { active: boolean; buildId: string | null; control: FlowAmendControl; phase: string }
  draft: string
  setDraft: (update: (current: string) => string) => void
  sendBuildControl: (action: 'pause' | 'resume' | 'stop', buildId?: string) => string | null
  markControl: (control: 'resume_requested' | 'stop_requested', buildId: string | null, requestId: string) => void
  /** The page's own send (handleSendMessage with the text as the message). */
  sendDraft: (text: string) => unknown
  awaitingReply: boolean
  stopAwaiting: () => void
  sessionKey: string | null | undefined
  onStopFailed: () => void
}

export interface StudioFlowControl {
  /** The calm line and the buttons (null with the amend flag off). */
  bar: ReactElement | null
  amend: FlowAmendState
  resume: () => void
  rebuild: () => void
  /** The viewer reported the slide it is on (0-based). */
  noteSlideChange: (index: number) => void
}

const INITIAL_SIGNALS = initialFlowSignals()
/** How many message ids the follow remembers. */
const SEEN_FRAMES_MAX = 200

const IDLE: StudioFlowControl = {
  bar: null,
  amend: flowAmendState({ enabled: false, active: false, control: 'running', rebuild: null, draft: '', instructionsEnabled: false }),
  resume: () => {},
  rebuild: () => {},
  noteSlideChange: () => {},
}

export function useStudioFlowControl(input: StudioFlowControlInput): StudioFlowControl {
  const latestRef = useRef(input)
  latestRef.current = input
  const buildKey = () => (latestRef.current.narration.active ? latestRef.current.narration.buildId : null)

  // ---- flow focus ----------------------------------------------------------------------------------------------------------------
  const focusStateRef = useRef<FlowFocusState>(initialFlowFocusState())
  const seenFramesRef = useRef<string[]>([])
  const [pending, setPending] = useState<FlowFocusPending | null>(null)
  const [focusTick, setFocusTick] = useState(0)

  const runFocus = (frameEvent: FlowFocusEvent | null) => {
    if (!frameEvent) return
    // A frame delivered twice (a replay after a reconnect) is acted on once.
    if (frameEvent.messageId) {
      const key = `${frameEvent.kind}:${frameEvent.messageId}`
      if (seenFramesRef.current.includes(key)) return
      seenFramesRef.current = [...seenFramesRef.current, key].slice(-SEEN_FRAMES_MAX)
    }
    const current = latestRef.current
    const now = Date.now()
    const event = frameEvent.kind === 'slide_built' ? { ...frameEvent, buildKey: buildKey() } : frameEvent
    const target = flowFocusTarget({
      enabled: true, event, displayedPresentationId: current.displayedPresentationId, alsoPresentationIds: [current.buildPresentationId],
      overlay: current.overlay, state: focusStateRef.current, now,
    })
    if (!target) return
    focusStateRef.current = flowFocusAfterTarget(focusStateRef.current, event, target.index, now)
    if (target.selectStage) current.revealStage()
    if (target.index !== null && event.presentationId) setPending({ index: target.index, presentationId: event.presentationId, at: now })
  }

  const noteSlideChange = useCallback((index: number) => {
    if (!STUDIO_FLOW_FOCUS_ENABLED) return
    focusStateRef.current = flowFocusNoteSlideChange(focusStateRef.current, index, Date.now(), buildKey())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- reads the latest input through the ref

  // Switching panes by hand is navigation: it stops the follow (for the 4 s window, and for the rest of a build).
  useEffect(() => {
    if (!STUDIO_FLOW_FOCUS_ENABLED || typeof document === 'undefined') return
    const onClick = (event: Event) => {
      const target = event.target as { closest?: (selector: string) => unknown } | null
      if (target?.closest?.('[data-studio-workspace-switch], [data-studio-inspector-switch]')) {
        focusStateRef.current = flowFocusNoteUserNav(focusStateRef.current, Date.now(), buildKey())
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!STUDIO_FLOW_FOCUS_ENABLED || !pending) return
    const current = latestRef.current
    const safety = current.viewerSafety
    const viewerReady = !current.studioShell
      || Boolean(safety && safety.ready && !safety.busy && !safety.error && safety.presentationId === pending.presentationId)
    const step = flowFocusStep({
      pending, now: Date.now(), state: focusStateRef.current, hasViewerApi: typeof current.goToSlide === 'function', viewerReady,
    })
    if (step.action === 'drop') { setPending(null); return }
    if (step.action === 'wait') {
      const timer = setTimeout(() => setFocusTick(tick => tick + 1), step.retryInMs)
      return () => clearTimeout(timer)
    }
    focusStateRef.current = flowFocusMarkSelf(focusStateRef.current, pending.index, Date.now())
    setPending(null)
    void Promise.resolve(current.goToSlide!(pending.index)).catch(() => {})
  }, [pending, focusTick, input.goToSlide, input.viewerSafety, input.studioShell])

  // ---- flow amend ----------------------------------------------------------------------------------------------------------------
  const amendOn = STUDIO_FLOW_AMEND_ENABLED && input.narrationEnabled
  const [signals, setSignals] = useState<FlowSignals>(INITIAL_SIGNALS)
  const [rebuildState, setRebuildState] = useState<FlowRebuild | null>(null)
  const [amendTick, setAmendTick] = useState(0)
  const sentRef = useRef<number | null>(null)
  const resumedWithRef = useRef<string | null>(null)

  // The socket hook shows the frames here (lib flowBus): only with their flags on, and not once the page is gone.
  flowBus.focus = !STUDIO_FLOW_FOCUS_ENABLED ? null : frame => runFocus(flowFocusEventFromFrame(frame))
  flowBus.phase = !STUDIO_FLOW_AMEND_ENABLED ? null : payload => setSignals(previous => flowSignalsReduce(previous, payload as Parameters<typeof flowSignalsReduce>[1], Date.now()))
  // The narration's own page turns (its follow of the build, its walk through the outline) say so before they move the viewer: the viewer's report of one is not the user navigating.
  flowBus.programmatic = !STUDIO_FLOW_FOCUS_ENABLED ? null : index => { focusStateRef.current = flowFocusMarkCommanded(focusStateRef.current, index, Date.now()) }
  useEffect(() => () => { flowBus.focus = null; flowBus.phase = null; flowBus.programmatic = null; flowBus.instructions = undefined }, [])

  const amend = flowAmendState({
    enabled: amendOn, active: input.narration.active, control: input.narration.control, rebuild: rebuildState, draft: input.draft,
    instructionsEnabled: STUDIO_FLOW_AMEND_INSTRUCTIONS_ENABLED, steerPending: signals.steerPending, appliedTo: signals.appliedTo,
  })

  // A build with a different id, another session: nothing of the old one carries over.
  useEffect(() => {
    if (!amendOn) return
    resumedWithRef.current = null
    setRebuildState(null)
    setSignals(INITIAL_SIGNALS)
  }, [amendOn, input.sessionKey])

  // "Applied to slides 4–7." is a moment, not a state.
  useEffect(() => {
    if (!amendOn || signals.appliedTo === null || signals.appliedAt === null) return
    const timer = setTimeout(
      () => setSignals(previous => previous.appliedAt === signals.appliedAt ? { ...previous, appliedTo: null, appliedAt: null } : previous),
      Math.max(0, signals.appliedAt + flowAppliedHoldMs(signals.appliedTo) - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [amendOn, signals.appliedTo, signals.appliedAt])

  // Director applied the resume's changes to no slide: they would be lost with the box cleared, and Rebuild needs them. Put them back (unless the user has typed something else since).
  useEffect(() => {
    if (!amendOn || signals.appliedAt === null || signals.appliedTo === null) return
    const text = resumedWithRef.current
    resumedWithRef.current = null
    if (signals.appliedTo.length === 0 && text) latestRef.current.setDraft(value => (value.trim() ? value : text))
  }, [amendOn, signals.appliedAt, signals.appliedTo])

  // The turn gate waits for Director's reply to the last message; a held build will not send one until it resumes. Let the user type (the same unlock as Esc).
  useEffect(() => {
    if (amend.canSend && input.awaitingReply) input.stopAwaiting()
  }, [amend.canSend, input.awaitingReply, input.stopAwaiting]) // eslint-disable-line react-hooks/exhaustive-deps

  const resume = useCallback(() => {
    const current = latestRef.current
    const draft = current.draft
    const instructions = flowResumeInstructions({ instructionsEnabled: STUDIO_FLOW_AMEND_INSTRUCTIONS_ENABLED, draft })
    const buildId = current.narration.buildId
    resumedWithRef.current = null
    flowBus.instructions = instructions // taken, once, by the sendBuildControl call below
    const requestId = current.sendBuildControl('resume', buildId ?? undefined)
    flowBus.instructions = undefined
    if (!requestId) return
    current.markControl('resume_requested', buildId, requestId)
    // Director has the text now; leave nothing behind to be sent a second time (if it applies it to no slide, it comes back).
    if (instructions) {
      resumedWithRef.current = instructions
      current.setDraft(value => (value === draft ? '' : value))
    }
  }, [])

  const rebuild = useCallback(() => {
    const current = latestRef.current
    const text = current.draft.trim()
    if (!text || !amendOn) return
    const now = Date.now()
    const buildId = current.narration.buildId
    if (current.narration.control === 'stopped' || current.narration.phase === 'stopped') {
      // Already stopped: a `settled` Director already sent for this stop counts; otherwise wait for it as usual.
      setRebuildState({ text, buildId, stage: 'awaiting_settled', startedAt: signals.settledAt ?? now, stoppedAt: now, sentAt: null })
      return
    }
    const requestId = current.sendBuildControl('stop', buildId ?? undefined)
    if (!requestId) { current.onStopFailed(); return }
    current.markControl('stop_requested', buildId, requestId)
    setRebuildState({ text, buildId, stage: 'stopping', startedAt: now, stoppedAt: null, sentAt: null })
  }, [amendOn, signals.settledAt])

  useEffect(() => {
    if (!amendOn || !rebuildState) return
    const now = Date.now()
    const step = flowRebuildStep({
      rebuild: rebuildState, control: input.narration.control, phase: input.narration.phase, buildId: input.narration.buildId, now, settledAt: signals.settledAt,
    })
    if (step === 'stopped') {
      setRebuildState(previous => previous && previous.stage === 'stopping' ? { ...previous, stage: 'awaiting_settled', stoppedAt: now } : previous)
      return
    }
    if (step === 'cancel' || step === 'done') { setRebuildState(null); return }
    if (step === 'send') {
      // The turn gate would refuse a send while it waits for a reply: clear it and come back (this effect runs again when it has).
      if (input.awaitingReply) { input.stopAwaiting(); return }
      if (sentRef.current === rebuildState.startedAt) return
      sentRef.current = rebuildState.startedAt
      setRebuildState(previous => previous ? { ...previous, stage: 'sent', sentAt: now } : previous)
      void latestRef.current.sendDraft(rebuildState.text)
      return
    }
    const wake = flowRebuildWakeInMs(rebuildState, now)
    if (wake === null) return
    const timer = setTimeout(() => setAmendTick(tick => tick + 1), wake)
    return () => clearTimeout(timer)
  }, [amendOn, rebuildState, amendTick, input.narration.control, input.narration.phase, input.narration.buildId, signals.settledAt, input.awaitingReply]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!STUDIO_FLOW_FOCUS_ENABLED && !amendOn) return IDLE
  const bar = STUDIO_FLOW_AMEND_ENABLED ? createElement(FlowAmendBar, { state: amend, onResume: resume, onRebuild: rebuild }) : null
  return { bar, amend, resume, rebuild, noteSlideChange }
}
