/**
 * Layout viewer ticket for the Studio deck iframe (program1/studio-flip-enablers; Layout program1/layout-auth-v2 +
 * program1/layout-ticket-renew).
 *
 * Flag NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED (exact "true", default off). Off: useLayoutViewerTicketSrc returns the base
 * URL unchanged and does nothing else. On: the iframe waits for a ticket minted by POST /api/presentations/{id}/viewer-ticket
 * (service token server-side), loads the base URL with ?t=<ticket>, and before expiry mints a fresh one and posts
 * {type:"deckster:viewer-ticket", ticket} to the viewer window (targetOrigin = the viewer's origin). The iframe src never
 * changes for a renewal, so the deck is not reloaded.
 */
import { useEffect, useState } from 'react'

export const VIEWER_TICKET_MESSAGE_TYPE = 'deckster:viewer-ticket'
/** Renew at this fraction of the ticket lifetime. */
export const VIEWER_TICKET_RENEW_FRACTION = 0.75
const MIN_RENEW_MS = 15_000
const RETRY_MS = 15_000

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

export async function fetchViewerTicket(presentationId: string, fetchImpl: typeof fetch = fetch): Promise<ViewerTicket | null> {
  try {
    const res = await fetchImpl(`/api/presentations/${encodeURIComponent(presentationId)}/viewer-ticket`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
    })
    if (!res.ok) return null
    const body = await res.json()
    if (!body || typeof body.ticket !== 'string' || !body.ticket) return null
    return { ticket: body.ticket, expiresIn: Number(body.expires_in) || 600, url: typeof body.url === 'string' ? body.url : '' }
  } catch {
    return null
  }
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

/**
 * The iframe src to use. Flag off: `baseUrl` itself. On: null until the first ticket, then the ticketed URL (stable for
 * this baseUrl/presentation; renewals go by postMessage).
 */
export function useLayoutViewerTicketSrc(
  baseUrl: string | null,
  presentationId: string | null | undefined,
): string | null {
  const enabled = isStudioLayoutTicketEnabled()
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !baseUrl || !presentationId) { setSrc(null); return }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let first = true
    let loadedSrc: string | null = null
    setSrc(null)
    const run = async () => {
      const minted = await fetchViewerTicket(presentationId)
      if (cancelled) return
      if (!minted) { timer = setTimeout(run, RETRY_MS); return }
      if (first) {
        first = false
        loadedSrc = withViewerTicket(baseUrl, minted.ticket)
        setSrc(loadedSrc)
      } else {
        postViewerTicket(findViewerFrame(loadedSrc), minted.ticket, baseUrl)
      }
      timer = setTimeout(run, renewDelayMs(minted.expiresIn))
    }
    void run()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [enabled, baseUrl, presentationId])

  return enabled ? src : baseUrl
}
