// Template "wow" flow, Studio half (FRONTEND, 15 Oct 2026). Flag NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS (build-time, exact "true", default off).
//
// Today an uploaded template is one line, "Preparing template: cracking…", with every button of the Template library disabled until the whole
// job is done (up to 15 minutes for a 30-slide deck). Director (COMPOSER_TEMPLATE_PROGRESS_ENABLED) now saves the as-is template as soon as
// Composer has sealed it and adds `template_progress`, `capabilities` and `poll` to GET /api/template-ingest/stage/jobs/{job_id}
// (streams/composer/TEMPLATE-PROGRESS-CONTRACT.md section 2.2). With the flag on the library reads them:
//
//   - polls at `poll.next_interval_ms` (the old 5 s when Director sends no `poll`), and stops on `poll === null` (a terminal job);
//   - "Use original" is enabled as soon as `capabilities.use_original.state` is "available" and `template_progress.as_is.ready` is true,
//     with a toast "Ready to use as-is" (once per job);
//   - shows slides_done / slide_count as a bar, the ETA in words (left out when `eta_s` is null), the stage in plain words and one dot per
//     slide from `slides[].state`. A slide kept as-is is a neutral dot, never an error;
//   - "New topic" follows `capabilities.new_topic.state` ONLY: processing says "Preparing for new topics…", available enables it with a toast
//     "Template ready for new topics" (once per job). PK 13 Oct: a slide that is `unlockable` / kept as-is does NOT block new topics, so no
//     slide state is ever read to decide that. unavailable / refused are plain words (a reason code is never shown); a paused or failed lock
//     shows Director's own `locking.message`;
//   - a job that failed, or that has gone 120 s without a heartbeat (`poll.stalled`), never blocks a new upload; the stalled one says
//     "Still working…" with Retry and Dismiss;
//   - a finished card is never a dead end: a failed job, or a lock that failed and Director calls retryable, keeps #406's Retry (the dialog's own
//     upload again, same file) and Dismiss; a refused, paused or otherwise unavailable one gets Dismiss. Dismiss forgets the stored job.
//
// This module is pure (no React, no network): the dialog's hook supplies the request and the storage. scripts/test-studio-template-progress.mjs
// runs it on Director's own answers (scripts/fixtures/template-progress/director-template-progress-reads.json).

import type { ComposerJob } from '@/lib/composer-library'

/** The three fields Director adds to the job read when COMPOSER_TEMPLATE_PROGRESS_ENABLED is on (all absent before / with the flag off). */
export interface TemplateProgressSlide {
  slide_id?: string
  index?: number
  /** queued | analysing | analysed | locked | unlockable */
  state?: string
  kept_as_is?: boolean
}
export interface TemplateProgressFields {
  /** null when Director never received progress for the job (a Composer without its flag). */
  template_progress?: {
    /** converting | placing | checking | locking | ready | failed */
    stage?: string | null
    kept_as_is?: string[]
    slide_count?: number | null
    slides_done?: number | null
    eta_s?: number | null
    as_is?: { ready?: boolean; template_id?: string | null } | null
    /** state: running | paused | failed | done; `message` is plain words when paused or failed. */
    locking?: { state?: string | null; message?: string | null } | null
    slides?: TemplateProgressSlide[]
  } | null
  capabilities?: {
    use_original?: { state?: string; reason_code?: string } | null
    new_topic?: { state?: string; reason_code?: string; retryable?: boolean } | null
  } | null
  /** null on a terminal job; absent from a Director without the flow. */
  poll?: { next_interval_ms?: number; stalled?: boolean } | null
}
export type TemplateProgressJob = ComposerJob & TemplateProgressFields

/** The old poll interval (waitForComposerJob): used when Director sends no `poll`. */
export const TEMPLATE_POLL_FALLBACK_MS = 5000
/** Director sends 2000 to 10000. Whatever it sends is kept inside these, so a bad value can neither hammer the service nor stop the poll. */
export const TEMPLATE_POLL_MIN_MS = 1000
export const TEMPLATE_POLL_MAX_MS = 60000
/** A job still unfinished after this long stops being polled and shows "Still working…" with Retry (the longest real job was about 15 minutes). */
export const TEMPLATE_WATCH_LIMIT_MS = 90 * 60 * 1000
const MAX_DOTS = 150

const TERMINAL_STATUSES = ['complete', 'failed', 'cancelled']
export const templateJobTerminal = (job: Pick<ComposerJob, 'status'>): boolean => TERMINAL_STATUSES.includes(job.status)
const statusWords = (job: Pick<ComposerJob, 'status'>): string => (typeof job.status === 'string' ? job.status : '').replaceAll('_', ' ')

/**
 * The wait before the next read, or null to stop: `poll === null` (Director's "terminal job") or a terminal status. An absent `poll`
 * (a Director without the flow) keeps the old interval. A usable `next_interval_ms` is clamped to [1 s, 60 s].
 */
export function nextTemplatePollMs(job: TemplateProgressJob, fallbackMs: number = TEMPLATE_POLL_FALLBACK_MS): number | null {
  if (job.poll === null || templateJobTerminal(job)) return null
  const asked = job.poll?.next_interval_ms
  if (typeof asked !== 'number' || !Number.isFinite(asked) || asked <= 0) return fallbackMs
  return Math.min(TEMPLATE_POLL_MAX_MS, Math.max(TEMPLATE_POLL_MIN_MS, Math.round(asked)))
}

// ---- words -----------------------------------------------------------------------------------------------------------------------------

const STAGE_WORDS: Record<string, string> = {
  converting: 'Reading your presentation…',
  placing: 'Placing your slides…',
  checking: 'Checking the layout…',
  locking: 'Analysing your slides…',
  ready: 'Template added to your library.',
  failed: 'The upload could not be finished.',
}
export const TEMPLATE_STALLED_LINE = 'Still working…'
export const TEMPLATE_AS_IS_LINE = 'Ready to use as it is.'
export const TEMPLATE_NEW_TOPIC_PROCESSING = 'Preparing for new topics…'
export const TEMPLATE_NEW_TOPIC_READY = 'Ready for new topics.'
/** What the card says when Director's answer cannot be read at all (not found, refused) or the job outlasts the watch limit. */
export const TEMPLATE_CANNOT_READ = "We can't check this upload's progress right now."

/** The time left in words, or null (unknown, nothing left). */
export function templateEtaWords(seconds: unknown): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null
  if (seconds <= 45) return 'less than a minute left'
  if (seconds <= 90) return 'about a minute left'
  if (seconds < 3600) return `about ${Math.round(seconds / 60)} minutes left`
  return 'more than an hour left'
}

/** Plain words for a new-topic state Director reports as not available. Never a code, never the refusal object. */
function unavailableWords(reason: unknown, asIsReady: boolean): string {
  const lead = reason === 'FLAG_DISABLED' ? 'New topics are not turned on yet.'
    : reason === 'SEMANTIC_NOT_RUN' ? 'New topics are not ready for this template.'
      : reason === 'UPLOAD_FAILED' ? 'The upload did not finish.'
        : reason === 'SEMANTIC_REFUSED' ? 'This template cannot be used for new topics.'
          : 'New topics are not available for this template yet.'
  return reason === 'UPLOAD_FAILED' || !asIsReady ? lead : `${lead} You can still use it as it is.`
}

// ---- the view --------------------------------------------------------------------------------------------------------------------------

/** queued: waiting; working: being analysed now; analysed: roles found, being checked; locked: done; kept: kept as it is (neutral, not an error). */
export type TemplateDotKind = 'queued' | 'working' | 'analysed' | 'locked' | 'kept'
export interface TemplateProgressDot { index: number; kind: TemplateDotKind; label: string }

export interface TemplateProgressView {
  terminal: boolean
  /** The job failed or was cancelled. */
  failed: boolean
  /** Director's own error text for a failed job, or null. */
  failure: string | null
  /** No heartbeat for 120 s (`poll.stalled`) on a job that is not finished. */
  stalled: boolean
  /** Director sent `template_progress`. False: a Composer without its flag; only `statusLine` is meaningful and nothing is gated. */
  detailed: boolean
  /** The line under the file's name: the stage in words (or the old "Preparing template: <status>…" when `detailed` is false). */
  statusLine: string
  stage: string | null
  slideCount: number | null
  slidesDone: number | null
  /** 0 to 100, or null while the slide count is unknown. */
  percent: number | null
  /** "18 of 30 slides done", or null. */
  countLabel: string | null
  eta: string | null
  dots: TemplateProgressDot[]
  /** `capabilities.use_original.state === "available"` AND `template_progress.as_is.ready`: the as-is template is saved and usable. */
  asIsReady: boolean
  /** The saved template's id (the job row's `template_id`), or null before the as-is template is saved. */
  templateId: string | null
  /** `capabilities.new_topic.state` and nothing else (PK 13 Oct): null when Director sent none. */
  newTopic: 'processing' | 'available' | 'unavailable' | 'refused' | null
  newTopicLine: string | null
  /** Director's `locking.message` while locking is paused or failed. */
  lockingNote: string | null
  /** The job is finished and uploading the file again is the way on: it failed, or its lock failed and Director says `retryable`. Never for refused or paused. */
  retry: boolean
  /** The card can be dismissed: a stalled job, a failed one, or a finished one with something to say about new topics (paused, refused, lock failed, unavailable). */
  dismissible: boolean
}

const count = (value: unknown): number | null => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null

function dotFor(slide: TemplateProgressSlide, terminal: boolean): TemplateProgressDot | null {
  const index = count(slide.index)
  if (index === null) return null
  // A slide kept as-is is neutral whatever its state says; `unlockable` is the same thing.
  const kind: TemplateDotKind = slide.kept_as_is === true || slide.state === 'unlockable' ? 'kept'
    : slide.state === 'locked' ? 'locked'
      : slide.state === 'analysed' ? 'analysed'
        // A finished job stops nothing for a slide still waiting or in flight (a paused lock): shown still, not as work in progress.
        : slide.state === 'analysing' && !terminal ? 'working' : 'queued'
  const words = { queued: 'waiting', working: 'being analysed', analysed: 'analysed', locked: 'ready', kept: 'kept as it is' }[kind]
  return { index, kind, label: `Slide ${index}: ${words}` }
}

export function templateProgressView(job: TemplateProgressJob): TemplateProgressView {
  const terminal = templateJobTerminal(job)
  const failed = job.status === 'failed' || job.status === 'cancelled'
  const progress = job.template_progress ?? null
  const detailed = progress !== null && typeof progress === 'object'
  const stalled = !terminal && job.poll?.stalled === true
  const asIs = progress?.as_is
  const asIsReady = job.capabilities?.use_original?.state === 'available' && asIs?.ready === true
  const slideCount = count(progress?.slide_count)
  const slidesDone = count(progress?.slides_done)
  const percent = slideCount && slidesDone !== null ? Math.min(100, Math.round(slidesDone / slideCount * 100)) : null
  const locking = progress?.locking
  const lockingNote = locking && (locking.state === 'paused' || locking.state === 'failed') ? text(locking.message) : null
  const newState = job.capabilities?.new_topic?.state
  const newTopic = newState === 'processing' || newState === 'available' || newState === 'unavailable' || newState === 'refused' ? newState : null
  const stage = detailed ? text(progress.stage) : null
  const slides = detailed && Array.isArray(progress.slides) ? progress.slides : []
  const dots = slides.map(slide => (slide && typeof slide === 'object' ? dotFor(slide, terminal) : null))
    .filter((dot): dot is TemplateProgressDot => dot !== null).sort((a, b) => a.index - b.index).slice(0, MAX_DOTS)
  const lockFailed = detailed && locking?.state === 'failed'
  const retry = terminal && (failed || (lockFailed && newTopic === 'unavailable' && job.capabilities?.new_topic?.retryable === true))
  const dismissible = terminal ? failed || (detailed && newTopic !== null && newTopic !== 'available') : stalled
  const newTopicLine = !detailed || newTopic === null || failed ? null
    : newTopic === 'processing' ? TEMPLATE_NEW_TOPIC_PROCESSING
      : newTopic === 'available' ? TEMPLATE_NEW_TOPIC_READY
        // Director's words for a paused or failed lock already say "Reuse as-is works now."; they are not repeated.
        : lockingNote ? null : unavailableWords(job.capabilities?.new_topic?.reason_code, asIsReady)
  return {
    terminal, failed,
    failure: failed ? text(job.errors?.join(' ')) : null,
    stalled, detailed,
    statusLine: detailed ? STAGE_WORDS[stage ?? ''] ?? `Preparing template: ${statusWords(job)}…`
      : job.status === 'complete' ? 'Template added to your library.' : `Preparing template: ${statusWords(job)}…`,
    stage, slideCount, slidesDone, percent,
    countLabel: slideCount !== null && slidesDone !== null ? `${slidesDone} of ${slideCount} slides done` : null,
    eta: terminal ? null : templateEtaWords(progress?.eta_s),
    dots, asIsReady,
    templateId: text(job.template_id),
    newTopic, newTopicLine, lockingNote, retry, dismissible,
  }
}

// ---- what the library does with the view -----------------------------------------------------------------------------------------------

export type TemplateRowAction = 'use' | 'ditto' | 'new-topic'

/**
 * Whether the library row of `templateId` has `action` held back by the job being tracked. Only the tracked job's own template is ever held.
 * "Use original" and "Rebuild" wait for the as-is template (`asIsReady`), unless the job is finished (a Composer without the flow completes
 * with no progress, and its template is as usable as it always was). "New topic" follows `newTopic` alone: a view with no new-topic state
 * (no `template_progress`) holds nothing, and no slide state (unlockable, kept as-is) is read.
 */
export function templateActionHeld(view: TemplateProgressView | null, templateId: string, action: TemplateRowAction): boolean {
  if (!view || view.templateId !== templateId) return false
  if (action === 'new-topic') return view.detailed && view.newTopic !== null && view.newTopic !== 'available'
  return !view.terminal && !view.asIsReady
}

/**
 * Whether the job being tracked holds the "Upload template" button: only a job that is moving. A job that failed or was cancelled, a stalled
 * one, one the watch gave up on, one whose answer cannot be read, and a finished one never do. No job yet read (just started): held.
 */
export function templateUploadHeld(tracked: boolean, view: TemplateProgressView | null, problem: boolean): boolean {
  if (!tracked || problem) return false
  return view === null || !(view.terminal || view.stalled)
}

export type TemplateToastKind = 'as_is' | 'new_topic'
export interface TemplateToast { kind: TemplateToastKind; title: string; description: string }

/**
 * The toasts to show for this view, given those already shown for this job (`shown`, kept with the stored job record so a reload never
 * repeats one), and the new `shown`. Each kind appears once per job. If new topics are ready in the same read in which the as-is template is
 * first seen (a finished job read after a return), only "Template ready for new topics" is shown and the as-is one is counted as shown.
 */
export function templateToastsDue(shown: readonly string[], view: TemplateProgressView): { toasts: TemplateToast[]; shown: string[] } {
  const next = [...shown]
  const toasts: TemplateToast[] = []
  const newTopicDue = view.detailed && view.newTopic === 'available' && !next.includes('new_topic')
  const asIsDue = view.asIsReady && !next.includes('as_is') && !next.includes('new_topic')
  if (newTopicDue) {
    toasts.push({ kind: 'new_topic', title: 'Template ready for new topics', description: 'You can start a deck on a new topic from this template.' })
    next.push('new_topic')
    if (!next.includes('as_is')) next.push('as_is')
  } else if (asIsDue) {
    toasts.push({ kind: 'as_is', title: 'Ready to use as-is', description: 'You can use the original now. Preparing for new topics continues.' })
    next.push('as_is')
  }
  return { toasts, shown: next }
}

// ---- the stored job (leave / return safe) ----------------------------------------------------------------------------------------------

/** What sessionStorage keeps for the job being tracked, under `templateProgressKey(userId)`: the id (to resume the poll), the file's name, the toasts shown. */
export interface TrackedTemplateJob { job_id: string; session_id: string; file_name: string; shown: string[] }

export const templateProgressKey = (userId: string | undefined | null): string => `deckster_composer_template_progress_${encodeURIComponent(userId || '')}`

/** A stored record, checked (sessionStorage is read back as untyped JSON); anything else is null. */
export function parseTrackedTemplateJob(raw: string | null | undefined): TrackedTemplateJob | null {
  let value: unknown
  try { value = JSON.parse(raw || 'null') } catch { return null }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const { job_id, session_id, file_name, shown } = value as Record<string, unknown>
  if (typeof job_id !== 'string' || !job_id || typeof session_id !== 'string' || !session_id) return null
  return {
    job_id, session_id, file_name: typeof file_name === 'string' ? file_name : '',
    shown: Array.isArray(shown) ? shown.filter((item): item is string => item === 'as_is' || item === 'new_topic') : [],
  }
}

// ---- the watch -------------------------------------------------------------------------------------------------------------------------

export interface TemplateWatchOptions {
  jobId: string
  signal: AbortSignal
  /** One read of the job (the dialog passes composerRequest on `jobs/{id}`). May throw; a thrown error's `status` (if any) is read. */
  read: (jobId: string, signal: AbortSignal) => Promise<TemplateProgressJob>
  onJob: (job: TemplateProgressJob) => void
  /** Called with a message when the watch cannot continue (an answer that cannot be read), and with null after a read that worked. */
  onProblem: (message: string | null) => void
  sleep: (ms: number, signal: AbortSignal) => Promise<void>
  now: () => number
  fallbackMs?: number
  limitMs?: number
}

/**
 * Reads the job until it ends, at the pace Director asks for. Returns why it stopped: 'terminal' (a finished job: `poll === null` or a
 * terminal status), 'aborted' (the signal), 'unreadable' (an answer that is not a service blip), or 'limit' (still running after
 * TEMPLATE_WATCH_LIMIT_MS). A 502, 503 or 504 (the Director proxy can blink during a replay) is retried up to three times in a row, as
 * waitForComposerJob does, so the same job is never abandoned for a blip.
 */
export async function watchTemplateJob(options: TemplateWatchOptions): Promise<'terminal' | 'aborted' | 'unreadable' | 'limit'> {
  const { jobId, signal, read, onJob, onProblem, sleep, now, fallbackMs = TEMPLATE_POLL_FALLBACK_MS, limitMs = TEMPLATE_WATCH_LIMIT_MS } = options
  const started = now()
  let blips = 0
  for (;;) {
    if (signal.aborted) return 'aborted'
    let job: TemplateProgressJob
    try {
      job = await read(jobId, signal)
      blips = 0
    } catch (reason) {
      if (signal.aborted) return 'aborted'
      const status = (reason as { status?: unknown } | null)?.status
      if (typeof status === 'number' && [502, 503, 504].includes(status) && ++blips <= 3) {
        try { await sleep(fallbackMs, signal) } catch { return 'aborted' }
        continue
      }
      onProblem(TEMPLATE_CANNOT_READ)
      return 'unreadable'
    }
    onProblem(null)
    if (signal.aborted) return 'aborted'
    try { onJob(job) } catch { /* a display error must not stop the poll */ }
    const wait = nextTemplatePollMs(job, fallbackMs)
    if (wait === null) return 'terminal'
    if (now() - started + wait > limitMs) return 'limit'
    try { await sleep(wait, signal) } catch { return 'aborted' }
  }
}
