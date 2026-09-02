"use client"

// Build Narration state hook (BUILD_COT_NARRATION_PLAN §5.1).
//
// Feeds the pure reducer in lib/build-narration-heuristics.ts from the
// outputs the builder page already has (messages, currentStatus,
// slideStructure, generating flags, final URL) — the HEURISTIC source that
// works against today's production Director. Phase 2 adds typed-frame inputs
// (build_phase / build_event / slide_built) which supersede heuristics inside
// the reducer.
//
// Everything is inert when `enabled` is false: effects bail immediately and
// the returned state is the initial (inactive) state.

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import {
  initialNarrationState,
  narrationReducer,
  serializeNarration,
  deserializeNarration,
  type NarrationState,
  type GhostSlide,
} from '@/lib/build-narration-heuristics'
import {
  isBuildControlRequestPending,
  isMatchingBuildControlBuild,
  isMatchingBuildControlAck,
  retireBuildControlRequestId,
  shouldIgnoreBuildControlPhaseCorrelation,
  shouldRetirePendingControl,
} from '@/lib/build-control-helpers'
import type {
  BuildControlAction,
  BuildPhasePayload,
  BuildEventPayload,
  SlideBuiltPayload,
} from '@/types/build-narration'
import { toast } from '@/hooks/use-toast'

const SNAPSHOT_MAX_AGE_MS = 30 * 60 * 1000 // mid-build refresh window
const COMPLETE_DISMISS_MS = 1600 // settle beat before the overlay recedes
const CONTROL_ACK_TIMEOUT_MS = 6000

function snapshotKey(sessionId: string) {
  return `deckster_narration_${sessionId}`
}

export interface UseBuildNarrationInputs {
  enabled: boolean
  sessionId: string | null
  /** WS transcript (ephemeral chat rides here; typed frames are excluded). */
  messages: Array<{ message_id: string; type: string; payload?: any }>
  currentStatus: { status: string; text: string } | null
  slideStructure: any
  isGeneratingFinal: boolean
  isGeneratingStrawman: boolean
  finalPresentationUrl: string | null
  /** True when the session restored as an already-finished deck. */
  restoredComplete?: boolean
}

export interface UseBuildNarrationResult {
  narration: NarrationState
  /** Pin the focus card to one slide (null = resume auto-follow). */
  pinSlide: (slideIndex: number | null) => void
  /** Typed-frame inputs (wired in Phase 2). */
  onBuildPhase: (payload: BuildPhasePayload) => void
  onBuildEvent: (payload: BuildEventPayload) => void
  onSlideBuilt: (payload: SlideBuiltPayload) => void
  /** sync_response.build_state → reconnect re-hydration. */
  syncBuildState: (buildState: unknown) => void
  /** Control-state echo for the Pause/Stop UI (Phase 5). */
  markControl: (control: NarrationState['control'], buildId?: string | null, requestId?: string | null) => void
}

interface PendingControlRequest {
  action: BuildControlAction
  requested: NarrationState['control']
  fallback: NarrationState['control']
  buildId: string | null
  requestId: string | null
}

export function useBuildNarration(inputs: UseBuildNarrationInputs): UseBuildNarrationResult {
  const {
    enabled,
    sessionId,
    messages,
    currentStatus,
    slideStructure,
    isGeneratingFinal,
    isGeneratingStrawman,
    finalPresentationUrl,
    restoredComplete = false,
  } = inputs

  const [narration, dispatch] = useReducer(narrationReducer, undefined, initialNarrationState)
  const processedCountRef = useRef(0)
  const sessionRef = useRef<string | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controlTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingControlRef = useRef<PendingControlRequest | null>(null)
  // Settled/expired correlations remain retired so a delayed phase for an old
  // action cannot regress the same build after a later action has completed.
  // The helper bounds this list; it is intentionally not persisted.
  const retiredControlRequestIdsRef = useRef<string[]>([])
  const controlRef = useRef<NarrationState['control']>('running')
  const prevGeneratingFinalRef = useRef(false)

  const clearPendingControl = useCallback(() => {
    const pending = pendingControlRef.current
    if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current)
    controlTimeoutRef.current = null
    pendingControlRef.current = null
    if (pending?.requestId) {
      retiredControlRequestIdsRef.current = retireBuildControlRequestId(
        retiredControlRequestIdsRef.current,
        pending.requestId,
      )
    }
  }, [])

  // A typed frame for a genuinely newer build retires any request/timer owned
  // by the prior build. Frames from an already-retired build are ignored by
  // the reducer and must not cancel the current build's request.
  const pendingControlForBuild = useCallback((incomingBuildId?: string | null) => {
    const pending = pendingControlRef.current
    if (pending && shouldRetirePendingControl(
      pending.buildId,
      narration.buildId,
      narration.retiredBuildIds,
      incomingBuildId,
    )) {
      clearPendingControl()
      return null
    }
    return pending
  }, [clearPendingControl, narration.buildId, narration.retiredBuildIds])

  useEffect(() => {
    controlRef.current = narration.control
  }, [narration.control])

  useEffect(() => {
    return clearPendingControl
  }, [clearPendingControl])

  // Session switch: reset, then hydrate a mid-build snapshot if one is fresh.
  useEffect(() => {
    if (!enabled) {
      // Track the disabled session so template-reuse messages accumulated in
      // it are not mistaken for a fresh narration history when re-enabled.
      const sessionChanged = sessionRef.current !== sessionId
      if (sessionChanged) processedCountRef.current = 0
      sessionRef.current = sessionId
      clearPendingControl()
      if (sessionChanged) retiredControlRequestIdsRef.current = []
      dispatch({ type: 'reset' })
      return
    }
    if (sessionRef.current === sessionId) return
    sessionRef.current = sessionId
    processedCountRef.current = 0
    clearPendingControl()
    retiredControlRequestIdsRef.current = []
    dispatch({ type: 'reset' })
    if (!sessionId || restoredComplete) return
    try {
      const raw = window.sessionStorage.getItem(snapshotKey(sessionId))
      const restored = deserializeNarration(raw, Date.now(), SNAPSHOT_MAX_AGE_MS)
      if (restored) dispatch({ type: 'hydrate', state: restored })
    } catch {
      // sessionStorage unavailable — narration just starts cold.
    }
  }, [enabled, sessionId, restoredComplete, clearPendingControl])

  // Write-through snapshot (small state; event caps bound its size).
  useEffect(() => {
    if (!enabled || !sessionId) return
    try {
      if (narration.active) {
        window.sessionStorage.setItem(snapshotKey(sessionId), serializeNarration(narration, Date.now()))
      } else {
        window.sessionStorage.removeItem(snapshotKey(sessionId))
      }
    } catch {
      // Quota/unavailable — non-fatal.
    }
  }, [enabled, sessionId, narration])

  // New transcript messages → ephemeral lines + the Accept card signal.
  useEffect(() => {
    if (!enabled) {
      processedCountRef.current = messages.length
      return
    }
    if (messages.length < processedCountRef.current) processedCountRef.current = 0
    for (let i = processedCountRef.current; i < messages.length; i++) {
      const m = messages[i]
      if (m.type === 'chat_message' && m.payload?.ephemeral === true) {
        dispatch({ type: 'ephemeral', id: m.message_id, text: String(m.payload?.text || ''), ts: Date.now() })
      } else if (m.type === 'action_request') {
        const actions = Array.isArray(m.payload?.actions) ? m.payload.actions : []
        if (actions.some((a: any) => a?.value === 'accept_strawman')) {
          dispatch({ type: 'awaiting_user', ts: Date.now() })
        }
      }
    }
    processedCountRef.current = messages.length
  }, [enabled, messages])

  // status_update → phase heuristics.
  useEffect(() => {
    if (!enabled || !currentStatus) return
    dispatch({ type: 'status', status: currentStatus.status, text: currentStatus.text || '', ts: Date.now() })
  }, [enabled, currentStatus])

  // Strawman structure → ghost deck.
  useEffect(() => {
    if (!enabled) return
    const slides = Array.isArray(slideStructure) ? slideStructure : slideStructure?.slides
    if (!Array.isArray(slides) || slides.length === 0) return
    const ghosts: GhostSlide[] = slides.map((s: any, i: number) => ({
      index: typeof s?.slide_number === 'number' ? Math.max(0, s.slide_number - 1) : i,
      title: String(s?.title || `Slide ${i + 1}`),
      points: Array.isArray(s?.key_points) ? s.key_points.map((p: any) => String(p)).slice(0, 4) : [],
      slideType: s?.slide_type ?? null,
    }))
    dispatch({ type: 'strawman', ghosts, ts: Date.now() })
  }, [enabled, slideStructure])

  // Accept click / strawman auto-proceed → building.
  useEffect(() => {
    if (!enabled) return
    if (isGeneratingFinal && !prevGeneratingFinalRef.current) {
      dispatch({ type: 'accepted', ts: Date.now() })
    }
    prevGeneratingFinalRef.current = isGeneratingFinal
  }, [enabled, isGeneratingFinal])

  // Strawman-phase loader signal (pre-URL) keeps the canvas alive.
  useEffect(() => {
    if (!enabled || !isGeneratingStrawman) return
    dispatch({ type: 'session_start', ts: Date.now() })
  }, [enabled, isGeneratingStrawman])

  // Final URL → complete, settle, dismiss.
  useEffect(() => {
    if (!enabled || !finalPresentationUrl) return
    dispatch({ type: 'final_url', ts: Date.now() })
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = setTimeout(() => dispatch({ type: 'dismiss' }), COMPLETE_DISMISS_MS)
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }, [enabled, finalPresentationUrl])

  const pinSlide = useCallback((slideIndex: number | null) => {
    dispatch({ type: 'pin', slideIndex })
  }, [])

  const onBuildPhase = useCallback((payload: BuildPhasePayload) => {
    let pending = pendingControlForBuild(payload.build_id)
    const hasRequestId = Object.prototype.hasOwnProperty.call(payload, 'control_request_id')
    const ackRequestId = payload.control_request_id
    // Drop retired and non-current correlated frames instead of letting their
    // phase mutate the reducer while another request owns the UI. Null remains
    // an ordinary (non-ack) phase because current Pydantic frames include it.
    if (shouldIgnoreBuildControlPhaseCorrelation(
      retiredControlRequestIdsRef.current,
      pending?.requestId,
      hasRequestId,
      ackRequestId,
    )) return
    const matchesPending = pending && isMatchingBuildControlAck(
      pending.action,
      pending.buildId,
      payload.phase,
      payload.build_id,
      pending.requestId,
      hasRequestId ? ackRequestId : undefined,
    )
    const terminal = payload.phase === 'complete' || payload.phase === 'error'
    if (matchesPending || (
      pending &&
      terminal &&
      isMatchingBuildControlBuild(pending.buildId, payload.build_id)
    )) {
      clearPendingControl()
      pending = null
    }
    dispatch({
      type: 'typed_phase',
      payload,
      ts: Date.now(),
      ...(pending ? { pendingControl: pending.requested } : {}),
    })
  }, [clearPendingControl, pendingControlForBuild])

  const onBuildEvent = useCallback((payload: BuildEventPayload) => {
    pendingControlForBuild(payload.build_id)
    dispatch({ type: 'typed_event', payload, ts: Date.now() })
  }, [pendingControlForBuild])

  const onSlideBuilt = useCallback((payload: SlideBuiltPayload) => {
    pendingControlForBuild(payload.build_id)
    dispatch({ type: 'typed_slide_built', payload, ts: Date.now() })
  }, [pendingControlForBuild])

  const syncBuildState = useCallback((buildState: unknown) => {
    const ack = buildState && typeof buildState === 'object'
      ? buildState as { build_id?: string | null; phase?: string | null }
      : null
    let pending = pendingControlForBuild(ack?.build_id)
    // A sync snapshot is authoritative current state, rather than a queued
    // acknowledgement. It may therefore settle a request without an echoed
    // request id (including after reconnect).
    if (pending && ack && isMatchingBuildControlAck(pending.action, pending.buildId, ack.phase, ack.build_id)) {
      clearPendingControl()
      pending = null
    }
    const terminal = ack?.phase === 'complete' || ack?.phase === 'error' || ack?.phase === 'idle'
    if (pending && terminal && isMatchingBuildControlBuild(pending.buildId, ack?.build_id)) {
      clearPendingControl()
      pending = null
    }
    dispatch({
      type: 'typed_sync',
      buildState,
      ts: Date.now(),
      ...(pending ? { pendingControl: pending.requested } : {}),
    })
  }, [clearPendingControl, pendingControlForBuild])

  const markControl = useCallback((
    control: NarrationState['control'],
    buildId?: string | null,
    requestId?: string | null,
  ) => {
    if (!isBuildControlRequestPending(control)) {
      controlRef.current = control
      dispatch({ type: 'control', control, ts: Date.now() })
      return
    }

    clearPendingControl()
    const fallback = controlRef.current
    const action: BuildControlAction = control === 'pause_requested'
      ? 'pause'
      : control === 'stop_requested'
        ? 'stop'
        : 'resume'
    const pending: PendingControlRequest = {
      action,
      requested: control,
      fallback,
      buildId: buildId ?? null,
      requestId: requestId ?? null,
    }
    pendingControlRef.current = pending
    controlTimeoutRef.current = setTimeout(() => {
      if (pendingControlRef.current !== pending) return
      pendingControlRef.current = null
      controlTimeoutRef.current = null
      retiredControlRequestIdsRef.current = retireBuildControlRequestId(
        retiredControlRequestIdsRef.current,
        pending.requestId,
      )
      controlRef.current = fallback
      dispatch({ type: 'control_timeout', requested: control, fallback, ts: Date.now() })
      toast({
        title: "Director didn't respond",
        description: `${control === 'stop_requested' ? 'Stop' : control === 'resume_requested' ? 'Resume' : 'Pause'} may be unavailable in this environment.`,
      })
    }, CONTROL_ACK_TIMEOUT_MS)
    controlRef.current = control
    dispatch({ type: 'control', control, ts: Date.now() })
  }, [clearPendingControl])

  const inert = useMemo(() => initialNarrationState(), [])

  return {
    narration: enabled ? narration : inert,
    pinSlide,
    onBuildPhase,
    onBuildEvent,
    onSlideBuilt,
    syncBuildState,
    markControl,
  }
}
