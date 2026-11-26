/**
 * Layout viewer ticket for the Studio deck iframe (program1/studio-flip-enablers; Layout program1/layout-auth-v2 +
 * program1/layout-ticket-renew).
 *
 * Flag NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED (exact "true", default off). Off: useLayoutViewerTicketSrc returns the base
 * URL unchanged and does nothing else. On: the iframe waits for a ticket minted by POST /api/presentations/{id}/viewer-ticket
 * (service token server-side), loads the base URL with ?t=<ticket>, and before expiry mints a fresh one and posts
 * {type:"deckster:viewer-ticket", ticket} to the viewer window (targetOrigin = the viewer's origin). The iframe src never
 * changes for a renewal, so the deck is not reloaded.
 *
 * Server-safe: no React here (a server route imports isStudioLayoutTicketEnabled). The hook is in
 * lib/studio-layout-viewer-ticket-client.ts ('use client').
 */
import { evaluateLayoutViewerUrl, type LayoutViewerUrlPolicy } from '@/lib/layout-viewer-url-policy'

export const VIEWER_TICKET_MESSAGE_TYPE = 'deckster:viewer-ticket'
/** Renew at this fraction of the ticket lifetime. */
export const VIEWER_TICKET_RENEW_FRACTION = 0.75
export const VIEWER_TICKET_RETRY_MS = 15_000
const MIN_RENEW_MS = 15_000

export function isStudioLayoutTicketEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED === 'true'
}

export interface ViewerTicket {
  ticket: string
  expiresIn: number
  url: string
}

/** Pure: the base viewer URL with t=<ticket> (other params, e.g. a snapshot revision, kept). */
export function withViewerTicket(baseUrl: string, ticket: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set('t', ticket)
  return url.toString()
}

/** Pure: when to renew, in ms from now. */
export function renewDelayMs(expiresInSeconds: number): number {
  const s = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 600
  return Math.max(MIN_RENEW_MS, Math.floor(s * 1000 * VIEWER_TICKET_RENEW_FRACTION))
}

/** PL-46: what a frame shows once Layout has refused it (a terminal refusal, at the first mint or at a renewal): a blank page, so no stale document, and no edit capability, stays on screen. */
export const VIEWER_REFUSED_FRAME_SRC = 'about:blank'

/** The ids the ticket route accepts (the same pattern as app/api/presentations/[id]/viewer-ticket/route.ts). */
export const VIEWER_PRESENTATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/

/**
 * PL-60: the presentation id of a Layout viewer URL (`<layout>/p/{id}`, with or without ?viewOnly=true and a #/N slide), or null when the URL is not that shape
 * or the id is one the ticket route would refuse. A frame whose id is unknown loads its URL as it is (no ticket).
 */
export function presentationIdFromViewerUrl(viewerUrl: string | null | undefined): string | null {
  if (!viewerUrl) return null
  try {
    const match = /^\/p\/([^/]+)\/?$/.exec(new URL(viewerUrl).pathname)
    if (!match) return null
    const id = decodeURIComponent(match[1])
    return VIEWER_PRESENTATION_ID_PATTERN.test(id) ? id : null
  } catch {
    return null
  }
}

/**
 * PL-60 (REVIEW-CX P2, ARCH-PLATFORM 15:27Z): the presentation id of a viewer URL ONLY when the FULL URL is on the Studio's approved Layout origin list (the policy the editing frame uses:
 * exact origin, http or https, no credentials in the URL). A URL that fails gets no id, so the hook mints nothing, attaches no ticket and posts nothing to it. The policy is passed in
 * (the caller owns the environment's policy), which keeps this module server-safe.
 */
export function approvedPresentationIdFromViewerUrl(viewerUrl: string | null | undefined, policy: LayoutViewerUrlPolicy): string | null {
  const id = presentationIdFromViewerUrl(viewerUrl)
  if (!id) return null
  return evaluateLayoutViewerUrl(viewerUrl, policy).status === 'allowed' ? id : null
}

/** PL-46: the scope a frame asks for. Only the owner's editing frame asks 'edit'; every other frame asks 'view' (Layout decides, by its own owner check). */
export type ViewerTicketScope = 'edit' | 'view'

/** The route's path, with the requested scope as Layout's own `scope` query parameter (omitted when none is asked). */
export function viewerTicketPath(presentationId: string, scope?: ViewerTicketScope): string {
  return `/api/presentations/${encodeURIComponent(presentationId)}/viewer-ticket${scope ? `?scope=${scope}` : ''}`
}

/** What one request for a ticket came to: a ticket; an answer that will not change by asking again (400, 401, 403, 404 ...); or a failure worth another try (network, 5xx, 408, 429, a body without a ticket). */
export type ViewerTicketOutcome =
  | { kind: 'ticket'; ticket: ViewerTicket }
  | { kind: 'refused'; status: number }
  | { kind: 'transient' }

/** Pure: a 4xx answer other than "try later" (408, 429) is a refusal. */
export function isTicketRefusal(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429
}

export async function fetchViewerTicketOutcome(presentationId: string, scope?: ViewerTicketScope, fetchImpl: typeof fetch = fetch): Promise<ViewerTicketOutcome> {
  try {
    const res = await fetchImpl(viewerTicketPath(presentationId, scope), {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
    })
    if (!res.ok) return isTicketRefusal(res.status) ? { kind: 'refused', status: res.status } : { kind: 'transient' }
    const body = await res.json()
    if (!body || typeof body.ticket !== 'string' || !body.ticket) return { kind: 'transient' }
    return { kind: 'ticket', ticket: { ticket: body.ticket, expiresIn: Number(body.expires_in) || 600, url: typeof body.url === 'string' ? body.url : '' } }
  } catch {
    return { kind: 'transient' }
  }
}

/** The ticket, or null when there is none (a refusal and a failure both read null here; the hook tells them apart through fetchViewerTicketOutcome). */
export async function fetchViewerTicket(presentationId: string, fetchImpl: typeof fetch = fetch, scope?: ViewerTicketScope): Promise<ViewerTicket | null> {
  const outcome = await fetchViewerTicketOutcome(presentationId, scope, fetchImpl)
  return outcome.kind === 'ticket' ? outcome.ticket : null
}

/** The iframe currently showing `src` (the one this hook loaded), or null. */
export function findViewerFrame(src: string | null, doc: Pick<Document, 'querySelectorAll'> | undefined = typeof document === 'undefined' ? undefined : document): HTMLIFrameElement | null {
  if (!src || !doc) return null
  return Array.from(doc.querySelectorAll('iframe')).find(frame => frame.getAttribute('src') === src) ?? null
}

/** Post a renewed ticket to the viewer; returns false when there is no window to post to. */
export function postViewerTicket(frame: HTMLIFrameElement | null, ticket: string, viewerUrl: string): boolean {
  const target = frame?.contentWindow
  if (!target) return false
  target.postMessage({ type: VIEWER_TICKET_MESSAGE_TYPE, ticket }, new URL(viewerUrl).origin)
  return true
}
