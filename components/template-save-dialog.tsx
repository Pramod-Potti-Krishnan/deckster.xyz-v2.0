"use client"

import "./studio-editor-dialogs.css"
import "./studio-template-flows.css"

import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RotateCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { mergeTemplateRetryAcknowledgement } from '@/lib/template-retry-acknowledgement'
import {
  isTemplateGenerationReady,
  templateGenerationStatus,
  useTemplates,
  type SaveTemplateResult,
  type TemplateSnapshot,
} from '@/hooks/use-templates'

const STUDIO_TEMPLATE_FLOW = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

function TemplateFlowBody({ children }: { children: ReactNode }) {
  return STUDIO_TEMPLATE_FLOW ? <div className="studio-template-flow-body">{children}</div> : <Fragment>{children}</Fragment>
}

interface TemplateSaveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The WS session whose agreed deck Director will snapshot (source_session_id). */
  sessionId: string | null
  /** The session that produced the currently displayed deck URLs. */
  deckOwnerSessionId?: string | null
  /** The built presentation currently owned by that session. */
  sourcePresentationId?: string | null
  /** Promote the saved template into the active builder template. */
  onSavedTemplate?: (template: SaveTemplateResult) => void
  /** Clear the template from generation state if async optimization fails. */
  onTemplateOptimizationFailed?: (templateId: string) => void
}

function templateResultFromSnapshot(snapshot: TemplateSnapshot): SaveTemplateResult {
  return {
    id: snapshot.id,
    name: snapshot.name,
    slide_count: snapshot.slide_count ?? snapshot.template_blueprint?.slides?.length ?? 0,
    created_at: snapshot.created_at,
    blueprint_generation_method: snapshot.blueprint_generation_method ?? snapshot.template_blueprint?.generation_method,
    blueprint_enrichment_status: snapshot.blueprint_enrichment_status,
    blueprint_enrichment_error: snapshot.blueprint_enrichment_error,
    blueprint_enriched_at: snapshot.blueprint_enriched_at,
    template_purity_status: snapshot.template_purity_status,
    template_purity_error: snapshot.template_purity_error,
    template_purified_at: snapshot.template_purified_at,
  }
}

/**
 * "Save as Template" dialog. Captures a name and asks Director to freeze the
 * current deck's design (structure + theme, content → typed slots) for reuse.
 * Director builds the snapshot from the session's strawman + the frozen plans
 * captured during the build. See TEMPLATE_PLAN.md §1/§3.
 */
export function TemplateSaveDialog({
  open,
  onOpenChange,
  sessionId,
  sourcePresentationId,
  onSavedTemplate,
  onTemplateOptimizationFailed,
}: TemplateSaveDialogProps) {
  const { toast } = useToast()
  const { reoptimizeTemplate, saveTemplate, getTemplate, loading, watchTemplateStatus } = useTemplates()
  const [name, setName] = useState('')
  const [trackedTemplate, setTrackedTemplate] = useState<SaveTemplateResult | null>(null)
  const stopStatusPollingRef = useRef<(() => void) | null>(null)

  // Studio ownership excludes dialog openness: a valid optimization watcher
  // continues after the normal save/close flow. A new source gets a new epoch,
  // including A → B → A, so results already sent for A cannot affect B.
  const studioSourceKey = JSON.stringify([sessionId, sourcePresentationId ?? null])
  const studioOwnerRef = useRef({ key: studioSourceKey })
  if (studioOwnerRef.current.key !== studioSourceKey) studioOwnerRef.current = { key: studioSourceKey }
  const studioOwner = studioOwnerRef.current
  const [studioRetryDiagnostics, setStudioRetryDiagnostics] = useState<{ owner: typeof studioOwner; templateId: string; errors: string[] } | null>(null)
  const [studioObservation, setStudioObservation] = useState<{ owner: typeof studioOwner; mount: object; templateId: string; status: 'paused' | 'refreshing'; reason: 'timeout' | 'mismatch' | 'unavailable' | 'unverified' } | null>(null)
  const studioReadinessRef = useRef<HTMLDivElement>(null)
  const studioRefreshButtonRef = useRef<HTMLButtonElement>(null)
  const studioObservationRef = useRef<typeof studioObservation>(null)
  const studioMountedRef = useRef<object | null>(null)
  const studioRequestRef = useRef<{ owner: typeof studioOwner; mount: object; pending: boolean } | null>(null)
  // An acknowledged template owns its watcher independently of a later save
  // attempt. A null/rejected save does not replace the acknowledged template.
  const studioWatchRef = useRef<{ owner: typeof studioOwner; mount: object } | null>(null)
  const studioTrackedOwnerRef = useRef<typeof studioOwner | null>(null)
  const studioPollingOwnerRef = useRef<typeof studioOwner | null>(null)
  const studioCallbacksRef = useRef({ toast, onSavedTemplate, onTemplateOptimizationFailed, onOpenChange })
  studioCallbacksRef.current = { toast, onSavedTemplate, onTemplateOptimizationFailed, onOpenChange }
  const visibleTrackedTemplate = !STUDIO_TEMPLATE_FLOW || studioTrackedOwnerRef.current === studioOwner ? trackedTemplate : null

  const isCurrentStudioRequest = (request: NonNullable<typeof studioRequestRef.current>) =>
    studioMountedRef.current === request.mount && studioOwnerRef.current === request.owner && studioRequestRef.current === request

  const isCurrentStudioWatch = (watch: NonNullable<typeof studioWatchRef.current>) =>
    studioMountedRef.current === watch.mount && studioOwnerRef.current === watch.owner && studioWatchRef.current === watch

  const visibleStudioObservation = STUDIO_TEMPLATE_FLOW &&
    studioObservation?.owner === studioOwner && studioObservation.mount === studioMountedRef.current &&
    studioObservation.templateId === visibleTrackedTemplate?.id ? studioObservation : null

  const updateStudioObservation = (observation: typeof studioObservation) => {
    studioObservationRef.current = observation
    setStudioObservation(observation)
  }

  const pauseStudioObservation = (watch: NonNullable<typeof studioWatchRef.current>, templateId: string, reason: NonNullable<typeof studioObservation>['reason']) => {
    if (!isCurrentStudioWatch(watch)) return
    stopStatusPollingRef.current?.()
    stopStatusPollingRef.current = null
    studioWatchRef.current = null
    updateStudioObservation({ owner: watch.owner, mount: watch.mount, templateId, status: 'paused', reason })
  }

  const beginStudioRequest = () => {
    if (!studioMountedRef.current || studioOwnerRef.current !== studioOwner) return null
    if (studioRequestRef.current?.owner === studioOwner && studioRequestRef.current.pending) return null
    const request = { owner: studioOwner, mount: studioMountedRef.current, pending: true }
    studioRequestRef.current = request
    return request
  }

  useEffect(() => {
    studioMountedRef.current = {}
    return () => { studioMountedRef.current = null }
  }, [])

  useEffect(() => {
    if (!STUDIO_TEMPLATE_FLOW || studioPollingOwnerRef.current === studioOwner) return
    stopStatusPollingRef.current?.()
    stopStatusPollingRef.current = null
    studioPollingOwnerRef.current = null
    studioWatchRef.current = null
  }, [studioOwner])

  const startStatusPolling = useCallback((template: SaveTemplateResult) => {
    const studioRequest = studioRequestRef.current
    if (STUDIO_TEMPLATE_FLOW && (!studioRequest || !isCurrentStudioRequest(studioRequest))) return
    const studioWatch = STUDIO_TEMPLATE_FLOW ? { owner: studioRequest!.owner, mount: studioRequest!.mount } : null
    if (STUDIO_TEMPLATE_FLOW) studioWatchRef.current = studioWatch
    if (STUDIO_TEMPLATE_FLOW) studioTrackedOwnerRef.current = studioRequest!.owner
    if (STUDIO_TEMPLATE_FLOW) updateStudioObservation(null)
    setTrackedTemplate(template)
    stopStatusPollingRef.current?.()
    stopStatusPollingRef.current = null
    const status = templateGenerationStatus(template)
    if (status === 'ready' || status === 'failed' || status === 'needs_cleanup') {
      return
    }
    if (STUDIO_TEMPLATE_FLOW) studioPollingOwnerRef.current = studioRequest!.owner
    stopStatusPollingRef.current = watchTemplateStatus(template.id, {
      onUpdate: (snapshot) => {
        if (STUDIO_TEMPLATE_FLOW && !isCurrentStudioWatch(studioWatch!)) return
        if (STUDIO_TEMPLATE_FLOW && snapshot?.id !== template.id) return
        const next = templateResultFromSnapshot(snapshot)
        setTrackedTemplate(next)
      },
      onReady: (snapshot) => {
        if (STUDIO_TEMPLATE_FLOW && !isCurrentStudioWatch(studioWatch!)) return
        if (STUDIO_TEMPLATE_FLOW && snapshot?.id !== template.id) {
          pauseStudioObservation(studioWatch!, template.id, 'mismatch')
          return
        }
        if (STUDIO_TEMPLATE_FLOW && !isTemplateGenerationReady(snapshot)) {
          pauseStudioObservation(studioWatch!, template.id, 'unverified')
          return
        }
        const next = templateResultFromSnapshot(snapshot)
        setTrackedTemplate(next)
        if (STUDIO_TEMPLATE_FLOW) studioCallbacksRef.current.onSavedTemplate?.(next)
        else onSavedTemplate?.(next)
        if (STUDIO_TEMPLATE_FLOW && !isCurrentStudioWatch(studioWatch!)) return
        ;(STUDIO_TEMPLATE_FLOW ? studioCallbacksRef.current.toast : toast)({
          title: 'Template ready',
          description: `"${next.name}" is ready to reuse.`,
        })
        if (STUDIO_TEMPLATE_FLOW && isCurrentStudioWatch(studioWatch!)) studioWatchRef.current = null
      },
      onFailed: (snapshot, nextStatus) => {
        if (STUDIO_TEMPLATE_FLOW && !isCurrentStudioWatch(studioWatch!)) return
        if (STUDIO_TEMPLATE_FLOW && snapshot?.id !== template.id) {
          pauseStudioObservation(studioWatch!, template.id, 'mismatch')
          return
        }
        const next = templateResultFromSnapshot(snapshot)
        setTrackedTemplate(next)
        if (STUDIO_TEMPLATE_FLOW) studioCallbacksRef.current.onTemplateOptimizationFailed?.(next.id)
        else onTemplateOptimizationFailed?.(next.id)
        if (STUDIO_TEMPLATE_FLOW && !isCurrentStudioWatch(studioWatch!)) return
        ;(STUDIO_TEMPLATE_FLOW ? studioCallbacksRef.current.toast : toast)({
          title: nextStatus === 'needs_cleanup' ? 'Template needs cleanup' : 'Template optimization failed',
          description: next.template_purity_error
            || next.blueprint_enrichment_error
            || 'Review is available; retry optimization from this dialog or the template picker.',
          variant: 'destructive',
        })
        if (STUDIO_TEMPLATE_FLOW && isCurrentStudioWatch(studioWatch!)) studioWatchRef.current = null
      },
      onTimeout: () => {
        if (STUDIO_TEMPLATE_FLOW && !isCurrentStudioWatch(studioWatch!)) return
        if (STUDIO_TEMPLATE_FLOW) {
          pauseStudioObservation(studioWatch!, template.id, 'timeout')
          return
        }
        ;(STUDIO_TEMPLATE_FLOW ? studioCallbacksRef.current.toast : toast)({
          title: 'Template still optimizing',
          description: 'Review is available now. Available Templates will keep refreshing readiness while open.',
        })
      },
    })
  }, [onSavedTemplate, onTemplateOptimizationFailed, toast, watchTemplateStatus])

  useEffect(() => {
    return () => {
      stopStatusPollingRef.current?.()
      stopStatusPollingRef.current = null
    }
  }, [])

  const handleRefreshStatus = async () => {
    const observation = studioObservationRef.current
    if (!STUDIO_TEMPLATE_FLOW || !trackedTemplate || studioTrackedOwnerRef.current !== studioOwner || observation?.owner !== studioOwner || observation.mount !== studioMountedRef.current || observation.templateId !== trackedTemplate.id || observation.status !== 'paused') return
    const request = beginStudioRequest()
    if (!request) return
    const templateId = trackedTemplate.id
    const refreshButton = studioRefreshButtonRef.current
    updateStudioObservation({ owner: request.owner, mount: request.mount, templateId, status: 'refreshing', reason: observation.reason })
    let snapshot: TemplateSnapshot | null
    try {
      snapshot = await getTemplate(templateId)
    } catch {
      snapshot = null
    } finally {
      if (isCurrentStudioRequest(request)) request.pending = false
    }
    if (!isCurrentStudioRequest(request)) return
    if (!snapshot || snapshot.id !== templateId) {
      updateStudioObservation({ owner: request.owner, mount: request.mount, templateId, status: 'paused', reason: snapshot ? 'mismatch' : 'unavailable' })
      return
    }
    const next = templateResultFromSnapshot(snapshot)
    startStatusPolling(next)
    if (!isCurrentStudioRequest(request)) return
    // The successful read removes its recovery button. Return owned focus to
    // the status card without scrolling; a close or user focus move wins.
    if (refreshButton && refreshButton.ownerDocument.activeElement === refreshButton && studioReadinessRef.current?.isConnected) {
      studioReadinessRef.current.focus({ preventScroll: true })
    }
    if (isTemplateGenerationReady(snapshot)) {
      studioCallbacksRef.current.onSavedTemplate?.(next)
      if (!isCurrentStudioRequest(request)) return
      studioCallbacksRef.current.toast({ title: 'Template ready', description: `"${next.name}" is ready to reuse.` })
    } else if (['failed', 'needs_cleanup'].includes(templateGenerationStatus(snapshot))) {
      studioCallbacksRef.current.onTemplateOptimizationFailed?.(next.id)
    }
  }

  const handleRetryOptimization = async () => {
    if (!trackedTemplate) return
    if (STUDIO_TEMPLATE_FLOW && studioTrackedOwnerRef.current !== studioOwner) return
    const studioRequest = STUDIO_TEMPLATE_FLOW ? beginStudioRequest() : null
    if (STUDIO_TEMPLATE_FLOW && !studioRequest) return
    let result: Awaited<ReturnType<typeof reoptimizeTemplate>>
    try {
      result = await reoptimizeTemplate(trackedTemplate.id)
    } catch (error) {
      if (!STUDIO_TEMPLATE_FLOW) throw error
      result = null
    } finally {
      if (studioRequest && isCurrentStudioRequest(studioRequest)) studioRequest.pending = false
    }
    if (STUDIO_TEMPLATE_FLOW && !isCurrentStudioRequest(studioRequest!)) return
    if (!result) {
      ;(STUDIO_TEMPLATE_FLOW ? studioCallbacksRef.current.toast : toast)({
        title: 'Could not retry optimization',
        description: 'Director could not start template optimization. Please try again.',
        variant: 'destructive',
      })
      return
    }
    if (STUDIO_TEMPLATE_FLOW) {
      const acknowledgement = mergeTemplateRetryAcknowledgement(trackedTemplate, result)
      if (!acknowledgement) {
        studioCallbacksRef.current.toast({
          title: 'Could not verify retry',
          description: 'The response did not identify this template. Its previous status is unchanged; please try again.',
          variant: 'destructive',
        })
        return
      }
      // Historical diagnostics remain available even when the latest server
      // fields explicitly clear an error. They never determine readiness.
      setStudioRetryDiagnostics((previous) => ({
        owner: studioOwner,
        templateId: trackedTemplate.id,
        errors: [...new Set([
          ...(previous?.owner === studioOwner && previous.templateId === trackedTemplate.id ? previous.errors : []),
          ...acknowledgement.previousErrors,
        ])],
      }))
      studioCallbacksRef.current.toast({
        title: 'Retry requested',
        description: 'Review the saved status below; only a completed, clean template can be reused.',
      })
      if (!isCurrentStudioRequest(studioRequest!)) return
      startStatusPolling(acknowledgement.template)
      return
    }
    const next = {
      ...trackedTemplate,
      blueprint_enrichment_status: result.blueprint_enrichment_status ?? 'queued',
      blueprint_enrichment_error: result.blueprint_enrichment_error ?? null,
      blueprint_enriched_at: result.blueprint_enriched_at,
      template_purity_status: result.template_purity_status === 'clean' ? 'clean' : 'pending',
      template_purity_error: null,
      template_purified_at: result.template_purified_at ?? trackedTemplate.template_purified_at,
    }
    ;(STUDIO_TEMPLATE_FLOW ? studioCallbacksRef.current.toast : toast)({
      title: 'Optimizing template',
      description: `"${trackedTemplate.name}" will unlock for generation when optimization completes.`,
    })
    if (STUDIO_TEMPLATE_FLOW && !isCurrentStudioRequest(studioRequest!)) return
    startStatusPolling(next)
  }

  const handleSave = async () => {
    if (STUDIO_TEMPLATE_FLOW && (!studioMountedRef.current || studioOwnerRef.current !== studioOwner)) return
    const trimmed = name.trim()
    if (!trimmed) {
      ;(STUDIO_TEMPLATE_FLOW ? studioCallbacksRef.current.toast : toast)({ title: 'Name required', description: 'Give your template a name.', variant: 'destructive' })
      return
    }
    if (!sessionId) {
      ;(STUDIO_TEMPLATE_FLOW ? studioCallbacksRef.current.toast : toast)({ title: 'No deck to save', description: 'Build and agree a deck first.', variant: 'destructive' })
      return
    }
    if (!sourcePresentationId) {
      ;(STUDIO_TEMPLATE_FLOW ? studioCallbacksRef.current.toast : toast)({ title: 'No completed deck to save', description: 'Build a deck before saving a template.', variant: 'destructive' })
      return
    }
    const studioRequest = STUDIO_TEMPLATE_FLOW ? beginStudioRequest() : null
    if (STUDIO_TEMPLATE_FLOW && !studioRequest) return
    let result: Awaited<ReturnType<typeof saveTemplate>>
    try {
      result = await saveTemplate({
        name: trimmed,
        sourceSessionId: sessionId,
        sourcePresentationId,
      })
    } catch (error) {
      if (!STUDIO_TEMPLATE_FLOW) throw error
      result = null
    } finally {
      if (studioRequest && isCurrentStudioRequest(studioRequest)) studioRequest.pending = false
    }
    if (STUDIO_TEMPLATE_FLOW && !isCurrentStudioRequest(studioRequest!)) return
    if (result) {
      const generationReady = isTemplateGenerationReady(result)
      if (generationReady) {
        if (STUDIO_TEMPLATE_FLOW) studioCallbacksRef.current.onSavedTemplate?.(result)
        else onSavedTemplate?.(result)
      }
      if (STUDIO_TEMPLATE_FLOW && !isCurrentStudioRequest(studioRequest!)) return
      ;(STUDIO_TEMPLATE_FLOW ? studioCallbacksRef.current.toast : toast)({
        title: 'Template saved',
        description: !generationReady
          ? `"${result.name}" (${result.slide_count} slides) is saved. Optimizing template...`
          : `"${result.name}" (${result.slide_count} slides) is ready to reuse.`,
      })
      if (STUDIO_TEMPLATE_FLOW && !isCurrentStudioRequest(studioRequest!)) return
      startStatusPolling(result)
      if (STUDIO_TEMPLATE_FLOW && !isCurrentStudioRequest(studioRequest!)) return
      setName('')
      if (STUDIO_TEMPLATE_FLOW) studioCallbacksRef.current.onOpenChange(false)
      else onOpenChange(false)
    } else {
      ;(STUDIO_TEMPLATE_FLOW ? studioCallbacksRef.current.toast : toast)({
        title: 'Could not save template',
        description: 'The deck may not be finished yet, or the service is unreachable.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent portalContainer={STUDIO_TEMPLATE_FLOW && open && typeof document !== 'undefined' ? document.fullscreenElement : undefined} data-studio-v4-shell={STUDIO_TEMPLATE_FLOW ? "true" : undefined} data-studio-template-flow={STUDIO_TEMPLATE_FLOW ? "save" : undefined} data-studio-v4-dialog={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'template-save' : undefined}>
        <DialogHeader className="studio-template-flow-header">
          {STUDIO_TEMPLATE_FLOW && <span className="studio-template-flow-eyebrow">Templates · Save reusable design</span>}
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Lock this deck&apos;s structure, layout and theme so you can reuse it later
            with fresh content. The content is replaced by typed slots — nothing you typed
            is stored as-is.
          </DialogDescription>
        </DialogHeader>
        <TemplateFlowBody>
          <div className="space-y-2 py-2">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              placeholder="e.g. Monthly Revenue Report"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSave() }}
              autoFocus
              disabled={loading}
            />
          </div>
          {visibleTrackedTemplate && (
            <div ref={STUDIO_TEMPLATE_FLOW ? studioReadinessRef : undefined} tabIndex={STUDIO_TEMPLATE_FLOW ? -1 : undefined} className={`studio-template-flow-readiness rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200${STUDIO_TEMPLATE_FLOW ? ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2' : ''}`} data-template-status={STUDIO_TEMPLATE_FLOW ? templateGenerationStatus(visibleTrackedTemplate) : undefined} role={STUDIO_TEMPLATE_FLOW ? "status" : undefined} aria-live={STUDIO_TEMPLATE_FLOW ? "polite" : undefined}>
              {STUDIO_TEMPLATE_FLOW && <div className="studio-template-flow-saved"><strong>{visibleTrackedTemplate.name}</strong><small>{visibleTrackedTemplate.slide_count} slides · saved template</small></div>}
              {isTemplateGenerationReady(visibleTrackedTemplate) ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">Ready to reuse</span>
                </div>
              ) : ['failed', 'needs_cleanup'].includes(templateGenerationStatus(visibleTrackedTemplate)) ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    <span className="font-medium">
                      {templateGenerationStatus(visibleTrackedTemplate) === 'needs_cleanup'
                        ? 'Needs cleanup'
                        : 'Optimization failed'}
                    </span>
                  </div>
                  {(visibleTrackedTemplate.template_purity_error || visibleTrackedTemplate.blueprint_enrichment_error) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {visibleTrackedTemplate.template_purity_error || visibleTrackedTemplate.blueprint_enrichment_error}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleRetryOptimization()}
                    disabled={loading}
                  >
                    <RotateCw className="mr-2 h-3.5 w-3.5" />
                    Retry optimization
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {STUDIO_TEMPLATE_FLOW && (visibleStudioObservation || templateGenerationStatus(visibleTrackedTemplate) === 'needs_optimization') ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
                  <span className="font-medium">{visibleStudioObservation ? 'Last verified status: ' + (templateGenerationStatus(visibleTrackedTemplate) === 'needs_optimization' ? 'needs optimization' : 'optimization incomplete') : STUDIO_TEMPLATE_FLOW && templateGenerationStatus(visibleTrackedTemplate) === 'needs_optimization' ? 'Needs optimization' : 'Optimizing template...'}</span>
                </div>
              )}
              {visibleStudioObservation && (
                <div className="mt-3 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-slate-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-slate-200" data-template-observation={visibleStudioObservation.status}>
                  <strong>{visibleStudioObservation.status === 'refreshing' ? 'Refreshing status…' : 'Status updates paused'}</strong>
                  <p>{visibleStudioObservation.reason === 'mismatch'
                    ? 'The response did not match this saved template. Your last verified status is shown.'
                    : visibleStudioObservation.reason === 'unavailable'
                      ? 'The status could not be read. Your last verified status is shown.'
                      : visibleStudioObservation.reason === 'unverified'
                        ? 'The response could not confirm readiness. Your last verified status is shown.'
                        : 'The status checks ended before completion was confirmed. Your last verified status is shown.'}</p>
                  {/* Keep native focus while unavailable; the request gate rejects repeat keys. */}
                  <Button ref={studioRefreshButtonRef} type="button" variant="outline" size="sm" onClick={() => void handleRefreshStatus()} aria-disabled={loading || visibleStudioObservation.status === 'refreshing'} className={loading || visibleStudioObservation.status === 'refreshing' ? 'pointer-events-none opacity-50' : undefined}>
                    {visibleStudioObservation.status === 'refreshing' ? 'Refreshing…' : 'Refresh status'}
                  </Button>
                  <p className="text-slate-500 dark:text-slate-400">Refreshing reads status; it does not request another optimization.</p>
                </div>
              )}
              {STUDIO_TEMPLATE_FLOW && studioRetryDiagnostics?.owner === studioOwner && studioRetryDiagnostics.templateId === visibleTrackedTemplate.id && studioRetryDiagnostics.errors.length > 0 && (
                <details className="mt-3 text-xs text-slate-500 dark:text-slate-400" data-template-previous-errors="true">
                  <summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Previous optimization errors</summary>
                  <ul className="mt-2 space-y-1 break-words">
                    {studioRetryDiagnostics.errors.map((error) => <li key={error}>{error}</li>)}
                  </ul>
                </details>
              )}
              {STUDIO_TEMPLATE_FLOW && !isTemplateGenerationReady(visibleTrackedTemplate) && <p className="studio-template-flow-help mt-3">Review is available in Available Templates. Reuse unlocks after optimization.</p>}
            </div>
          )}
        </TemplateFlowBody>
        <DialogFooter className="studio-template-flow-footer">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading && !(STUDIO_TEMPLATE_FLOW && visibleStudioObservation?.status === 'refreshing')}>
            {visibleTrackedTemplate ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={loading || !name.trim() || !sessionId || !sourcePresentationId}
          >
            {loading && !(STUDIO_TEMPLATE_FLOW && visibleStudioObservation?.status === 'refreshing') ? 'Saving…' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
