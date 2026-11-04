'use client'

// J2-SILENT-FAIL (flag NEXT_PUBLIC_STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED, default off): the React side of
// lib/studio-compose-job-failsafe.ts. With `enabled` false it only declares hooks and does nothing: no timer, no
// storage access, no request, and `decorate` hands every card back untouched.
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import {
  createComposeJobFailsafe,
  decorateComposeJobCard,
  type ComposeFailsafeCard,
  type ComposeFailsafeJob,
  type ComposeFailsafeViewerApi,
  type ComposeJobFailsafeController,
  type ComposeJobStorage,
} from '@/lib/studio-compose-job-failsafe'

const VIEWER_POLL_MS = 800

export interface UseStudioComposeJobFailsafeOptions<TJob extends ComposeFailsafeJob> {
  enabled: boolean
  sessionId: string | null
  presentationId: string | null
  /** The page's studioSlideComposeOwnerKey: a new owner (deck, version, route) starts a new controller. */
  ownerKey: string
  jobs: Record<string, TJob>
  setJobs: Dispatch<SetStateAction<Record<string, TJob>>>
  getViewerApi: () => ComposeFailsafeViewerApi | null
  captureOwner: () => () => boolean
  armJob: (job: TJob) => void
  disarmJob: (jobId: string) => void
  onFailed: (job: TJob, message: string) => void
  onDismissed: (job: TJob, visualIndex: number) => void
}

export function useStudioComposeJobFailsafe<TJob extends ComposeFailsafeJob>(options: UseStudioComposeJobFailsafeOptions<TJob>) {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const controllerRef = useRef<ComposeJobFailsafeController<TJob> | null>(null)
  const { enabled, sessionId, presentationId, ownerKey } = options

  useEffect(() => {
    if (!enabled || !sessionId || sessionId === 'new' || !presentationId) return
    let storage: ComposeJobStorage | null = null
    try { storage = window.sessionStorage } catch { storage = null }
    const controller = createComposeJobFailsafe<TJob>({
      sessionId,
      presentationId,
      storage,
      now: () => Date.now(),
      setTimer: (callback, ms) => window.setTimeout(callback, ms),
      clearTimer: handle => window.clearTimeout(handle as number),
      fetchJson: url => fetch(url, { cache: 'no-store' }),
      getJobs: () => optionsRef.current.jobs,
      setJobs: update => optionsRef.current.setJobs(update),
      captureOwner: () => optionsRef.current.captureOwner(),
      getViewerApi: () => optionsRef.current.getViewerApi(),
      armJob: job => optionsRef.current.armJob(job),
      disarmJob: jobId => optionsRef.current.disarmJob(jobId),
      onFailed: (job, message) => optionsRef.current.onFailed(job, message),
      onDismissed: (job, visualIndex) => optionsRef.current.onDismissed(job, visualIndex),
    })
    controllerRef.current = controller
    controller.sync(optionsRef.current.jobs)
    void controller.restore()
    const watcher = window.setInterval(() => { void controller.onViewerApi(optionsRef.current.getViewerApi()) }, VIEWER_POLL_MS)
    return () => {
      window.clearInterval(watcher)
      controller.dispose()
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [enabled, sessionId, presentationId, ownerKey])

  useEffect(() => {
    controllerRef.current?.sync(options.jobs)
  }, [options.jobs])

  const dismiss = useCallback((jobId: string) => {
    const controller = controllerRef.current
    if (controller) { controller.dismiss(jobId); return }
    // No controller (no deck yet): still never leave a card that cannot be closed.
    optionsRef.current.setJobs(previous => {
      if (previous[jobId]?.status !== 'error') return previous
      const { [jobId]: _dismissed, ...rest } = previous
      return rest as Record<string, TJob>
    })
  }, [])

  const decorate = useCallback(<TCard extends ComposeFailsafeCard>(card: TCard, job: TJob | undefined): TCard =>
    decorateComposeJobCard(card, job, { enabled, onDismiss: dismiss }), [enabled, dismiss])

  return { decorate, dismiss }
}
