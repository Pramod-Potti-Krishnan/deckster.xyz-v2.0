'use client'
/**
 * Client half of the Layout viewer ticket (program1/studio-flip-enablers): the React hooks only. Constants and pure helpers
 * stay in lib/studio-layout-viewer-ticket.ts, which server routes import, so no server route reaches React hooks.
 *
 * PL-46: a ticket is asked for with a scope. useLayoutViewerTicket(baseUrl, presentationId, scope) takes it explicitly ('edit' for the owner's
 * editing frame, 'view' for every other frame). A REFUSED answer (Layout's owner check: 403 for a deck that is not the person's or has no owner;
 * also 400, 401, 404) is never retried and never downgraded to another scope: the hook stops, the frame stays unloaded, and the person is told once
 * (a toast with a plain title and no body; the status goes to the console only), and the frame is CLEARED to about:blank (first mint or renewal: the same). A failure worth another try (network, 5xx, 408, 429) is retried as before and the frame keeps showing the current document. The same scope is used for every renewal.
 */
import { useEffect, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import {
  VIEWER_REFUSED_FRAME_SRC,
  VIEWER_TICKET_RETRY_MS as RETRY_MS,
  fetchViewerTicketOutcome,
  findViewerFrame,
  isStudioLayoutTicketEnabled,
  postViewerTicket,
  renewDelayMs,
  withViewerTicket,
  type ViewerTicketScope,
} from '@/lib/studio-layout-viewer-ticket'

/**
 * The iframe src to use, and the status Layout refused with (null when it did not). Flag off: `baseUrl` itself and no refusal. On: src is null until
 * the first ticket, then the ticketed URL (stable for this baseUrl/presentation/scope; renewals go by postMessage); after a refusal it is about:blank.
 */
export function useLayoutViewerTicket(
  baseUrl: string | null,
  presentationId: string | null | undefined,
  scope: ViewerTicketScope,
  options?: { notify?: boolean },
): { src: string | null; refusedStatus: number | null } {
  // PL-60: the person is told (a toast) when the EDITING frame is refused; a background view frame (a preview, a thumbnail) is not worth a toast each, so by default it is silent: the status is in the console only.
  const notify = options?.notify ?? scope === 'edit'
  const enabled = isStudioLayoutTicketEnabled()
  const [src, setSrc] = useState<string | null>(null)
  const [refusedStatus, setRefusedStatus] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled || !baseUrl || !presentationId) { setSrc(null); setRefusedStatus(null); return }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let first = true
    let loadedSrc: string | null = null
    setSrc(null)
    setRefusedStatus(null)
    const run = async () => {
      const outcome = await fetchViewerTicketOutcome(presentationId, scope)
      if (cancelled) return
      if (outcome.kind === 'refused') {
        // Layout's answer stands: no retry, no other scope. Tell the person once, in plain words: no service name, no status code (ARCH-PLATFORM 12:27Z);
        // the status stays in the console. No body line: a promise of viewing would be untrue, the frame stays unloaded.
        setSrc(VIEWER_REFUSED_FRAME_SRC) // the frame is CLEARED, at the first mint and at a renewal alike (ARCH-PLATFORM 13:18Z, REVIEW-CX P2): the page matches the words, no stale edit capability stays
        setRefusedStatus(outcome.status)
        console.warn(`[viewer-ticket] the ${scope} ticket was refused (${outcome.status}); not retrying`)
        if (notify) toast({
          title: scope === 'edit' ? "This deck can't be opened for editing." : "This deck can't be opened.",
          variant: 'destructive',
        })
        return
      }
      if (outcome.kind === 'transient') { timer = setTimeout(run, RETRY_MS); return }
      const minted = outcome.ticket
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
  }, [enabled, baseUrl, presentationId, scope, notify])

  return { src: enabled ? src : baseUrl, refusedStatus: enabled ? refusedStatus : null }
}

/**
 * THE EDITING FRAME'S hook (components/presentation-viewer.tsx, the one iframe of the Builder): the owner's editing frame asks for the 'edit' scope.
 * Every other frame must use useLayoutViewerTicket(baseUrl, presentationId, 'view') (scripts/test-studio-pl46-edit-scope.mjs pins that this is the only caller).
 */
export function useLayoutViewerTicketSrc(
  baseUrl: string | null,
  presentationId: string | null | undefined,
): string | null {
  return useLayoutViewerTicket(baseUrl, presentationId, 'edit').src
}
