'use client'
/**
 * Client half of the Layout viewer ticket (program1/studio-flip-enablers): the React hook only. Constants and pure helpers
 * stay in lib/studio-layout-viewer-ticket.ts, which server routes import, so no server route reaches React hooks.
 */
import { useEffect, useState } from 'react'
import {
  VIEWER_TICKET_RETRY_MS as RETRY_MS,
  fetchViewerTicket,
  findViewerFrame,
  isStudioLayoutTicketEnabled,
  postViewerTicket,
  renewDelayMs,
  withViewerTicket,
} from '@/lib/studio-layout-viewer-ticket'

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
