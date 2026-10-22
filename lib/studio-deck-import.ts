// STUDIO DECK IMPORT, "Import a PowerPoint as an editable deck" (FRONTEND-2, Pass 3; flag NEXT_PUBLIC_STUDIO_DECK_IMPORT, exact "true", default off, read at build time).
// The pure rules of the feature: the local file check, the one start request, how the proxy reads a start body, the plain words for every refusal, and how a polled Director job
// (GET /api/template-ingest/stage/jobs/{id}, its `deck_import` block) becomes what the dialog shows. Contract: streams/director2/deck-import/CONTRACT.md (Director !518,
// DIRECTOR_DECK_IMPORT_ENABLED), with 17 responses recorded from Director's real code. Nothing here reads the environment, a secret, the network or the DOM.
//
// Flow (no WebSocket frame): the browser uploads the file to Researcher storage (storageOnly), asks the proxy to start the import (Director class W), polls the proxy
// (Director class R), and on `ready` stages the result like a "Use original" result and opens /builder?session_id=...
import { TEMPLATE_POLL_MAX_MS, TEMPLATE_POLL_MIN_MS, TEMPLATE_WATCH_LIMIT_MS, templateEtaWords } from './studio-template-progress'

/** On only with the exact string "true" AND the Studio shell (the dialog is drawn in the Studio palette). Every other value is off. */
export function studioDeckImportOn(flag: string | undefined | null, shell: string | undefined | null): boolean {
  return flag === 'true' && shell === 'true'
}

/** Studio's own proxy routes. Both answer 404 unless the flag is exactly "true" in the server's build. */
export const DECK_IMPORT_START_ENDPOINT = '/api/studio-deck-import'
export const deckImportJobEndpoint = (jobId: string): string => `/api/studio-deck-import/jobs/${encodeURIComponent(jobId)}`

/** Director's import jobs are named `stage-import-<uuid>`. The poll route reads these and no other stage job. */
export const DECK_IMPORT_JOB_PREFIX = 'stage-import-'
export const DECK_IMPORT_MAX_BYTES = 100 * 1024 * 1024
/** Used when Director sends no `poll.next_interval_ms` (the contract: 3 s). */
export const DECK_IMPORT_POLL_FALLBACK_MS = 3000
/** The most a start body may weigh at the proxy (five short strings). */
export const DECK_IMPORT_START_MAX_BYTES = 8192
/** After this long without a finished job the dialog stops watching and says so (Director's own job deadline is 60 minutes). */
export const DECK_IMPORT_WATCH_LIMIT_MS = TEMPLATE_WATCH_LIMIT_MS
/** Transient proxy failures (502/503/504, a dropped connection) tolerated in a row while polling the same job. */
export const DECK_IMPORT_POLL_RETRIES = 3

// ---- words (Director's sentences are the contract's own and are shown as they are; the rest are Studio's) ------------------------------------------------------
export const DECK_IMPORT_WORDS = {
  FILE_IS_PDF: 'Import the PowerPoint this PDF came from. PDF import is coming.',
  FILE_NOT_PPTX: 'Only PowerPoint (.pptx) files can be imported. Save the file as .pptx and try again.',
  FILE_EMPTY: 'This file is empty. Choose a PowerPoint (.pptx) file.',
  UPLOAD_FILE_TOO_LARGE: 'This file is too large to import. Files up to 100 MB can be imported.',
  IMPORT_UNAVAILABLE: 'Deck import is not available right now.',
  SIGN_IN: 'We could not confirm your sign-in. Please reload the page and try again.',
  START_FAILED: 'The import could not be started. Try again.',
  OPEN_FAILED: 'Your file was read, but the deck could not be opened. Try again.',
  NOT_IMPORTED: 'Your file could not be imported. Try again.',
  LOST_TOUCH: 'We lost touch with the import. Try again.',
  TIMEOUT: 'This is taking too long. Try again.',
  UNKNOWN_STAGE: 'Working on your deck…',
} as const

const STAGE_WORDS: Record<string, string> = {
  queued: 'Getting started…',
  waiting: 'Waiting for a free slot…',
  converting: 'Reading your file…',
  placing: 'Placing your slides…',
  checking: 'Checking every slide…',
  opening: 'Opening your deck…',
}

// ---- small readers -------------------------------------------------------------------------------------------------------------------------------------------
type Dict = Record<string, unknown>
const isDict = (value: unknown): value is Dict => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null)
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null)

/** The id shape the proxies and the browser accept for a session or a job. */
export const deckImportSafeId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value)
export const deckImportJobIdValid = (value: unknown): value is string => deckImportSafeId(value) && value.startsWith(DECK_IMPORT_JOB_PREFIX) && value.length > DECK_IMPORT_JOB_PREFIX.length

// ---- the file, checked before anything is uploaded -------------------------------------------------------------------------------------------------------
export type DeckImportFileCheck = { ok: true } | { ok: false; code: 'FILE_IS_PDF' | 'FILE_NOT_PPTX' | 'FILE_EMPTY' | 'UPLOAD_FILE_TOO_LARGE'; message: string }

/** `.pptx` only. A PDF gets the PDF sentence; nothing is uploaded for any refusal. */
export function checkDeckImportFile(file: { name?: unknown; size?: unknown } | null | undefined): DeckImportFileCheck {
  const name = typeof file?.name === 'string' ? file.name.trim().toLowerCase() : ''
  const refuse = (code: 'FILE_IS_PDF' | 'FILE_NOT_PPTX' | 'FILE_EMPTY' | 'UPLOAD_FILE_TOO_LARGE'): DeckImportFileCheck => ({ ok: false, code, message: DECK_IMPORT_WORDS[code] })
  if (name.endsWith('.pdf')) return refuse('FILE_IS_PDF')
  if (!name.endsWith('.pptx')) return refuse('FILE_NOT_PPTX')
  const size = typeof file?.size === 'number' ? file.size : 0
  if (!(size > 0)) return refuse('FILE_EMPTY')
  if (size > DECK_IMPORT_MAX_BYTES) return refuse('UPLOAD_FILE_TOO_LARGE')
  return { ok: true }
}

/** The refusal's words, or null for a file that can be imported. */
export function deckImportFileError(file: { name?: unknown; size?: unknown } | null | undefined): string | null {
  const check = checkDeckImportFile(file)
  return check.ok ? null : check.message
}

/** The new deck's session title: the file name without `.pptx` (what Director names the deck). */
export function deckImportTitle(fileName: string): string {
  const title = fileName.trim().replace(/\.pptx$/i, '').trim().slice(0, 150)
  return title || 'Imported deck'
}

// ---- the start request ---------------------------------------------------------------------------------------------------------------------------------------
export const DECK_IMPORT_START_KEYS = ['session_id', 'researcher_session_id', 'storage_path', 'file_name', 'kind'] as const
export interface DeckImportStartBody { session_id: string; researcher_session_id: string; storage_path: string; file_name: string; kind: 'pptx' }

/** The one body the browser sends (and the proxy forwards): exactly these five keys, nothing else. */
export function deckImportStartBody(parts: { sessionId: string; researcherSessionId: string; storagePath: string; fileName: string }): DeckImportStartBody {
  return { session_id: parts.sessionId, researcher_session_id: parts.researcherSessionId, storage_path: parts.storagePath, file_name: parts.fileName, kind: 'pptx' }
}

/**
 * The proxy's reading of a start body: exactly the five keys, all non-empty strings, `kind` "pptx", the session id a plain id, the Researcher session the same id, and the storage path
 * `<session id>/<one file name>` inside this session's own namespace (the same rule as the template upload's proxy). Anything else is refused before Director is called.
 * The file name's extension is NOT checked here: Director refuses a non-.pptx file with its own words (FILE_NOT_PPTX), which the dialog then shows.
 */
export function parseDeckImportStart(payload: unknown): { ok: true; body: DeckImportStartBody } | { ok: false } {
  if (!isDict(payload)) return { ok: false }
  const keys = Object.keys(payload)
  if (keys.length !== DECK_IMPORT_START_KEYS.length || keys.some(key => !(DECK_IMPORT_START_KEYS as readonly string[]).includes(key))) return { ok: false }
  const { session_id, researcher_session_id, storage_path, file_name, kind } = payload
  if (![session_id, researcher_session_id, storage_path, file_name].every(value => typeof value === 'string' && value.length > 0)) return { ok: false }
  if (kind !== 'pptx' || !deckImportSafeId(session_id) || researcher_session_id !== session_id) return { ok: false }
  const path = storage_path as string
  const parts = path.split('/')
  if (parts.length !== 2 || parts[0] !== session_id || !parts[1] || parts[1] === '.' || parts[1] === '..' || /[\\%?#:\x00-\x1f]/.test(path)) return { ok: false }
  return { ok: true, body: { session_id: session_id as string, researcher_session_id: researcher_session_id as string, storage_path: path, file_name: file_name as string, kind: 'pptx' } }
}

// ---- refusals at the start ---------------------------------------------------------------------------------------------------------------------------------
export interface DeckImportFailure { message: string; retryable: boolean }

/**
 * The words for an answer to the start request that is not 202. Director's coded refusals (`detail: { code, message }`) are shown as they are; the REST entitlement refusal
 * (`{ code, detail, error, retryable }`, 401/403) shows its own sentence; a bare 404 is Director's flag being off (an unknown path), said as "not available right now";
 * Studio's own proxy errors (`{ error }`) are shown as they are. Only a failure with no coded answer from Director at all (a 5xx, a dropped connection) can be retried.
 */
export function deckImportStartFailure(status: number, body: unknown): DeckImportFailure {
  const data = isDict(body) ? body : {}
  const detail = data.detail
  if (isDict(detail) && str(detail.message)) return { message: detail.message as string, retryable: false }
  if ((status === 401 || status === 403) && str(data.code)) {
    return { message: str(data.error) ?? str(data.detail) ?? DECK_IMPORT_WORDS.SIGN_IN, retryable: data.retryable === true }
  }
  if (status === 401 || status === 403) return { message: str(data.error) && !str(detail) ? (data.error as string) : DECK_IMPORT_WORDS.SIGN_IN, retryable: false }
  if (status === 404) return { message: DECK_IMPORT_WORDS.IMPORT_UNAVAILABLE, retryable: false }
  if (str(data.error)) return { message: data.error as string, retryable: status >= 500 }
  return { message: DECK_IMPORT_WORDS.START_FAILED, retryable: status >= 500 || status === 0 }
}

/** The job id out of a 202 answer, or null when the answer is not an accepted import. */
export function deckImportAcceptedJobId(body: unknown): string | null {
  return isDict(body) && deckImportJobIdValid(body.job_id) ? (body.job_id as string) : null
}

// ---- the job, read ---------------------------------------------------------------------------------------------------------------------------------------------
export interface DeckImportChangeLine { text: string; slides: number[]; source: string | null }
export interface DeckImportSummary {
  title: string | null
  slideCount: number | null
  /** "N items changed. See What changed", or null when there is nothing to report. */
  banner: string | null
  headline: string | null
  lines: DeckImportChangeLine[]
  /** Director's notes sentence when the speaker notes were not (all) kept and the list above does not already say it. */
  notesLine: string | null
}
export interface DeckImportReady {
  composer_adoption: { schema_version: 'composer-adoption-v1'; template_id: string; presentation_id: string; frozen_theme: true }
  session_id: string; presentation_id: string; template_id: string; viewer_url: string; slide_count?: number
}

export type DeckImportView =
  | {
      kind: 'working'
      stage: string
      words: string
      /** One more line under the words: the busy-slot note. */
      detail: string | null
      /** "12 of 30 slides" and the ratio for a bar, or null. */
      progress: { label: string; done: number; total: number } | null
      eta: string | null
      waiting: boolean
      nextMs: number
    }
  | { kind: 'ready'; result: unknown; summary: DeckImportSummary }
  | { kind: 'failed'; code: string | null; message: string; retryable: boolean }

/** "N items changed. See What changed" (or "1 item changed..."), null for none. */
export function deckImportBanner(items: number): string | null {
  return items > 0 ? `${items} ${items === 1 ? 'item' : 'items'} changed. See What changed` : null
}

function summaryOf(block: Dict): DeckImportSummary {
  const changed = isDict(block.what_changed) ? block.what_changed : {}
  const rawItems = Array.isArray(changed.items) ? changed.items : []
  const lines: DeckImportChangeLine[] = []
  for (const item of rawItems) {
    if (!isDict(item) || !str(item.text)) continue
    lines.push({
      text: item.text as string,
      slides: Array.isArray(item.slides) ? item.slides.filter((n): n is number => Number.isInteger(n) && n > 0) : [],
      source: str(item.source),
    })
  }
  const notes = isDict(block.notes) ? block.notes : null
  const notesMessage = notes && (notes.state === 'not_kept' || notes.state === 'partial') ? str(notes.message) : null
  const result = isDict(block.result) ? block.result : {}
  return {
    title: str(block.title),
    slideCount: count(result.slide_count),
    banner: deckImportBanner(lines.length),
    headline: str(changed.headline),
    lines,
    notesLine: notesMessage && !lines.some(line => line.text === notesMessage) ? notesMessage : null,
  }
}

const failed = (code: string | null, message: string, retryable: boolean): DeckImportView => ({ kind: 'failed', code, message, retryable })

/**
 * What one polled job means. `deck_import` is the only thing read for the stage; a job without it (Director's flag turned off while the import ran) is "not available".
 *   - failed: `deck_import.error.message` as it is (or the job's first error), "Try again" only when `error.retryable` is exactly true;
 *   - ready: only when the stage is `ready` AND the job is `complete` AND a result came with it;
 *   - anything else is still working, in Director's stage words (`waiting` is a busy slot, shown with its Retry-After, never an error).
 */
export function deckImportView(job: unknown): DeckImportView {
  if (!isDict(job)) return failed(null, DECK_IMPORT_WORDS.LOST_TOUCH, true)
  const block = job.deck_import
  const status = typeof job.status === 'string' ? job.status : ''
  const firstError = Array.isArray(job.errors) ? job.errors.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) ?? null : null
  if (!isDict(block)) {
    if (status === 'failed' || status === 'cancelled') return failed(null, firstError ?? DECK_IMPORT_WORDS.NOT_IMPORTED, false)
    return failed('IMPORT_UNAVAILABLE', DECK_IMPORT_WORDS.IMPORT_UNAVAILABLE, false)
  }
  const stage = typeof block.stage === 'string' ? block.stage : ''
  if (stage === 'failed' || status === 'failed' || status === 'cancelled') {
    const error = isDict(block.error) ? block.error : {}
    return failed(str(error.code), str(error.message) ?? firstError ?? DECK_IMPORT_WORDS.NOT_IMPORTED, error.retryable === true)
  }
  if (stage === 'ready' && status === 'complete') {
    if (!isDict(block.result)) return failed('OPEN_FAILED', DECK_IMPORT_WORDS.OPEN_FAILED, true)
    return { kind: 'ready', result: block.result, summary: summaryOf(block) }
  }
  const waiting = isDict(block.waiting) ? block.waiting : null
  const waitingNow = stage === 'waiting' || waiting !== null
  const retryAfter = waiting ? count(waiting.retry_after_s) : null
  const progress = isDict(block.progress) ? block.progress : null
  const total = progress ? count(progress.slide_count) : null
  const done = progress ? count(progress.slides_done) : null
  return {
    kind: 'working',
    stage,
    words: waitingNow ? STAGE_WORDS.waiting : STAGE_WORDS[stage] ?? DECK_IMPORT_WORDS.UNKNOWN_STAGE,
    detail: waitingNow ? `Another file is being read first.${retryAfter ? ` Trying again in about ${retryAfter} ${retryAfter === 1 ? 'second' : 'seconds'}.` : ''}` : null,
    progress: total && total > 0 && done !== null ? { label: `${Math.min(done, total)} of ${total} ${total === 1 ? 'slide' : 'slides'}`, done: Math.min(done, total), total } : null,
    eta: waitingNow ? null : templateEtaWords(progress?.eta_s),
    waiting: waitingNow,
    nextMs: deckImportNextPollMs(job),
  }
}

/**
 * What the proxy hands the browser from Director's job: only what the dialog reads (job_id, status, errors, poll, deck_import, session_id). The rest of the job (the storage path
 * and checksum of the upload, the owner, the Composer internals) stays on the server. Null when the answer is not a job at all.
 */
export const DECK_IMPORT_JOB_FIELDS = ['job_id', 'status', 'session_id', 'errors', 'poll', 'deck_import'] as const
export function projectDeckImportJob(body: unknown): Record<string, unknown> | null {
  if (!isDict(body)) return null
  const out: Record<string, unknown> = {}
  for (const key of DECK_IMPORT_JOB_FIELDS) if (key in body) out[key] = body[key]
  return out
}

/** The wait before the next read: Director's `poll.next_interval_ms` kept inside [1 s, 60 s], else 3 s. */
export function deckImportNextPollMs(job: unknown): number {
  const asked = isDict(job) && isDict(job.poll) ? job.poll.next_interval_ms : null
  if (typeof asked !== 'number' || !Number.isFinite(asked) || asked <= 0) return DECK_IMPORT_POLL_FALLBACK_MS
  return Math.min(TEMPLATE_POLL_MAX_MS, Math.max(TEMPLATE_POLL_MIN_MS, Math.round(asked)))
}

/**
 * The finished deck, in the shape the Builder stages for "Use original" (`ComposerReady`: composer_adoption, session_id, template_id, presentation_id, viewer_url, slide_count),
 * or null when the result is not this session's complete deck. Same fields, same adoption block, as lib/composer-library.ts composerReadyResult builds.
 */
export function deckImportReadyResult(result: unknown, expectedSessionId: string): DeckImportReady | null {
  if (!isDict(result)) return null
  const { session_id, template_id, presentation_id, viewer_url } = result
  if (session_id !== expectedSessionId || !str(template_id) || !str(presentation_id) || !str(viewer_url)) return null
  return {
    composer_adoption: { schema_version: 'composer-adoption-v1', template_id: template_id as string, presentation_id: presentation_id as string, frozen_theme: true },
    session_id: expectedSessionId,
    template_id: template_id as string,
    presentation_id: presentation_id as string,
    viewer_url: viewer_url as string,
    ...(typeof result.slide_count === 'number' ? { slide_count: result.slide_count } : {}),
  }
}

export const deckImportBuilderHref = (sessionId: string): string => `/builder?session_id=${encodeURIComponent(sessionId)}`

// ---- the job the dialog is waiting for, kept so a reload picks it up again ----------------------------------------------------------------------------------
export interface DeckImportPending { job_id: string; session_id: string; file_name: string }
export const deckImportPendingKey = (userId: string): string => `deckster_deck_import_job_${encodeURIComponent(userId)}`
/** A stored record, checked (browser storage is read back as untyped JSON); anything else is null. */
export function parseDeckImportPending(raw: unknown): DeckImportPending | null {
  if (!isDict(raw) || !deckImportJobIdValid(raw.job_id) || !deckImportSafeId(raw.session_id) || !str(raw.file_name)) return null
  return { job_id: raw.job_id as string, session_id: raw.session_id as string, file_name: raw.file_name as string }
}
