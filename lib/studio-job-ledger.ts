/**
 * P3-4 slice C (flag NEXT_PUBLIC_STUDIO_JOB_LEDGER, exact "true", default off, build-time): Director's job ledger, shown in Studio.
 * Director (!527, DIRECTOR_JOB_LEDGER_ENABLED) sends one `job_update` frame per change of a job row, and carries the session's open and
 * recently ended rows in `sync_response.payload.jobs` (deckster-workspace streams/director2/job-ledger/CONTRACT.md). This module is pure
 * and import-free: which row is kept, which rows a card shows, the words on the card, and the Retry state machine. It sends nothing and
 * retries nothing by itself: a Retry is only ever the user's click, passed to the page's sender.
 */
export const STUDIO_JOB_LEDGER_ENABLED = process.env.NEXT_PUBLIC_STUDIO_JOB_LEDGER === 'true'
export const JOB_UPDATE_TYPE = 'job_update'
/** A Retry click with no reply comes back after this long. For some clicks no reply ever comes (a second click while the first retry is
 * still starting, an internal error, an unknown or foreign id, the Director flag off), and job_retry can wait behind a long build turn
 * (the session's message lock). A click after the timeout is safe: Director answers a repeat with the existing retry's row. */
export const JOB_RETRY_REPLY_TIMEOUT_MS = 15_000

export type JobLedgerState = 'queued' | 'running' | 'done' | 'failed' | 'timed_out' | 'cancelled'
export type JobLedgerKind = 'slide_compose' | 'slide_refine' | 'deck_build' | 'element_directive' | 'element_refine' | 'theme' | 'export'
export type JobFailureCode = 'deadline_exceeded' | 'service_unavailable' | 'lost_on_restart' | 'refused' | 'not_found' | 'cancelled_by_user'

/** One row, exactly as Director sends it (every key always present, in this order). */
export interface JobLedgerRow {
  job_id: string
  kind: JobLedgerKind | string
  state: JobLedgerState
  seq: number
  started_at: string
  updated_at: string
  deadline_at: string
  presentation_id: string | null
  slide_index: number | null
  failure: { code: JobFailureCode | string; retryable: boolean } | null
  retry: { via: 'frame' | 'client' | string; job_id: string } | null
  retry_of: string | null
}

/** Who a row came from: the socket's own session, and whether that socket is still the hook's current one. */
export interface JobLedgerOwner {
  sessionId: string
  isCurrent: () => boolean
}

const STATES: readonly string[] = ['queued', 'running', 'done', 'failed', 'timed_out', 'cancelled']
const TERMINAL: readonly string[] = ['done', 'failed', 'timed_out', 'cancelled']
/** Kinds whose job_id is the directive_id of the chat directive that runs it. */
const DIRECTIVE_KINDS: readonly string[] = ['element_directive', 'element_refine', 'theme', 'export']

export const isTerminalJobState = (state: string): boolean => TERMINAL.includes(state)

/** A job_update payload or one entry of sync_response.payload.jobs, passed on exactly as it came, when it has what the rules need. */
export function jobLedgerRow(value: unknown): JobLedgerRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (typeof row.job_id !== 'string' || !row.job_id || typeof row.kind !== 'string' || !row.kind) return null
  if (typeof row.seq !== 'number' || !Number.isInteger(row.seq) || row.seq < 1) return null
  if (typeof row.state !== 'string' || !STATES.includes(row.state)) return null
  return value as JobLedgerRow
}

/** sync_response.payload.jobs: its rows in order ([] is a valid "nothing open"), or null when the field is absent or not a list. */
export function jobLedgerRows(value: unknown): JobLedgerRow[] | null {
  if (!Array.isArray(value)) return null
  return value.map(jobLedgerRow).filter((row): row is JobLedgerRow => row !== null)
}

/** One session's ledger in this tab. Plain data; every function below returns a new ledger (or the same one when nothing changed). */
export interface JobLedger {
  /** The row with the highest seq per job_id. */
  rows: Readonly<Record<string, JobLedgerRow>>
  /** When each row last changed here (a counter), to order rows with the same updated_at. */
  touched: Readonly<Record<string, number>>
  tick: number
  /** Retry clicks waiting for a reply: the job_id that was sent, and the click's time (ms). */
  pending: Readonly<Record<string, number>>
  /** Rows the user dismissed in this tab. Nothing is sent for a Dismiss. */
  dismissed: Readonly<Record<string, true>>
}

export const EMPTY_JOB_LEDGER: JobLedger = Object.freeze({ rows: {}, touched: {}, tick: 0, pending: {}, dismissed: {} })

function withoutPending(ledger: JobLedger, ids: (string | null)[]): JobLedger {
  const hit = ids.filter((id): id is string => typeof id === 'string' && Object.prototype.hasOwnProperty.call(ledger.pending, id))
  if (!hit.length) return ledger
  const pending = { ...ledger.pending }
  for (const id of hit) delete pending[id]
  return { ...ledger, pending }
}

/** Keep the row with the highest seq: a frame whose seq is the same or lower is dropped, and a terminal row never changes again. */
function acceptRow(ledger: JobLedger, row: JobLedgerRow): JobLedger {
  const stored = ledger.rows[row.job_id]
  if (stored && (row.seq <= stored.seq || isTerminalJobState(stored.state))) return ledger
  const tick = ledger.tick + 1
  return { ...ledger, rows: { ...ledger.rows, [row.job_id]: row }, touched: { ...ledger.touched, [row.job_id]: tick }, tick }
}

/** A job_update frame. Any job_update for a job_id a Retry click waits on, or a row that retries it (retry_of), is that click's reply,
 * and re-enables Retry. That check runs BEFORE the seq rule: a refused job_retry comes back as the old row at the SAME seq, which the
 * seq rule then drops as not newer, and it must still end the wait. */
export function applyJobUpdate(ledger: JobLedger, row: JobLedgerRow): JobLedger {
  return acceptRow(withoutPending(ledger, [row.job_id, row.retry_of]), row)
}

/** sync_response.payload.jobs, merged by the same seq rule. [] means nothing is open: nothing is added, and nothing this tab holds is
 * erased (a sync never removes a row, and an older seq never replaces a newer one). A synced row that retries a waiting click
 * (retry_of) ends that wait; the old row coming back in a sync is not a reply. */
export function applyJobsSync(ledger: JobLedger, rows: readonly JobLedgerRow[]): JobLedger {
  return rows.reduce((next, row) => acceptRow(withoutPending(next, [row.retry_of]), row), ledger)
}

/** True when some row retries this one (retry_of). The old row itself never changes after a retry: it stays failed / timed out and
 * keeps its retry route, so its Retry is hidden by this link, whichever of the two rows arrived first (frame or sync). */
export function isJobRetried(ledger: JobLedger, jobId: string): boolean {
  return Object.values(ledger.rows).some(row => row.retry_of === jobId)
}

/** The rows a card is shown for: failed (a lost_on_restart failure included) and timed_out. Done, cancelled, queued and running show
 * nothing. */
export const isShownJobState = (state: string): boolean => state === 'failed' || state === 'timed_out'

/** Whether a row offers Studio's Retry button at all (before the in-flight and retried checks). Only the frame route, and only a
 * retryable failure. deck_build never offers it (Director refuses a deck_build retry; the build's own Resume control continues it).
 * A client-route row (retry.via "client") is Studio's own REST compose / refine: it gets the words but no new Retry button, because
 * the slide rail's card for that job already has its own retry, which repeats the REST call. */
export function offersFrameRetry(row: JobLedgerRow): boolean {
  return isShownJobState(row.state) && row.kind !== 'deck_build' && row.failure?.retryable === true
    && row.retry?.via === 'frame' && typeof row.retry.job_id === 'string' && row.retry.job_id !== ''
}

export type JobRetryState = 'none' | 'ready' | 'waiting'

/** 'none' (no Retry: not offered, or a newer row retries it, so the newest row of a retry chain is the one offering it), 'waiting'
 * (clicked, no reply yet, under JOB_RETRY_REPLY_TIMEOUT_MS: disabled) or 'ready'. */
export function jobRetryState(ledger: JobLedger, row: JobLedgerRow, now: number): JobRetryState {
  if (!offersFrameRetry(row) || isJobRetried(ledger, row.job_id)) return 'none'
  const clickedAt = ledger.pending[row.retry!.job_id]
  return clickedAt !== undefined && now - clickedAt < JOB_RETRY_REPLY_TIMEOUT_MS ? 'waiting' : 'ready'
}

/** The user clicked Retry on `jobId` at `now`. `send` is the job_id to put in job_retry (the row's retry.job_id), or null when nothing
 * may be sent: no such row, Retry not offered, or an earlier click still waiting (a double click never sends twice). */
export function startJobRetry(ledger: JobLedger, jobId: string, now: number): { ledger: JobLedger; send: string | null } {
  const row = ledger.rows[jobId]
  if (!row || jobRetryState(ledger, row, now) !== 'ready') return { ledger, send: null }
  const send = row.retry!.job_id
  return { ledger: { ...ledger, pending: { ...ledger.pending, [send]: now } }, send }
}

/** The send did not go out (the socket was closed): no reply can come, so the click stops waiting at once. */
export function cancelJobRetry(ledger: JobLedger, sentJobId: string): JobLedger {
  return withoutPending(ledger, [sentJobId])
}

/** Dismiss hides that row's card in this tab only. Nothing is sent. */
export function dismissJob(ledger: JobLedger, jobId: string): JobLedger {
  if (ledger.dismissed[jobId]) return ledger
  return { ...ledger, dismissed: { ...ledger.dismissed, [jobId]: true } }
}

/** When the next waiting Retry comes back on its own (ms), or null when none is waiting. */
export function nextJobRetryWakeAt(ledger: JobLedger, now: number): number | null {
  let next: number | null = null
  for (const clickedAt of Object.values(ledger.pending)) {
    const at = clickedAt + JOB_RETRY_REPLY_TIMEOUT_MS
    if (at > now && (next === null || at < next)) next = at
  }
  return next
}

/** Directive rows use the directive_id as job_id: the directive (element_directive, element_refine_directive, theme_directive or
 * export_directive) a row ran, or null for compose, refine and build rows. */
export function jobDirectiveId(row: JobLedgerRow): string | null {
  return DIRECTIVE_KINDS.includes(row.kind) ? row.job_id : null
}

/** The row of the directive with this directive_id, or null: the join the page uses to link a directive to its job. */
export function jobRowForDirective(ledger: JobLedger, directiveId: string): JobLedgerRow | null {
  const row = directiveId ? ledger.rows[directiveId] : undefined
  return row && jobDirectiveId(row) === directiveId ? row : null
}

/** Studio's own words for a job (never Director's or a service's error text). */
export function jobSubject(row: JobLedgerRow): string {
  const slide = typeof row.slide_index === 'number' && Number.isInteger(row.slide_index) && row.slide_index >= 0 ? row.slide_index + 1 : null
  switch (row.kind) {
    case 'slide_compose': return 'Adding a slide'
    case 'slide_refine': return slide ? `Refining slide ${slide}` : 'Refining a slide'
    case 'element_directive': return slide ? `Adding an element to slide ${slide}` : 'Adding an element'
    case 'element_refine': return slide ? `Refining an element on slide ${slide}` : 'Refining an element'
    case 'theme': return 'Changing the theme'
    case 'export': return 'The export'
    case 'deck_build': return 'The build'
    default: return 'This step'
  }
}

/** The card's title and line for a row, from its kind and failure.code (the closed list; anything else reads as "didn't finish"). */
export function jobLedgerCopy(row: JobLedgerRow): { title: string; body: string } {
  const subject = jobSubject(row)
  const slide = typeof row.slide_index === 'number' && Number.isInteger(row.slide_index) && row.slide_index >= 0 ? row.slide_index + 1 : null
  switch (row.failure?.code) {
    case 'deadline_exceeded':
      if (row.kind === 'deck_build') return { title: "The build hasn't made progress for a while", body: 'It may still pick up. If it has stopped, use Resume to continue it.' }
      return { title: `${subject} ran out of time`, body: `It may still have gone through. Check ${slide ? `slide ${slide}` : 'the deck'} before you try again.` }
    case 'service_unavailable':
      return { title: `${subject} didn't finish`, body: 'Something it relies on had a problem.' }
    case 'lost_on_restart':
      return { title: `${subject} was interrupted`, body: 'Deckster restarted while it was running, so it may not have finished.' }
    case 'refused':
      return { title: `${subject} wasn't accepted`, body: 'Nothing was changed.' }
    case 'not_found':
      return { title: `${subject} couldn't go ahead`, body: "What it was meant to change isn't there any more." }
    case 'cancelled_by_user':
      return { title: `${subject} was stopped`, body: 'It was stopped on request, so nothing more will happen.' }
    default:
      return { title: `${subject} didn't finish`, body: '' }
  }
}

export interface JobLedgerCard {
  jobId: string
  kind: string
  state: JobLedgerState
  title: string
  body: string
  retry: JobRetryState
  directiveId: string | null
}

/** The cards to show, newest first (updated_at, then the order the rows changed here). Dismissed rows are left out. */
export function jobLedgerCards(ledger: JobLedger, now: number): JobLedgerCard[] {
  return Object.values(ledger.rows)
    .filter(row => isShownJobState(row.state) && !ledger.dismissed[row.job_id])
    .sort((a, b) => (a.updated_at === b.updated_at ? 0 : a.updated_at < b.updated_at ? 1 : -1) || (ledger.touched[b.job_id] ?? 0) - (ledger.touched[a.job_id] ?? 0))
    .map(row => ({ jobId: row.job_id, kind: row.kind, state: row.state, ...jobLedgerCopy(row), retry: jobRetryState(ledger, row, now), directiveId: jobDirectiveId(row) }))
}

export interface JobLedgerStore {
  /** The socket hook's intake (UseDecksterWebSocketV2Options.onJobUpdate / onJobsSync). */
  onJobUpdate: (row: JobLedgerRow, owner: Pick<JobLedgerOwner, 'sessionId'>) => void
  onJobsSync: (rows: JobLedgerRow[], owner: Pick<JobLedgerOwner, 'sessionId'>) => void
  /** A Retry click. Sends through `send` (job_retry) at most once until a reply or the timeout; true when it was sent. */
  retry: (sessionId: string, jobId: string, send: (jobId: string) => boolean) => boolean
  dismiss: (sessionId: string, jobId: string) => void
  ledger: (sessionId: string) => JobLedger
  version: () => number
  subscribe: (listener: () => void) => () => void
}

/** The ledgers of one tab, one per Director session. Rows are kept per session, and a card list reads only its own session's. */
export function createJobLedgerStore(now: () => number = () => Date.now()): JobLedgerStore {
  let ledgers: Record<string, JobLedger> = {}
  let version = 0
  const listeners = new Set<() => void>()
  const ledger = (sessionId: string) => ledgers[sessionId] ?? EMPTY_JOB_LEDGER
  const set = (sessionId: string, next: JobLedger) => {
    if (!sessionId || next === ledger(sessionId)) return
    ledgers = { ...ledgers, [sessionId]: next }
    version++
    for (const listener of [...listeners]) listener()
  }
  return {
    onJobUpdate: (row, owner) => set(owner.sessionId, applyJobUpdate(ledger(owner.sessionId), row)),
    onJobsSync: (rows, owner) => set(owner.sessionId, applyJobsSync(ledger(owner.sessionId), rows)),
    retry(sessionId, jobId, send) {
      const started = startJobRetry(ledger(sessionId), jobId, now())
      if (started.send === null) return false
      set(sessionId, started.ledger)
      if (send(started.send)) return true
      set(sessionId, cancelJobRetry(ledger(sessionId), started.send))
      return false
    },
    dismiss: (sessionId, jobId) => set(sessionId, dismissJob(ledger(sessionId), jobId)),
    ledger,
    version: () => version,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
