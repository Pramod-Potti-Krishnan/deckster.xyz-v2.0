/**
 * Studio session writes: the named allowlist for PATCH /api/sessions/[id] (PL-70 Step A, CHIEF-ARCH CA-123 / CA-124 / CA-127(A)).
 *
 * Pure decisions only: no database, no network, no logging. lib/studio-session-patch-guard.ts runs them around the route's write.
 *
 * TWO independent server-only flags, each the exact string "true", both default off (nothing here runs then):
 *   STUDIO_SESSION_PATCH_ALLOWLIST_SHADOW_V1_ENABLED   shadow: the write happens exactly as it does today; the same decision is computed and only the refused key
 *                                                      NAMES and a closed reason code are logged (never a value, an id, a URL, a store name or a user id)
 *   STUDIO_SESSION_PATCH_ALLOWLIST_V1_ENABLED          enforce: a body with any other key, or any invalid value, is refused as a whole; nothing is written. Wins over shadow.
 *
 * Every refusal answers the SAME plain 400 (status, body bytes and headers), whatever the reason: the route must not be an oracle for whether a deck id or a
 * store name exists. The reason and the offending key names stay in the server log. Anything this module cannot decide is a refusal (fail closed).
 */
import { evaluateLayoutViewerUrl, type LayoutViewerUrlPolicy } from '@/lib/layout-viewer-url-policy'

export const SESSION_PATCH_ENFORCE_FLAG = 'STUDIO_SESSION_PATCH_ALLOWLIST_V1_ENABLED'
export const SESSION_PATCH_SHADOW_FLAG = 'STUDIO_SESSION_PATCH_ALLOWLIST_SHADOW_V1_ENABLED'

export type SessionPatchMode = 'off' | 'shadow' | 'enforce'

/** enforce wins when both are on; each flag is the exact string "true" and nothing looser; anything else (or no env at all) is off. */
export function sessionPatchMode(env: Record<string, string | undefined> | null | undefined = process.env): SessionPatchMode {
  if (!env || typeof env !== 'object') return 'off'
  if (env[SESSION_PATCH_ENFORCE_FLAG] === 'true') return 'enforce'
  if (env[SESSION_PATCH_SHADOW_FLAG] === 'true') return 'shadow'
  return 'off'
}

/** The closed list of reason codes. They are logged, never sent to the browser. */
export const SESSION_PATCH_REASONS = [
  'key_not_allowed',
  'value_invalid',
  'pointer_recorded_elsewhere',
  'store_recorded_elsewhere',
  'store_immutable',
  'body_not_object',
  'state_cache_invalid',
] as const
export type SessionPatchReason = typeof SESSION_PATCH_REASONS[number]

/** The ONE refusal every reason shares: the same status, the same body bytes, the same headers. */
export const SESSION_PATCH_REFUSAL_STATUS = 400
export const SESSION_PATCH_REFUSAL_BODY = '{"error":"Invalid request"}'

/** The pointer columns: three ids and the three URLs that restate them. */
export const SESSION_POINTER_ID_FIELDS = ['blankPresentationId', 'strawmanPresentationId', 'finalPresentationId'] as const
export const SESSION_POINTER_URL_FIELDS = ['blankPresentationUrl', 'strawmanPreviewUrl', 'finalPresentationUrl'] as const
const ID_FIELD_OF_URL: Record<string, string> = {
  blankPresentationUrl: 'blankPresentationId',
  strawmanPreviewUrl: 'strawmanPresentationId',
  finalPresentationUrl: 'finalPresentationId',
}

export const SESSION_PATCH_SCALAR_KEYS = ['title', 'currentStage', 'slideCount', 'lastMessageAt', 'isFavorite', 'status'] as const
export const SESSION_PATCH_ALLOWED_KEYS: readonly string[] = [
  ...SESSION_PATCH_SCALAR_KEYS,
  ...SESSION_POINTER_ID_FIELDS,
  ...SESSION_POINTER_URL_FIELDS,
  'stateCache',
]
const STATE_CACHE_KEYS = ['currentStatus', 'slideStructure', 'activeVersion'] as const
const ACTIVE_VERSIONS = ['blank', 'strawman', 'final']

/** A Layout presentation id: no slash, no space, no dot sequence; the shape of the ids Layout issues (UUID-like) and nothing wider than a path segment. */
export const SESSION_PRESENTATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/
/** A knowledge-store name or id as the session row keeps it (the Gemini resource name or the Researcher session id): a conservative charset and length. */
export const SESSION_STORE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/

export const SESSION_PATCH_LIMITS = Object.freeze({
  titleMax: 200,
  stageMax: 6,
  slideCountMax: 1000,
  urlMax: 2048,
  stateCacheValueMaxChars: 1_000_000,
  lastMessageFutureMs: 24 * 60 * 60 * 1000, // a client clock a day ahead is still a legitimate save (a clock a few minutes out must never refuse one)
  lastMessagePastFloorMs: Date.UTC(2000, 0, 1),
})

export type SessionPatchDecision =
  | { ok: true; data: Record<string, unknown>; pointerIds: Array<{ field: string; id: string }> }
  | { ok: false; reason: SessionPatchReason; keys: string[] }

/** The row columns a pointer URL may be paired with when the body carries the URL without its id. */
export type SessionPointerRow = Partial<Record<typeof SESSION_POINTER_ID_FIELDS[number], string | null | undefined>>

export interface SessionPatchContext {
  /** the caller's own row as it stands (only the three pointer ids are read) */
  row: SessionPointerRow | null | undefined
  /** the approved Layout viewer origins; absent means NO URL can be approved (fail closed) */
  urlPolicy: LayoutViewerUrlPolicy | null | undefined
  now?: Date
}

const refuse = (reason: SessionPatchReason, keys: string[] = []): SessionPatchDecision => ({ ok: false, reason, keys })
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
const isInt = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

/** The id a Layout viewer URL names: `/p/<id>` (optionally one trailing slash), nothing else. Null when it names none. */
export function presentationIdOfViewerUrl(value: string): string | null {
  try {
    const parsed = new URL(value)
    const match = /^\/p\/([^/]+)\/?$/.exec(parsed.pathname)
    if (!match) return null
    const id = decodeURIComponent(match[1])
    return SESSION_PRESENTATION_ID_PATTERN.test(id) ? id : null
  } catch {
    return null
  }
}

function sizeOk(value: unknown): boolean {
  if (value === undefined) return true // a value the body does not carry is today's undefined (Prisma leaves it out)
  try {
    const text = JSON.stringify(value)
    return typeof text === 'string' && text.length <= SESSION_PATCH_LIMITS.stateCacheValueMaxChars
  } catch {
    return false
  }
}

/**
 * Decide a PATCH body. Pure. Returns the data to give prisma (validated, normalised; the three-key stateCache upsert exactly as the route builds it today)
 * or ONE refusal (a reason from the closed list and the offending key names).
 */
export function decideSessionPatch(body: unknown, context: SessionPatchContext): SessionPatchDecision {
  if (!isPlainObject(body)) return refuse('body_not_object')
  const keys = Object.keys(body)
  const unlisted = keys.filter((key) => !SESSION_PATCH_ALLOWED_KEYS.includes(key))
  if (unlisted.length > 0) return refuse('key_not_allowed', unlisted)

  const now = context?.now instanceof Date && !Number.isNaN(context.now.getTime()) ? context.now : new Date()
  const row = context?.row && typeof context.row === 'object' ? context.row : {}
  const data: Record<string, unknown> = {}
  const invalid: string[] = []
  const pointerIds: Array<{ field: string; id: string }> = []

  for (const key of keys) {
    const value = body[key]
    switch (key) {
      case 'title': {
        const title = typeof value === 'string' ? value.trim() : ''
        if (title.length >= 1 && title.length <= SESSION_PATCH_LIMITS.titleMax) data.title = title
        else invalid.push(key)
        break
      }
      case 'currentStage':
        if (isInt(value, 0, SESSION_PATCH_LIMITS.stageMax)) data.currentStage = value
        else invalid.push(key)
        break
      case 'slideCount':
        if (isInt(value, 0, SESSION_PATCH_LIMITS.slideCountMax)) data.slideCount = value
        else invalid.push(key)
        break
      case 'lastMessageAt': {
        const at = typeof value === 'string' && value.length <= 40 ? new Date(value) : null
        const time = at ? at.getTime() : Number.NaN
        if (at && !Number.isNaN(time) && time >= SESSION_PATCH_LIMITS.lastMessagePastFloorMs && time <= now.getTime() + SESSION_PATCH_LIMITS.lastMessageFutureMs) data.lastMessageAt = at
        else invalid.push(key)
        break
      }
      case 'isFavorite':
        if (typeof value === 'boolean') data.isFavorite = value
        else invalid.push(key)
        break
      case 'status':
        if (value === 'active' || value === 'archived') data.status = value
        else invalid.push(key)
        break
      case 'blankPresentationId':
      case 'strawmanPresentationId':
      case 'finalPresentationId':
        if (value === null) data[key] = null
        else if (typeof value === 'string' && SESSION_PRESENTATION_ID_PATTERN.test(value)) { data[key] = value; pointerIds.push({ field: key, id: value }) } else invalid.push(key)
        break
      case 'blankPresentationUrl':
      case 'strawmanPreviewUrl':
      case 'finalPresentationUrl': {
        if (value === null) { data[key] = null; break }
        // the URL must be an approved Layout viewer URL of the very id the row will hold: the id written with it, or else the row's own
        const idField = ID_FIELD_OF_URL[key]
        const pairedId = idField in body ? body[idField] : (row as Record<string, unknown>)[idField]
        const policy = context?.urlPolicy
        const named = typeof value === 'string' && value.length <= SESSION_PATCH_LIMITS.urlMax ? presentationIdOfViewerUrl(value) : null
        const approved = policy && typeof value === 'string' ? evaluateLayoutViewerUrl(value, policy).status === 'allowed' : false
        if (approved && named !== null && typeof pairedId === 'string' && pairedId === named) data[key] = value
        else invalid.push(key)
        break
      }
      case 'stateCache': {
        if (!isPlainObject(value)) return refuse('state_cache_invalid', ['stateCache'])
        const inner = Object.keys(value)
        const extra = inner.filter((name) => !(STATE_CACHE_KEYS as readonly string[]).includes(name))
        if (extra.length > 0) return refuse('state_cache_invalid', ['stateCache'])
        const { currentStatus, slideStructure, activeVersion } = value as Record<string, unknown>
        if (!sizeOk(currentStatus) || !sizeOk(slideStructure)) return refuse('state_cache_invalid', ['stateCache'])
        if (activeVersion !== undefined && !(typeof activeVersion === 'string' && ACTIVE_VERSIONS.includes(activeVersion))) return refuse('state_cache_invalid', ['stateCache'])
        data.stateCache = { upsert: { create: { currentStatus, slideStructure, activeVersion }, update: { currentStatus, slideStructure, activeVersion } } }
        break
      }
      default:
        // unreachable (every key was checked against the list above); a key that gets here is refused, never written
        invalid.push(key)
    }
  }
  if (invalid.length > 0) return refuse('value_invalid', invalid)
  return { ok: true, data, pointerIds }
}

/**
 * The ONLY field labels a log line may name: the allowlist's own keys and the other columns and relations of the session row, all fixed in this file.
 * A client key outside this closed set never has a single character logged, whatever it looks like: it is counted, as `unknown(<n>)`.
 */
export const SESSION_PATCH_NON_WRITABLE_LABELS = ['id', 'userId', 'createdAt', 'updatedAt', 'firstMessageAt', 'geminiStoreId', 'geminiStoreName', 'user', 'messages', 'uploadedFiles', 'publishedDeck'] as const
export const SESSION_PATCH_LOG_LABELS: ReadonlySet<string> = new Set<string>([...SESSION_PATCH_ALLOWED_KEYS, ...SESSION_PATCH_NON_WRITABLE_LABELS])

/** The key part of a log line: the server-known labels (each once, at most ten), then `unknown(<n>)` when the request carried keys outside the closed set. Never a client-chosen string. */
export function sessionPatchLogKeys(keys: readonly string[]): string {
  const known: string[] = []
  let unknown = 0
  for (const key of keys) {
    if (typeof key === 'string' && SESSION_PATCH_LOG_LABELS.has(key)) { if (!known.includes(key) && known.length < 10) known.push(key) } else unknown++
  }
  return (unknown > 0 ? [...known, `unknown(${unknown})`] : known).join(',')
}

/** The one log line a refusal writes (shadow or enforce). */
export function sessionPatchLogLine(mode: 'shadow' | 'enforce', reason: SessionPatchReason, keys: readonly string[]): string {
  const code = (SESSION_PATCH_REASONS as readonly string[]).includes(reason) ? reason : 'value_invalid'
  return `[sessions PATCH ${mode}] refused reason=${code} keys=${sessionPatchLogKeys(keys)}`
}

/** The store-name shape the session row keeps. */
export const isSessionStoreName = (value: unknown): value is string => typeof value === 'string' && SESSION_STORE_NAME_PATTERN.test(value)
