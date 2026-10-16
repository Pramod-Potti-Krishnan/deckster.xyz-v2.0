"use client"

// Template "wow" flow, Studio half: what the Template library (composer-library-dialog.tsx) shows while an uploaded template is prepared.
// Flag NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS (exact "true", default off). The dialog calls useTemplateProgress with `enabled` and, flag off, it
// gets an inert answer: no state beyond the hook's own empty cells, no storage read, no request, no effect that does anything.
// The words, the mapping from Director's job read to what is drawn, and the poll loop are in lib/studio-template-progress.ts (pure, pinned by
// scripts/test-studio-template-progress.mjs); this file is the React around them.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { composerJobRecoveryMessage, composerRequest } from '@/lib/composer-library'
import {
  TEMPLATE_AS_IS_LINE, TEMPLATE_CANNOT_READ, TEMPLATE_STALLED_LINE,
  parseTrackedTemplateJob, templateActionHeld, templateProgressKey, templateProgressView, templateToastsDue, templateUploadHeld, watchTemplateJob,
  type TemplateProgressJob, type TemplateProgressView, type TemplateRowAction, type TrackedTemplateJob,
} from '@/lib/studio-template-progress'

/** Waits `ms`, or rejects with an AbortError as soon as `signal` aborts (waitForComposerJob's own pause). */
const pause = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const aborted = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
  const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve() }, ms)
  signal.addEventListener('abort', aborted, { once: true })
  if (signal.aborted) aborted()
})

export interface TemplateProgressControls {
  enabled: boolean
  /** The tracked job's latest view, or null (nothing tracked, or not read yet). */
  view: TemplateProgressView | null
  /** Whether a moving job holds the Upload button. A failed, stalled, unreadable or finished job never does. */
  uploadHeld: boolean
  /** Start reading the job the upload just created (and keep it in sessionStorage so a reload goes on reading it). */
  track: (job: Omit<TrackedTemplateJob, 'shown'>) => void
  /** Whether the tracked job holds `action` on the library row of `templateId`. */
  held: (templateId: string, action: TemplateRowAction) => boolean
  /** `node` (the dialog's own progress line) with the card for the tracked job above it; `node` itself when nothing is tracked. */
  around: (node: ReactNode, studioShell: boolean) => ReactNode
  /**
   * The `admission_report` of the tracked job's latest read when that job saved `templateId` (Director's job read: the whole report, with its slides), else null.
   * The "What changed" admission report under the template's row reads it (components/builder/composer-admission-report.tsx); nothing here looks inside it.
   */
  report: (templateId: string) => unknown
}

const INERT: TemplateProgressControls = {
  enabled: false, view: null, uploadHeld: false, track() {}, held: () => false, around: node => node, report: () => null,
}

export function useTemplateProgress({ enabled, userId, refresh, onEnd, retryUpload }: {
  enabled: boolean
  userId: string | null | undefined
  /** The dialog's own list refresh: run when the as-is template is saved (its row appears) and when the job ends. */
  refresh: () => Promise<void>
  /** Called once when the job being read has finished (with its last view). The dialog lets go of the chosen file unless `view.retry`. */
  onEnd?: (view: TemplateProgressView) => void
  /** #406's Retry for an upload, from the dialog: the handler that uploads the same chosen file again, or null when it cannot (no file chosen any more). */
  retryUpload?: () => (() => void) | null
}): TemplateProgressControls {
  const [tracked, setTracked] = useState<TrackedTemplateJob | null>(null)
  const [job, setJob] = useState<TemplateProgressJob | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const shownRef = useRef<string[]>([])
  const key = templateProgressKey(userId)
  const jobId = tracked?.job_id ?? null

  // Come back to the job: a reload (or reopening Studio in this tab) finds the stored job and goes on reading it.
  useEffect(() => {
    if (!enabled || !userId) return
    let stored: TrackedTemplateJob | null = null
    try { stored = parseTrackedTemplateJob(sessionStorage.getItem(key)) } catch { /* no recovery record */ }
    if (stored) setTracked(current => current ?? stored)
  }, [enabled, userId, key])

  // Read the job at the pace Director asks for until it ends. Re-runs for another job, or on Retry (`attempt`); the cleanup stops the poll.
  useEffect(() => {
    if (!enabled || !jobId) return
    const controller = new AbortController()
    const record = tracked as TrackedTemplateJob
    shownRef.current = record.shown
    let savedTemplate: string | null = null
    let ended = false
    const remember = () => { try { sessionStorage.setItem(key, JSON.stringify({ ...record, shown: shownRef.current })) } catch { /* storage unavailable */ } }
    const forget = () => { try { sessionStorage.removeItem(key) } catch { /* storage unavailable */ } }
    const reload = () => { void refreshRef.current().catch(() => { /* the list keeps what it had; the next refresh retries */ }) }
    setProblem(null)
    void watchTemplateJob({
      jobId, signal: controller.signal, sleep: pause, now: Date.now,
      read: (id, signal) => composerRequest<TemplateProgressJob>(`jobs/${encodeURIComponent(id)}`, undefined, signal),
      onProblem: message => { if (!controller.signal.aborted) setProblem(message) },
      onJob: next => {
        setJob(next)
        const view = templateProgressView(next)
        const due = templateToastsDue(shownRef.current, view)
        if (due.toasts.length) {
          shownRef.current = due.shown
          remember()
          for (const item of due.toasts) toast({ title: item.title, description: item.description })
        }
        // The as-is template is a row in the library from the moment Director saves it: show it now, and once more when the job ends.
        if (view.templateId && view.templateId !== savedTemplate) { savedTemplate = view.templateId; reload() } else if (view.terminal) reload()
        // A finished job is kept in the tab only while it has something to say about new topics (paused, refused, failed); a clean or failed
        // one is forgotten, so a reload does not bring it back.
        if (view.terminal && (view.failed || !view.detailed || view.newTopic === 'available')) forget()
        if (view.terminal && !ended) { ended = true; onEndRef.current?.(view) }
      },
    }).then(outcome => { if (outcome === 'limit' && !controller.signal.aborted) setProblem(TEMPLATE_STALLED_LINE) })
    return () => controller.abort()
  }, [enabled, jobId, attempt]) // `tracked` itself never changes while its job id does not

  const track = useCallback((next: Omit<TrackedTemplateJob, 'shown'>) => {
    const record = { ...next, shown: [] }
    try { sessionStorage.setItem(key, JSON.stringify(record)) } catch { /* storage unavailable */ }
    setJob(null)
    setProblem(null)
    setTracked(record)
  }, [key])
  const retry = useCallback(() => { setProblem(null); setAttempt(count => count + 1) }, [])
  const dismiss = useCallback(() => {
    try { sessionStorage.removeItem(key) } catch { /* storage unavailable */ }
    setTracked(null)
    setJob(null)
    setProblem(null)
  }, [key])

  if (!enabled) return INERT
  const view = job ? templateProgressView(job) : null
  const rereading = !!problem || !!view?.stalled
  const name = tracked?.file_name || (job as { upload_ref?: { file_name?: string } } | null)?.upload_ref?.file_name || ''
  return {
    enabled, view,
    uploadHeld: templateUploadHeld(!!tracked, view, problem !== null),
    track,
    held: (templateId, action) => templateActionHeld(view, templateId, action),
    report: templateId => job && job.template_id === templateId ? (job as { admission_report?: unknown }).admission_report ?? null : null,
    // `around` runs while the dialog draws, after its own handlers exist: `retryUpload` is asked here, not when the hook is called.
    around: (node, studioShell) => {
      if (!(tracked && (view || problem))) return node
      const uploadAgain = view?.retry ? retryUpload?.() ?? null : null
      return <>
        <TemplateProgressCard view={view} problem={problem} name={name} studioShell={studioShell}
          onRetry={rereading ? retry : uploadAgain} onDismiss={dismiss} dismissible={!!problem || !view || view.dismissible}
          failure={view?.failed ? composerJobRecoveryMessage({ job_id: tracked.job_id, kind: 'upload', reason: 'failed', detail: view.failure, retry: null }, !!uploadAgain) : null} />
        {node}
      </>
    },
  }
}

const DOT_CLASS = {
  queued: 'border border-muted-foreground/40',
  working: 'bg-primary/50 animate-pulse',
  analysed: 'bg-primary/70',
  locked: 'bg-primary',
  kept: 'border border-dashed border-muted-foreground',
} as const

/** One uploaded template's progress: the file, the stage, the slides done and the time left, one dot per slide, and what is ready. */
export function TemplateProgressCard({ view, problem, name, studioShell, onRetry, onDismiss, dismissible, failure }: {
  view: TemplateProgressView | null
  problem: string | null
  name: string
  studioShell: boolean
  /** Retry: read the job again (stalled, unreadable), or upload the file again (failed): null when there is none to offer. */
  onRetry: (() => void) | null
  onDismiss: () => void
  dismissible: boolean
  /** #406's words for a failed upload (Director's own error text after them), or null. */
  failure: string | null
}) {
  const note = (value: string | null) => value && <p className="text-xs text-muted-foreground">{value}</p>
  return (
    <div data-studio-template-progress={studioShell ? 'true' : undefined} className="space-y-2 rounded-md border p-3">
      {name && <p className="truncate text-sm font-medium" title={name}>{name}</p>}
      {view && <>
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{failure ?? view.statusLine}</p>
        {!view.failed && view.percent !== null && <div role="progressbar" aria-label="Slides done" aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.percent}
          data-studio-template-bar={studioShell ? 'true' : undefined} className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${view.percent}%` }} />
        </div>}
        {!view.failed && (view.countLabel || view.eta) && <p className="text-xs text-muted-foreground">{[view.countLabel, view.eta].filter(Boolean).join(' · ')}</p>}
        {!view.failed && view.dots.length > 0 && <ul aria-label="Slide by slide progress" className="flex flex-wrap gap-1">
          {view.dots.map(dot => <li key={dot.index} title={dot.label} aria-label={dot.label} data-studio-template-dot={dot.kind}
            className={`h-2 w-2 rounded-full ${DOT_CLASS[dot.kind]}`} />)}
        </ul>}
        {view.asIsReady && !view.terminal && note(TEMPLATE_AS_IS_LINE)}
        {note(view.newTopicLine)}
        {note(view.lockingNote)}
        {view.stalled && !problem && <p className="text-xs text-muted-foreground">{TEMPLATE_STALLED_LINE}</p>}
      </>}
      {problem && <p className="text-xs text-muted-foreground">{problem === TEMPLATE_STALLED_LINE ? problem : TEMPLATE_CANNOT_READ}</p>}
      {(onRetry || dismissible) && <div className="flex flex-wrap gap-2">
        {onRetry && <Button data-studio-template-progress-action={studioShell ? 'retry' : undefined} size="sm" variant="outline" onClick={onRetry}>Retry</Button>}
        {dismissible && <Button data-studio-template-progress-action={studioShell ? 'dismiss' : undefined} size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>}
      </div>}
    </div>
  )
}
