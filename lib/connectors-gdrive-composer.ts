/**
 * KNOWLEDGE (P4-15 composer half, DARK): "Add from Google Drive" in the Builder chat composer's attach menu, the chips above the composer
 * and their error states (UX mock D1a / D2 / D3 / D8a-c). Pure helpers, client-safe (no node: imports), so a vm test can run them.
 * Flags: NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED AND NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED (exact "true", both default off)
 * and the existing Knowledge entitlement (the page passes kgIsPremium). Off: nothing here is drawn, listened to or sent.
 */
import { MAX_LINKED_ITEMS, isGdriveSessionLinksEnabled, validChatSessionId } from '@/lib/connectors-gdrive-session-links'

/** Menu + chips are offered only with both flags on (isGdriveSessionLinksEnabled needs the Drive flag too) AND an entitled user. */
export function isGdriveComposerEnabled(
  entitled: boolean,
  sessionLinksValue: string | undefined = process.env.NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED,
  driveValue: string | undefined = process.env.NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED,
): boolean {
  return entitled === true && isGdriveSessionLinksEnabled(sessionLinksValue, driveValue)
}

export { MAX_LINKED_ITEMS }

// ---- chips -----------------------------------------------------------------------------------------------------------------------

export type GdriveErrorKind = 'expired' | 'too_large' | 'unsupported' | 'trashed' | 'removed' | 'generic'
export type GdriveChipState = 'linking' | 'linked' | 'error'
export interface GdriveChip { id: string; title: string; state: GdriveChipState; errorKind?: GdriveErrorKind; message?: string }
export interface GdriveNotice { id: string; tone: 'info' | 'warn' | 'error'; text: string; action?: 'reconnect' }

/** Researcher RESEARCHER_CONNECTOR_MAX_ITEM_MB default (routers/connectors.py); the deployment may set another value. */
export const GDRIVE_MAX_FILE_MB = 20
/** The EXPORTS (Docs, Slides, Sheets) and BINARY_ALLOWED lists in Researcher routers/connectors.py, in the mock's words (D8c). */
export const GDRIVE_SUPPORTED_LABEL = 'Docs, Slides, Sheets, PDF, DOCX, PPTX, XLSX, CSV, TXT, MD'
export const GDRIVE_UNTITLED = 'Drive file'
export const GDRIVE_EXPIRED_TEXT = 'Drive connection expired. Reconnect to keep using your files.'
/**
 * Hardening (REVIEW-1 #1, #4): CONNECTOR_SESSION_NOT_OWNED, from Studio's owner check or from Researcher, in plain words. Researcher refuses a chat until its
 * own owner record for that chat exists and is the caller's (written by the first upload; the cuid owner needs #586), so it says "yet", and nothing retries.
 */
export const GDRIVE_NOT_OWNED_TEXT = "Drive files can't be added to this chat yet."

export const contextLabel = (count: number) => `${count} Drive ${count === 1 ? 'file' : 'files'} linked to this chat`
export const linkedIdsOf = (chips: readonly GdriveChip[]): string[] => chips.filter(c => c.state === 'linked').map(c => c.id)
export const chipsRoom = (chips: readonly GdriveChip[]): number => Math.max(0, MAX_LINKED_ITEMS - chips.filter(c => c.state !== 'error').length)
export const removeChipById = (chips: readonly GdriveChip[], id: string): GdriveChip[] => chips.filter(c => c.id !== id)
/** Incoming chips replace the same id in place; new ids are appended. */
export function mergeChips(chips: readonly GdriveChip[], incoming: readonly GdriveChip[]): GdriveChip[] {
  const out = [...chips]
  for (const chip of incoming) {
    const at = out.findIndex(c => c.id === chip.id)
    if (at === -1) out.push(chip); else out[at] = chip
  }
  return out
}

const nameOf = (title: unknown) => (typeof title === 'string' && title.trim() ? title.trim() : GDRIVE_UNTITLED)

/** D8b / D8c copy for a Researcher item error code (routers/connectors.py _fetch_one). */
export function itemFailure(title: unknown, code: unknown): { kind: GdriveErrorKind; message: string } {
  const name = nameOf(title)
  switch (code) {
    case 'too_large': return { kind: 'too_large', message: `"${name}" is too large. The limit is ${GDRIVE_MAX_FILE_MB} MB per file.` }
    case 'mime_not_allowed': return { kind: 'unsupported', message: `"${name}" can't be used. Supported: ${GDRIVE_SUPPORTED_LABEL}.` }
    case 'trashed': return { kind: 'trashed', message: `"${name}" is in your Drive trash.` }
    case 'disconnected': return { kind: 'expired', message: GDRIVE_EXPIRED_TEXT }
    case 'erased': return { kind: 'removed', message: `"${name}" was removed from your library. Add it from Drive again.` }
    default: return { kind: 'generic', message: `Couldn't use "${name}" from Google Drive. Please try again.` }
  }
}

/** An item the items route returned that did not make it into the library (status rejected / failed). */
export const itemIsFailed = (item: { status?: unknown; error?: unknown }): boolean =>
  item.status === 'rejected' || item.status === 'failed' || (typeof item.error === 'string' && item.error !== '')

export type RequestFailure =
  | { kind: 'not_connected' }
  | { kind: 'expired'; message: string }
  | { kind: 'error'; message: string }

/** A failed Studio connector route (the relay's { error, error_code } and the HTTP status) as one of the three things the composer does about it. */
export function requestFailure(status: number, body: { error?: unknown; error_code?: unknown } | null | undefined): RequestFailure {
  const code = body?.error_code
  if (code === 'CONNECTOR_NOT_CONNECTED') return { kind: 'not_connected' }
  if (code === 'CONNECTOR_GRANT_REVOKED') return { kind: 'expired', message: GDRIVE_EXPIRED_TEXT }
  if (code === 'CONNECTOR_SESSION_NOT_OWNED') return { kind: 'error', message: GDRIVE_NOT_OWNED_TEXT }
  // Hardening (REVIEW-1 #4): these three are Studio's own refusals (signed out, not entitled, flag off), which carry no error_code; a relayed Researcher code keeps the route's words.
  const own = code === undefined || code === null
  if (status === 401 && own) return { kind: 'error', message: 'Sign in again to use Google Drive.' }
  if (status === 403 && own) return { kind: 'error', message: "Google Drive isn't available on your plan." }
  if (status === 404 && own) return { kind: 'error', message: 'Google Drive is not available right now.' }
  const message = typeof body?.error === 'string' && body.error.trim() ? body.error.trim() : 'Google Drive is not available right now. Please try again.'
  return { kind: 'error', message }
}

// ---- a pick, step by step (items route -> session-links route) --------------------------------------------------------------------

export interface PickItem { id?: unknown; source_ref?: unknown; title?: unknown; status?: unknown; error?: unknown }
const errorChip = (id: string, title: unknown, failure: { kind: GdriveErrorKind; message: string }): GdriveChip =>
  ({ id, title: nameOf(title), state: 'error', errorKind: failure.kind, message: failure.message })

/** After POST /items: a file the library refused (too large, unsupported type, trashed ...) is an error chip, every other file waits to be linked. */
export function chipsFromItems(ids: readonly string[], items: readonly PickItem[]): GdriveChip[] {
  const byId = new Map<string, PickItem>()
  for (const item of items) { const key = typeof item?.id === 'string' ? item.id : typeof item?.source_ref === 'string' ? item.source_ref : null; if (key) byId.set(key, item) }
  return ids.map(id => {
    const item = byId.get(id)
    if (!item) return errorChip(id, undefined, itemFailure(undefined, null))
    if (itemIsFailed(item)) return errorChip(id, item.title, itemFailure(item.title, item.error))
    return { id, title: nameOf(item.title), state: 'linking' as const }
  })
}
/** After POST /session-links: ids it linked are linked; ids it rejected (or never mentioned) are error chips. Chips that were not waiting are kept as they are. */
export function chipsAfterLink(chips: readonly GdriveChip[], link: { linked?: unknown; rejected?: unknown } | null | undefined): GdriveChip[] {
  const linkedList = link?.linked, rejectedList = link?.rejected
  const linked = new Set(Array.isArray(linkedList) ? linkedList.filter((x): x is string => typeof x === 'string') : [])
  const rejected = new Map<string, unknown>()
  if (Array.isArray(rejectedList)) for (const r of rejectedList) if (typeof r?.id === 'string') rejected.set(r.id, r.error)
  return chips.map(chip => {
    if (chip.state !== 'linking') return chip
    if (linked.has(chip.id)) return { id: chip.id, title: chip.title, state: 'linked' as const }
    return errorChip(chip.id, chip.title, itemFailure(chip.title, rejected.get(chip.id)))
  })
}
/** The session-links call itself failed: the chips that waited for it did not make it into the chat. `notOwned` (CONNECTOR_SESSION_NOT_OWNED): they stay errors that do not ask for a retry. */
export const chipsLinkFailed = (chips: readonly GdriveChip[], notOwned = false): GdriveChip[] =>
  chips.map(chip => chip.state === 'linking' ? errorChip(chip.id, chip.title, { kind: 'generic', message: notOwned ? `"${chip.title}" can't be added to this chat yet.` : `Couldn't add "${chip.title}" to this chat. Please try again.` }) : chip)

// ---- connect round trip (D2a-c) --------------------------------------------------------------------------------------------------

export const GDRIVE_START_PATH = '/api/connectors/gdrive/start'
export const GDRIVE_RETURN_QUERY = 'return' // start?return=/builder?session_id=<id>
export const GDRIVE_RETURN_COOKIE = 'deckster_gdrive_return'
export const GDRIVE_STATUS_PARAM = 'gdrive' // the callback appends ?gdrive=connected|cancelled|invalid|failed
export type GdriveReturnStatus = 'connected' | 'cancelled' | 'invalid' | 'failed'

/** Where the callback may send the user back to: the Builder at one chat session, nothing else (no open redirect). */
export function validReturnPath(value: unknown): string | null {
  return typeof value === 'string' && /^\/builder\?session_id=[A-Za-z0-9_-]{8,128}$/.test(value) ? value : null
}
export const builderReturnPath = (sessionId: string | null | undefined): string | null =>
  validChatSessionId(sessionId) ? validReturnPath(`/builder?session_id=${sessionId}`) : null
/** Link target for Connect / Reconnect. Without a chat session it is the plain start route (the callback then lands on Settings). */
export function gdriveStartHref(sessionId: string | null | undefined): string {
  const back = builderReturnPath(sessionId)
  return back ? `${GDRIVE_START_PATH}?${GDRIVE_RETURN_QUERY}=${encodeURIComponent(back)}` : GDRIVE_START_PATH
}
// Hardening (REVIEW-1 #1): a one-time marker proves that a return came from this server's callback. The callback puts the same random value in the
// address and in a short-lived cookie that only this origin can set; the composer acts on ?gdrive= only when the two match, then clears both.
export const GDRIVE_MARKER_PARAM = 'gdrive_marker'
export const GDRIVE_MARKER_COOKIE = 'deckster_gdrive_return_marker'
export const GDRIVE_MARKER_COOKIE_PATH = '/builder'
export const GDRIVE_MARKER_MAX_AGE_SECONDS = 120
const MARKER_RE = /^[A-Za-z0-9_-]{32}$/ // newNonce(): 24 random bytes, base64url

/** The callback's redirect when the start route remembered a return path. */
export const returnRedirectPath = (path: string, status: string, marker: string): string => `${path}&${GDRIVE_STATUS_PARAM}=${status}&${GDRIVE_MARKER_PARAM}=${marker}`

export interface GdriveReturn { status: GdriveReturnStatus | null; marker: string | null; sessionId: string | null; search: string }
/** Reads and removes ?gdrive=<status> and its marker from a query string; `sessionId` is the chat the address names; `search` is what to put back in the address bar. */
export function takeGdriveReturn(search: string): GdriveReturn {
  const params = new URLSearchParams(search)
  const raw = params.get(GDRIVE_STATUS_PARAM), marker = params.get(GDRIVE_MARKER_PARAM), sessionId = params.get('session_id')
  if (raw === null && marker === null) return { status: null, marker: null, sessionId, search }
  params.delete(GDRIVE_STATUS_PARAM)
  params.delete(GDRIVE_MARKER_PARAM)
  const rest = params.toString()
  const status = raw === 'connected' || raw === 'cancelled' || raw === 'invalid' || raw === 'failed' ? raw : null
  return { status, marker, sessionId, search: rest ? `?${rest}` : '' }
}

/** The marker cookie's value in a document.cookie string, or null. */
export function markerFromCookies(cookies: unknown): string | null {
  if (typeof cookies !== 'string') return null
  for (const part of cookies.split(';')) {
    const at = part.indexOf('=')
    if (at > 0 && part.slice(0, at).trim() === GDRIVE_MARKER_COOKIE) return part.slice(at + 1).trim()
  }
  return null
}
/** Written to document.cookie to clear the marker (the name, path and attributes the callback set it with). */
export const GDRIVE_MARKER_CLEAR = `${GDRIVE_MARKER_COOKIE}=; Max-Age=0; Path=${GDRIVE_MARKER_COOKIE_PATH}; Secure; SameSite=Lax`
/** A return is genuine only when the address's marker is well formed and equals the cookie's. */
export const isGenuineReturn = (queryMarker: unknown, cookieMarker: unknown): boolean =>
  typeof queryMarker === 'string' && MARKER_RE.test(queryMarker) && queryMarker === cookieMarker

// ---- per-chat memory (a reload keeps the chips, so the next build message still carries them) -------------------------------------

export const chipsStorageKey = (sessionId: string) => `deckster_gdrive_links_${sessionId}`
/** Linked chips only (id + title). An empty list is kept on purpose: the user cleared the chat's files, and the next message says so ([]). */
export const serializeChips = (chips: readonly GdriveChip[]): string =>
  JSON.stringify(chips.filter(c => c.state === 'linked').map(c => ({ id: c.id, title: c.title })))
/** null = nothing stored for the chat (never linked); otherwise the stored linked chips, any malformed entry dropped. */
export function parseChips(raw: string | null | undefined): GdriveChip[] | null {
  if (typeof raw !== 'string') return null
  let data: unknown
  try { data = JSON.parse(raw) } catch { return null }
  if (!Array.isArray(data)) return null
  const out: GdriveChip[] = []
  for (const entry of data.slice(0, MAX_LINKED_ITEMS)) {
    const id = (entry as { id?: unknown })?.id, title = (entry as { title?: unknown })?.title
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id) || out.some(c => c.id === id)) continue
    out.push({ id, title: nameOf(title), state: 'linked' })
  }
  return out
}
