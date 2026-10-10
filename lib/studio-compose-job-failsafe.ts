// J2-SILENT-FAIL (flag NEXT_PUBLIC_STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED, exact "true"; default off): an async
// slide-compose job (Add slide side panel and the Slide panel) can no longer vanish without a word.
//
// What went wrong (RUN-J2V2, Chart and Table rows): the page keeps compose jobs in React state only, and only a
// slide_ready / slide_failed frame (or the durable-status poller finding "error") ever ends a job. A job whose
// Director or Slide Builder leg was lost stayed "building" forever (the 8 minute watchdog only reloads the viewer and
// looks for the slide), and a reload dropped the job and its placeholder with no trace.
//
// Behaviour with the flag on:
//   1. A job with no outcome and no sign of life for a bounded time becomes an ERROR card in place of the
//      placeholder, in plain words, with Retry and Dismiss. At the deadline the existing job-status route is asked
//      once; the answer picks the wording (a job the Director has never heard of is "lost").
//   2. The minimal job record (including the request, so the prompt) is kept in sessionStorage per session + deck. A
//      reload re-checks each record once and shows it as pending, as the error, or not at all (the slide landed).
//   3. Retry is the page's existing retry (it re-sends the stored request); Dismiss removes the card and the record.
//
// Everything the page owns is injected, so a node test can drive the controller with fakes and a fake clock.
import { buildSlideComposeJobStatusPath, normalizeSlideComposeJobRecoveryResult } from '@/lib/slide-compose-job-recovery'

// Literal property access so Next inlines the value into the client bundle.
export const STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED === 'true'

// Bounded time. The Director runs same-deck composes one after another and a Slide Builder pass takes 1 to 2 minutes
// (longer with research), so a job waiting its turn gets 3 extra minutes per pending job ahead of it. Any new
// information about a job (a progress frame, a recovered slide id) restarts its clock. The hard cap counts from
// acceptance whatever else happens.
export const COMPOSE_JOB_FAILSAFE_BASE_MS = 300_000
export const COMPOSE_JOB_FAILSAFE_PER_JOB_AHEAD_MS = 180_000
export const COMPOSE_JOB_FAILSAFE_MAX_MS = 1_500_000
// The Director says "built" but the slide never showed up here: one short grace for the poller / socket, then an error.
export const COMPOSE_JOB_FAILSAFE_BUILT_GRACE_MS = 90_000
export const COMPOSE_JOB_RECORD_LIMIT = 12

// Plain words. `...MESSAGE` is the full sentence (stored as the job's first error, shown in the toast and the failure
// details); `...CAPTION` is the short line that fits under the 112 px rail card.
export const COMPOSE_JOB_TIMEOUT_MESSAGE = "This slide is taking much longer than expected. It may still show up; if it doesn't, retry it."
export const COMPOSE_JOB_LOST_MESSAGE = "We lost track of this slide, so it won't finish by itself. Retry to build it again."
export const COMPOSE_JOB_NOT_SHOWN_MESSAGE = "This slide finished but didn't appear here. Reload the page to see it, or retry."
export const COMPOSE_JOB_GENERIC_MESSAGE = "This slide couldn't be built. Retry to try again."
export const COMPOSE_JOB_TIMEOUT_CAPTION = 'Taking too long. Retry or dismiss.'
export const COMPOSE_JOB_LOST_CAPTION = 'Lost track of this slide.'
export const COMPOSE_JOB_NOT_SHOWN_CAPTION = 'Finished but not shown. Reload.'
export const COMPOSE_JOB_GENERIC_CAPTION = "Couldn't build this slide."
export const COMPOSE_JOB_FAILSAFE_TOAST_TITLE = "Slide didn't finish"

const CAPTION_BY_MESSAGE: Record<string, string> = {
  [COMPOSE_JOB_TIMEOUT_MESSAGE]: COMPOSE_JOB_TIMEOUT_CAPTION,
  [COMPOSE_JOB_LOST_MESSAGE]: COMPOSE_JOB_LOST_CAPTION,
  [COMPOSE_JOB_NOT_SHOWN_MESSAGE]: COMPOSE_JOB_NOT_SHOWN_CAPTION,
}

export interface ComposeFailsafeJob {
  job_id: string
  kind?: 'compose' | 'refine'
  target_visual_index: number
  target_layout_index: number
  target_slide_id?: string | null
  status: 'building' | 'error'
  title: string
  request: Record<string, unknown>
  target_presentation_id?: string | null
  real_slide_id?: string | null
  expected_slide_count?: number | null
  lastProgressText?: string
  errors?: string[]
}

/** The short line for an error card: this module's own wording when it wrote the error, else a generic one. */
export function composeJobFailureCaption(job: Pick<ComposeFailsafeJob, 'errors'>): string {
  const first = job.errors?.find(Boolean)
  return (first && CAPTION_BY_MESSAGE[first]) || COMPOSE_JOB_GENERIC_CAPTION
}

export interface ComposeFailsafeCard {
  jobId: string
  kind?: 'compose' | 'refine'
  status: 'building' | 'error'
  failureCaption?: string
  onDismiss?: (jobId: string) => void
}

/** Adds the plain caption and Dismiss to an error compose card. Anything else is returned untouched (same object). */
export function decorateComposeJobCard<TCard extends ComposeFailsafeCard>(
  card: TCard,
  job: Pick<ComposeFailsafeJob, 'errors'> | undefined,
  options: { enabled: boolean; onDismiss: (jobId: string) => void },
): TCard {
  if (!options.enabled || card.kind === 'refine' || card.status !== 'error') return card
  return { ...card, failureCaption: composeJobFailureCaption(job ?? {}), onDismiss: options.onDismiss }
}

export function composeJobFailsafeWindowMs(pendingAhead: number): number {
  const ahead = Math.max(0, Math.floor(pendingAhead) || 0)
  return Math.min(COMPOSE_JOB_FAILSAFE_BASE_MS + ahead * COMPOSE_JOB_FAILSAFE_PER_JOB_AHEAD_MS, COMPOSE_JOB_FAILSAFE_MAX_MS)
}

// ---- Storage ----------------------------------------------------------------------------------------------------
export interface ComposeJobStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function composeJobFailsafeKey(sessionId: string | null, presentationId: string | null): string {
  return `deckster.composeJobFailsafe.v1:${sessionId ?? 'no-session'}:${presentationId ?? 'no-deck'}`
}

export interface ComposeJobRecord {
  v: 1
  job_id: string
  status: 'building' | 'error'
  title: string
  accepted_at: number
  target_layout_index: number
  target_visual_index: number
  target_presentation_id: string | null
  request: Record<string, unknown>
  errors?: string[]
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseRecord(value: unknown): ComposeJobRecord | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const request = raw.request
  if (raw.v !== 1 || typeof raw.job_id !== 'string' || !raw.job_id) return null
  if (raw.status !== 'building' && raw.status !== 'error') return null
  if (!request || typeof request !== 'object' || Array.isArray(request)) return null
  if (typeof (request as Record<string, unknown>).session_id !== 'string') return null
  if (!finite(raw.accepted_at) || !finite(raw.target_layout_index) || !finite(raw.target_visual_index)) return null
  return {
    v: 1,
    job_id: raw.job_id,
    status: raw.status,
    title: typeof raw.title === 'string' ? raw.title : 'Composing slide',
    accepted_at: raw.accepted_at,
    target_layout_index: Math.max(0, raw.target_layout_index),
    target_visual_index: Math.max(0, raw.target_visual_index),
    target_presentation_id: typeof raw.target_presentation_id === 'string' ? raw.target_presentation_id : null,
    request: request as Record<string, unknown>,
    ...(Array.isArray(raw.errors) ? { errors: raw.errors.map(String).filter(Boolean) } : {}),
  }
}

export function readComposeJobRecords(storage: ComposeJobStorage | null, key: string): ComposeJobRecord[] {
  try {
    const raw = storage?.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const records: ComposeJobRecord[] = []
    for (const item of parsed) {
      const record = parseRecord(item)
      if (!record || seen.has(record.job_id)) continue
      seen.add(record.job_id)
      records.push(record)
    }
    return records
  } catch {
    return []
  }
}

export function writeComposeJobRecords(storage: ComposeJobStorage | null, key: string, records: ComposeJobRecord[]): void {
  try {
    if (!storage) return
    if (records.length === 0) { storage.removeItem(key); return }
    const kept = [...records].sort((a, b) => a.accepted_at - b.accepted_at || a.job_id.localeCompare(b.job_id))
      .slice(-COMPOSE_JOB_RECORD_LIMIT)
    storage.setItem(key, JSON.stringify(kept))
  } catch { /* storage unavailable or full: the failsafe still runs, the reload just cannot restore */ }
}

// ---- The job-status re-check ------------------------------------------------------------------------------------
export type ComposeJobRecheck =
  | { kind: 'built' }
  | { kind: 'building' }
  | { kind: 'error'; errors: string[] }
  | { kind: 'missing' }
  | { kind: 'unreachable' }

/** One answer of GET /api/slides/jobs/{id} (the Director's durable job record) as a decision input. */
export function classifyComposeJobRecheck(status: number, body: unknown, jobId: string): ComposeJobRecheck {
  if (status === 404) return { kind: 'missing' }
  if (status < 200 || status >= 300) return { kind: 'unreachable' }
  const result = normalizeSlideComposeJobRecoveryResult(body)
  if (!result || result.job_id !== jobId) return { kind: 'unreachable' }
  if (result.status === 'built') return { kind: 'built' }
  if (result.status === 'building') return { kind: 'building' }
  return { kind: 'error', errors: result.errors.length > 0 ? result.errors : [COMPOSE_JOB_GENERIC_MESSAGE] }
}

// ---- Placeholder positions ---------------------------------------------------------------------------------------
/** Visual slot of each pending or failed compose job: its Layout target plus the jobs placed before it (the rail's order). */
export function composePlaceholderVisualIndexes(entries: Array<{ id: string; target: number; order: number }>): Map<string, number> {
  const sorted = [...entries].sort((a, b) => a.target - b.target || a.order - b.order || a.id.localeCompare(b.id))
  return new Map(sorted.map((entry, rank) => [entry.id, Math.max(0, entry.target) + rank]))
}

// ---- The controller ---------------------------------------------------------------------------------------------
export interface ComposeFailsafeViewerApi {
  composePlaceholderAdd: (jobId: string, visualIndex: number) => Promise<unknown>
  composePlaceholderFail: (jobId: string) => Promise<unknown>
}

export interface ComposeJobFailsafeDeps<TJob extends ComposeFailsafeJob> {
  sessionId: string
  presentationId: string
  storage: ComposeJobStorage | null
  now: () => number
  setTimer: (callback: () => void, ms: number) => unknown
  clearTimer: (handle: unknown) => void
  fetchJson: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>
  getJobs: () => Record<string, TJob>
  setJobs: (update: (previous: Record<string, TJob>) => Record<string, TJob>) => void
  /** The page's captureStudioSlideComposeOwner: call BEFORE an await, the result says "still the same owner". */
  captureOwner: () => () => boolean
  getViewerApi: () => ComposeFailsafeViewerApi | null
  /** Start the existing durable-status poller for a restored pending job. */
  armJob: (job: TJob) => void
  /** Stop the existing poller and watchdog of a job that failed or was dismissed. */
  disarmJob: (jobId: string) => void
  onFailed: (job: TJob, message: string) => void
  /** The viewer still shows the dismissed job's placeholder; the page reloads it. `visualIndex` is where it sat. */
  onDismissed: (job: TJob, visualIndex: number) => void
}

interface Tracked {
  acceptedAt: number
  lastLifeAt: number
  windowMs: number
  progress: string | undefined
  realSlideId: string | null | undefined
  timer: unknown
  builtGraceUsed: boolean
}

const RESTORE_CONCURRENCY = 4
const KNOWN_OUTCOME_MAX_AGE_MS = 10_000
const MAX_PLACEHOLDER_ATTEMPTS = 8

export interface ComposeJobFailsafeController<TJob extends ComposeFailsafeJob> {
  /** Call with the page's job map after every change (a React effect). */
  sync(jobs: Record<string, TJob>): void
  /** Re-check the records kept for this session + deck once and put what is still alive back on screen. */
  restore(): Promise<void>
  /** Call on a timer with the page's current viewer API; re-adds in-deck placeholders after a viewer (re)load. */
  onViewerApi(api: ComposeFailsafeViewerApi | null): Promise<void>
  dismiss(jobId: string): void
  dispose(): void
}

export function createComposeJobFailsafe<TJob extends ComposeFailsafeJob>(
  deps: ComposeJobFailsafeDeps<TJob>,
): ComposeJobFailsafeController<TJob> {
  const key = composeJobFailsafeKey(deps.sessionId, deps.presentationId)
  const tracked = new Map<string, Tracked>()
  const restoredAcceptedAt = new Map<string, number>()
  const knownOutcomes = new Map<string, { outcome: ComposeJobRecheck; at: number }>()
  // Jobs whose in-deck placeholder may be missing from the viewer (restored, or the viewer reloaded around them).
  const debt = new Set<string>()
  let disposed = false
  let lastApi: ComposeFailsafeViewerApi | null = null
  let apiDirty = false
  let apiRunning = false
  let apiAttempts = 0

  // This deck's compose jobs. The session is not compared: the Slide panel may name the deck owner's session in the request.
  const inScope = (job: TJob) =>
    (job.kind ?? 'compose') !== 'refine'
    && (job.status === 'building' || job.status === 'error')
    && (job.target_presentation_id == null || job.target_presentation_id === deps.presentationId)

  const liveJobs = (jobs: Record<string, TJob>) => Object.values(jobs).filter(inScope)

  function removeRecord(jobId: string) {
    const records = readComposeJobRecords(deps.storage, key)
    const next = records.filter(record => record.job_id !== jobId)
    if (next.length !== records.length) writeComposeJobRecords(deps.storage, key, next)
  }

  function forget(jobId: string) {
    const entry = tracked.get(jobId)
    if (entry?.timer != null) deps.clearTimer(entry.timer)
    tracked.delete(jobId)
    restoredAcceptedAt.delete(jobId)
    knownOutcomes.delete(jobId)
    debt.delete(jobId)
    removeRecord(jobId)
  }

  function visualIndexes(jobs: TJob[]): Map<string, number> {
    return composePlaceholderVisualIndexes(jobs.map((job, position) => ({
      id: job.job_id,
      target: job.target_layout_index,
      order: tracked.get(job.job_id)?.acceptedAt ?? restoredAcceptedAt.get(job.job_id) ?? position,
    })))
  }

  function recordOf(job: TJob, acceptedAt: number): ComposeJobRecord {
    return {
      v: 1,
      job_id: job.job_id,
      status: job.status,
      title: job.title,
      accepted_at: acceptedAt,
      target_layout_index: job.target_layout_index,
      target_visual_index: job.target_visual_index,
      target_presentation_id: job.target_presentation_id ?? null,
      request: job.request,
      ...(job.status === 'error' && job.errors?.length ? { errors: job.errors } : {}),
    }
  }

  function schedule(jobId: string) {
    const entry = tracked.get(jobId)
    if (!entry || disposed) return
    if (entry.timer != null) deps.clearTimer(entry.timer)
    const dueAt = Math.min(entry.lastLifeAt + entry.windowMs, entry.acceptedAt + COMPOSE_JOB_FAILSAFE_MAX_MS)
    entry.timer = deps.setTimer(() => { entry.timer = null; void onDeadline(jobId) }, Math.max(0, dueAt - deps.now()))
  }

  async function recheck(sessionId: string, presentationId: string | null, jobId: string): Promise<ComposeJobRecheck> {
    try {
      const response = await deps.fetchJson(buildSlideComposeJobStatusPath({ jobId, sessionId, presentationId }))
      const body = response.status === 404 || !response.ok ? null : await response.json().catch(() => null)
      return classifyComposeJobRecheck(response.status, body, jobId)
    } catch {
      return { kind: 'unreachable' }
    }
  }

  function fail(job: TJob, errors: string[]) {
    deps.disarmJob(job.job_id)
    deps.setJobs(previous => {
      const current = previous[job.job_id]
      if (!current || current.status !== 'building') return previous
      return { ...previous, [job.job_id]: { ...current, status: 'error', errors } }
    })
    const api = deps.getViewerApi()
    if (api) void Promise.resolve(api.composePlaceholderFail(job.job_id)).catch(() => undefined)
    deps.onFailed(job, errors[0])
  }

  async function onDeadline(jobId: string) {
    const entry = tracked.get(jobId)
    const job = deps.getJobs()[jobId]
    if (disposed || !entry || !job || job.status !== 'building') return
    const isOwner = deps.captureOwner()
    const lifeAtStart = entry.lastLifeAt
    const known = knownOutcomes.get(jobId)
    knownOutcomes.delete(jobId)
    // The re-check at restore time is the one re-check; do not ask the same question again straight away.
    const outcome = known && deps.now() - known.at <= KNOWN_OUTCOME_MAX_AGE_MS
      ? known.outcome
      : await recheck(String(job.request.session_id ?? deps.sessionId), job.target_presentation_id ?? deps.presentationId, jobId)
    const latest = deps.getJobs()[jobId]
    if (disposed || !isOwner() || !latest || latest.status !== 'building' || tracked.get(jobId) !== entry) return
    // News arrived while we asked: the clock restarted, so this is not the deadline any more.
    if (entry.lastLifeAt !== lifeAtStart) { schedule(jobId); return }
    if (outcome.kind === 'built') {
      if (!entry.builtGraceUsed) {
        entry.builtGraceUsed = true
        entry.lastLifeAt = deps.now()
        entry.windowMs = COMPOSE_JOB_FAILSAFE_BUILT_GRACE_MS
        schedule(jobId)
        return
      }
      fail(latest, [COMPOSE_JOB_NOT_SHOWN_MESSAGE])
      return
    }
    if (outcome.kind === 'error') { fail(latest, outcome.errors); return }
    fail(latest, [outcome.kind === 'missing' ? COMPOSE_JOB_LOST_MESSAGE : COMPOSE_JOB_TIMEOUT_MESSAGE])
  }

  function sync(jobs: Record<string, TJob>) {
    if (disposed) return
    const now = deps.now()
    const live = liveJobs(jobs)
    const stored = new Map(readComposeJobRecords(deps.storage, key).map(record => [record.job_id, record]))
    // A job this controller did not accept (restored, or accepted before a new owner started this controller) keeps its stored acceptance time.
    const acceptedAtOf = (jobId: string) => restoredAcceptedAt.get(jobId) ?? stored.get(jobId)?.accepted_at ?? now
    const fresh = live.filter(job => !tracked.has(job.job_id))
      .sort((a, b) => acceptedAtOf(a.job_id) - acceptedAtOf(b.job_id) || a.job_id.localeCompare(b.job_id))
    for (const job of fresh) {
      const restored = restoredAcceptedAt.has(job.job_id)
      const acceptedAt = acceptedAtOf(job.job_id)
      const pendingAhead = live.filter(other => other.job_id !== job.job_id && other.status === 'building' && tracked.has(other.job_id)).length
      tracked.set(job.job_id, {
        acceptedAt,
        lastLifeAt: restored ? acceptedAt : now,
        windowMs: composeJobFailsafeWindowMs(pendingAhead),
        progress: job.lastProgressText,
        realSlideId: job.real_slide_id,
        timer: null,
        builtGraceUsed: false,
      })
      if (job.status === 'building') schedule(job.job_id)
    }
    for (const job of live) {
      const entry = tracked.get(job.job_id)
      if (!entry) continue
      if (job.status === 'error') {
        // The failsafe's job is done: a failed job keeps its card until Retry or Dismiss.
        if (entry.timer != null) { deps.clearTimer(entry.timer); entry.timer = null }
        continue
      }
      if (job.lastProgressText !== entry.progress || job.real_slide_id !== entry.realSlideId) {
        entry.progress = job.lastProgressText
        entry.realSlideId = job.real_slide_id
        entry.lastLifeAt = now
        schedule(job.job_id)
      }
    }
    // Gone from the page state (slide ready, retried under a new id, dismissed, cleared): nothing left to guard or keep.
    for (const jobId of [...tracked.keys()]) {
      if (!jobs[jobId]) forget(jobId)
    }
    // Keep the record of every live job current. Records of jobs not on screen yet (a restore in flight) stay as they are.
    const persisted = new Map(readComposeJobRecords(deps.storage, key).map(record => [record.job_id, record]))
    let changed = false
    for (const job of live) {
      const entry = tracked.get(job.job_id)
      if (!entry) continue
      const next = recordOf(job, entry.acceptedAt)
      if (JSON.stringify(persisted.get(job.job_id)) !== JSON.stringify(next)) { persisted.set(job.job_id, next); changed = true }
    }
    if (changed) writeComposeJobRecords(deps.storage, key, [...persisted.values()])
  }

  async function restore() {
    if (disposed || !deps.storage) return
    const isOwner = deps.captureOwner()
    const onScreen = deps.getJobs()
    const records = readComposeJobRecords(deps.storage, key).filter(record => !onScreen[record.job_id])
    if (records.length === 0) return
    const outcomes = new Map<string, ComposeJobRecheck>()
    for (let start = 0; start < records.length; start += RESTORE_CONCURRENCY) {
      await Promise.all(records.slice(start, start + RESTORE_CONCURRENCY).map(async record => {
        outcomes.set(record.job_id, await recheck(String(record.request.session_id), record.target_presentation_id ?? deps.presentationId, record.job_id))
      }))
    }
    if (disposed || !isOwner()) return
    const now = deps.now()
    const restored: TJob[] = []
    for (const record of [...records].sort((a, b) => a.accepted_at - b.accepted_at || a.job_id.localeCompare(b.job_id))) {
      const outcome = outcomes.get(record.job_id) ?? { kind: 'unreachable' as const }
      if (outcome.kind === 'built') { removeRecord(record.job_id); continue } // the slide landed while the page was away
      let status: 'building' | 'error' = record.status
      let errors: string[] | undefined = record.errors
      if (record.status === 'building') {
        if (outcome.kind === 'error') { status = 'error'; errors = outcome.errors }
        else if (outcome.kind === 'missing') { status = 'error'; errors = [COMPOSE_JOB_LOST_MESSAGE] }
      }
      if (status === 'error' && !errors?.length) errors = [COMPOSE_JOB_GENERIC_MESSAGE]
      restoredAcceptedAt.set(record.job_id, record.accepted_at)
      if (status === 'building') knownOutcomes.set(record.job_id, { outcome, at: now })
      restored.push({
        job_id: record.job_id,
        kind: 'compose',
        target_visual_index: record.target_visual_index,
        target_layout_index: record.target_layout_index,
        target_slide_id: null,
        status,
        title: record.title,
        request: record.request,
        target_presentation_id: record.target_presentation_id ?? deps.presentationId,
        // Never confirmed by a slide COUNT measured before the reload; the durable status / slide id decides.
        expected_slide_count: Number.MAX_SAFE_INTEGER,
        ...(errors ? { errors } : {}),
      } as TJob)
    }
    if (restored.length === 0) return
    const ranks = visualIndexes([...liveJobs(onScreen), ...restored])
    deps.setJobs(previous => {
      const next = { ...previous }
      for (const job of restored) {
        if (!next[job.job_id]) next[job.job_id] = { ...job, target_visual_index: ranks.get(job.job_id) ?? job.target_visual_index }
      }
      return next
    })
    for (const job of restored) {
      debt.add(job.job_id)
      if (job.status === 'building') deps.armJob(job)
    }
    apiDirty = true
  }

  async function runPlaceholders(api: ComposeFailsafeViewerApi): Promise<boolean> {
    const isOwner = deps.captureOwner()
    const jobs = deps.getJobs()
    const ranks = visualIndexes(liveJobs(jobs))
    const ids = [...debt].filter(id => jobs[id] && inScope(jobs[id])).sort((a, b) => (ranks.get(a) ?? 0) - (ranks.get(b) ?? 0))
    let ok = true
    for (const id of ids) {
      if (disposed || !isOwner() || deps.getViewerApi() !== api) return false
      try {
        await api.composePlaceholderAdd(id, ranks.get(id) ?? 0)
        if (deps.getJobs()[id]?.status === 'error') await api.composePlaceholderFail(id)
      } catch {
        ok = false
      }
    }
    return ok
  }

  async function onViewerApi(api: ComposeFailsafeViewerApi | null) {
    if (disposed) return
    if (!api) { lastApi = null; return }
    if (api !== lastApi) { lastApi = api; apiDirty = true; apiAttempts = 0 }
    if (!apiDirty || apiRunning) return
    apiDirty = false
    apiRunning = true
    let ok = true
    try { ok = await runPlaceholders(api) } finally { apiRunning = false }
    if (!ok && ++apiAttempts < MAX_PLACEHOLDER_ATTEMPTS) apiDirty = true
  }

  function dismiss(jobId: string) {
    const job = deps.getJobs()[jobId]
    if (disposed || !job || job.status !== 'error') return
    const scoped = inScope(job)
    const visualIndex = visualIndexes(liveJobs(deps.getJobs())).get(jobId) ?? job.target_visual_index
    deps.disarmJob(jobId)
    deps.setJobs(previous => {
      if (!previous[jobId]) return previous
      const { [jobId]: _dismissed, ...rest } = previous
      return rest as Record<string, TJob>
    })
    forget(jobId)
    if (!scoped) return
    // The viewer reload drops every in-deck placeholder, so the others have to be put back afterwards.
    for (const other of liveJobs(deps.getJobs())) if (other.job_id !== jobId) debt.add(other.job_id)
    deps.onDismissed(job, visualIndex)
  }

  function dispose() {
    disposed = true
    for (const entry of tracked.values()) if (entry.timer != null) deps.clearTimer(entry.timer)
    tracked.clear()
    debt.clear()
  }

  return { sync, restore, onViewerApi, dismiss, dispose }
}
