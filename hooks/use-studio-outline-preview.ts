"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BuildPhasePayload } from '@/types/build-narration'
import type { NarrationPhase } from '@/lib/build-narration-heuristics'

const OUTLINE_PREVIEW_MAX_MS = 3000
const INTRO_PHASES: NarrationPhase[] = ['idle', 'planning', 'strawman', 'building']

interface StudioOutlinePreviewOptions {
  enabled: boolean
  sessionId: string | null
  buildId: string | null
  phase: NarrationPhase
  slidesDone: number
  activeVersion: string | null
  templateModeOn: boolean
}

/** An owned native auto-build receipt permits a brief visual intro, never a build action. */
export function useStudioOutlinePreview(options: StudioOutlinePreviewOptions) {
  const { enabled, sessionId, buildId, phase, slidesDone, activeVersion, templateModeOn } = options
  const buildScope = sessionId?.trim() && sessionId !== 'new' && buildId?.trim()
    ? JSON.stringify([sessionId, buildId]) : null
  const key = JSON.stringify([enabled, sessionId, buildId, activeVersion, templateModeOn])
  const scopeRef = useRef({ key })
  if (scopeRef.current.key !== key) scopeRef.current = { key }
  const scope = scopeRef.current
  const currentRef = useRef(options)
  currentRef.current = options
  const aliveRef = useRef(true)
  // Mount-local receipts survive view changes; duplicates cannot renew a dwell after returning.
  const consumedRef = useRef(new Set<string>())
  const [receipt, setReceipt] = useState<{ scope: typeof scope; deadline: number } | null>(null)
  const eligible = enabled && Boolean(buildScope) && !templateModeOn
    && INTRO_PHASES.includes(phase) && slidesDone === 0
  const cancelledRef = useRef<typeof receipt>(null)
  // Refuse synchronously on the render that sees a gate/slide/view change, before effect cleanup.
  if (receipt && (!eligible || receipt.scope !== scope)) cancelledRef.current = receipt
  const currentReceipt = receipt && receipt.scope === scope && receipt !== cancelledRef.current
    && eligible ? receipt : null

  const consume = useCallback((id: string) => {
    consumedRef.current.add(id)
  }, [])

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  useEffect(() => {
    if (!receipt) return
    if (!currentReceipt) {
      setReceipt(previous => previous === receipt ? null : previous)
      return
    }
    const remaining = Math.max(0, receipt.deadline - performance.now())
    const timer = setTimeout(() => {
      if (aliveRef.current && scopeRef.current === scope) {
        setReceipt(previous => previous === receipt ? null : previous)
      }
    }, remaining)
    return () => clearTimeout(timer)
  }, [receipt, currentReceipt, scope])

  const onNativeBuildPhase = useCallback((payload: BuildPhasePayload, ownerSessionId: string | null) => {
    if (!aliveRef.current || scopeRef.current !== scope) return
    const current = currentRef.current
    if (!current.enabled || current.templateModeOn || !current.sessionId || current.sessionId === 'new'
      || !current.buildId || ownerSessionId !== current.sessionId
      || payload.build_id !== current.buildId || payload.phase !== 'building'
      || payload.auto_proceed !== true || !INTRO_PHASES.includes(current.phase)
      || current.slidesDone !== 0 || (payload.slides_done != null && payload.slides_done !== 0)
      || !buildScope || consumedRef.current.has(buildScope)) return
    consume(buildScope)
    setReceipt({ scope, deadline: performance.now() + OUTLINE_PREVIEW_MAX_MS })
  }, [scope, buildScope, consume])

  // Call at manual version/template intent, including a same-value selection invisible in props.
  const cancelOutlinePreview = useCallback(() => {
    if (!aliveRef.current || scopeRef.current !== scope) return
    if (buildScope) consume(buildScope)
    setReceipt(null)
  }, [scope, buildScope, consume])

  return {
    showOutlinePreview: Boolean(currentReceipt && phase === 'building' && performance.now() < currentReceipt.deadline),
    onNativeBuildPhase,
    cancelOutlinePreview,
  }
}
