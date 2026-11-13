/**
 * Studio API hardening v1: the pure decisions (no I/O, no imports), so they can be tested without Next or a database.
 *
 * Server flag STUDIO_API_HARDENING_V1_ENABLED (exact "true", read per request, server only, default off).
 * Off, every helper below answers "allowed / unchanged", so the routes behave exactly as before. The I/O wrappers
 * that use these live in lib/api-hardening.ts.
 */

export const STUDIO_API_HARDENING_FLAG = 'STUDIO_API_HARDENING_V1_ENABLED'

type Env = Record<string, string | undefined>

export function isApiHardeningEnabled(env: Env = process.env): boolean {
  return env[STUDIO_API_HARDENING_FLAG] === 'true'
}

// ---- approved-user gate ------------------------------------------------------------------------------------------

export type ApprovalVerdict =
  | { allowed: true }
  | { allowed: false; status: 401 | 403 | 503; error: string }

/** userId: the session user's id (never the e-mail). approved: the DB value, or undefined when the lookup failed. */
export function approvalVerdict(input: {
  enabled: boolean
  userId: string | null | undefined
  found?: boolean
  approved?: boolean | null
  lookupFailed?: boolean
}): ApprovalVerdict {
  if (!input.enabled) return { allowed: true }
  if (!input.userId) return { allowed: false, status: 401, error: 'Unauthorized' }
  if (input.lookupFailed) return { allowed: false, status: 503, error: 'Could not verify account approval' }
  if (!input.found || input.approved !== true) {
    return { allowed: false, status: 403, error: 'account_pending_approval' }
  }
  return { allowed: true }
}

// ---- body key allow-lists -----------------------------------------------------------------------------------------

export const COMPOSE_BODY_KEYS = [
  'session_id', 'presentation_id', 'insert_after_index', 'instruction', 'theme', 'selections', 'research',
  'job_id', 'async', 'assume_on_missing',
] as const

export const REFINE_BODY_KEYS = [
  'session_id', 'presentation_id', 'slide_id', 'slide_index', 'instruction', 'theme', 'selections', 'research',
  'job_id', 'async', 'assume_on_missing',
] as const

export const HANDOFF_BODY_KEYS = [
  'idempotency_key', 'pending_request', 'theme', 'template_mode', 'template_id', 'research', 'store_name',
  'attachment_store_references', 'manual_deck_summary',
] as const

/** Copy only the listed keys. user_id is never on a list: the route always sets it from the session. */
export function pickAllowedKeys(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) out[key] = body[key]
  }
  return out
}

// ---- session ownership ------------------------------------------------------------------------------------------

export type OwnershipVerdict = { allowed: true } | { allowed: false; status: 400 | 403 | 404; error: string }

export function sessionOwnershipVerdict(input: {
  userId: string
  sessionId: string | null | undefined
  sessionOwnerId: string | null | undefined
  sessionStatus?: string | null
  /** Owner of another ChatSession that already records this presentation id, if any. */
  presentationOwnerIds?: Array<string | null | undefined>
}): OwnershipVerdict {
  if (!input.sessionId) return { allowed: false, status: 400, error: 'session_id is required' }
  if (!input.sessionOwnerId || input.sessionStatus === 'deleted') {
    return { allowed: false, status: 404, error: 'Session not found' }
  }
  if (input.sessionOwnerId !== input.userId) return { allowed: false, status: 403, error: 'Forbidden' }
  if ((input.presentationOwnerIds ?? []).some((owner) => !!owner && owner !== input.userId)) {
    return { allowed: false, status: 403, error: 'Forbidden' }
  }
  return { allowed: true }
}

// ---- admin identity ---------------------------------------------------------------------------------------------

export function parseAdminEmails(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Off: the old rule (email === DEV_BYPASS_EMAIL). On: only ADMIN_EMAILS, and DEV_BYPASS_EMAIL alone never grants admin.
 */
export function isAdminEmail(email: string | null | undefined, env: Env = process.env): boolean {
  if (!email) return false
  if (!isApiHardeningEnabled(env)) return email === env.DEV_BYPASS_EMAIL
  return parseAdminEmails(env.ADMIN_EMAILS).includes(email.trim().toLowerCase())
}

// ---- publish unlock lockout -------------------------------------------------------------------------------------

export const UNLOCK_WINDOW_MS = 15 * 60 * 1000
export const UNLOCK_MAX_FAILURES_PER_IP = 5
export const UNLOCK_MAX_FAILURES_PER_SLUG = 50
export const UNLOCK_MAX_PASSCODE_LENGTH = 128

export type UnlockVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number }

export function unlockVerdict(counts: { ipFailures: number; slugFailures: number }): UnlockVerdict {
  if (counts.ipFailures >= UNLOCK_MAX_FAILURES_PER_IP || counts.slugFailures >= UNLOCK_MAX_FAILURES_PER_SLUG) {
    return { allowed: false, retryAfterSeconds: Math.ceil(UNLOCK_WINDOW_MS / 1000) }
  }
  return { allowed: true }
}

/** A passcode outside the set-time length bounds can never match: reject it before the scrypt work. */
export function passcodeLengthPlausible(passcode: string, minLength: number): boolean {
  return passcode.length >= minLength && passcode.length <= UNLOCK_MAX_PASSCODE_LENGTH
}

// ---- spoken-answer cache ----------------------------------------------------------------------------------------

export function spokenAnswerCachePath(voiceId: string, contentKey: string, extension: string): string {
  const safe = (value: string) => value.replace(/[^A-Za-z0-9_.-]/g, '_')
  return `spoken/answers/${safe(voiceId)}.${safe(contentKey)}.${safe(extension)}`
}

export const RATE_BUCKET_UNLOCK = 'publish-unlock-failure'
export const RATE_BUCKET_SPEAK = 'narration-speak-answer'
