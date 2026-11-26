'use client'
/**
 * PL-60: a Layout viewer iframe that asks for a VIEW ticket (NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED, default off). Every other frame of the Studio that shows a deck from Layout
 * (the rail's live preview, the Present view-only frame, the template workspace) uses this in place of a bare <iframe>; the Builder's editing frame is the one frame with the edit ticket
 * (useLayoutViewerTicketSrc). Flag off: exactly the iframe it replaces (same props, same attribute order). On: no frame until the ticket is minted, then the viewer URL with ?t=<ticket>,
 * renewed in place; a REFUSED ticket draws nothing (never a blank page over what the place shows otherwise) and is logged to the console, not toasted. A URL that is not a deck viewer
 * URL (no presentation id) loads as it is.
 */
import { forwardRef, useEffect, type ComponentPropsWithoutRef } from 'react'
import { LAYOUT_VIEWER_URL_POLICY } from '@/lib/layout-service-client'
import { useLayoutViewerTicket } from '@/lib/studio-layout-viewer-ticket-client'
import { approvedPresentationIdFromViewerUrl, isStudioLayoutTicketEnabled, presentationIdFromViewerUrl } from '@/lib/studio-layout-viewer-ticket'

/** The origin of a URL for the log line (never the URL itself: a query may carry a ticket). */
function safeOrigin(url: string): string {
  try { return new URL(url).origin } catch { return 'unparseable' }
}

type ViewTicketedIframeProps = Omit<ComponentPropsWithoutRef<'iframe'>, 'src'> & { src: string }

export const ViewTicketedIframe = forwardRef<HTMLIFrameElement, ViewTicketedIframeProps>(function ViewTicketedIframe({ src, ...rest }, ref) {
  // A ticket is attached, minted and renewed ONLY for a viewer URL on the Studio's approved Layout origins (REVIEW-CX P2); any other URL loads as it is, with no ticket and no request.
  const presentationId = approvedPresentationIdFromViewerUrl(src, LAYOUT_VIEWER_URL_POLICY)
  const unapproved = !presentationId && isStudioLayoutTicketEnabled() && presentationIdFromViewerUrl(src) !== null
  useEffect(() => {
    if (unapproved) console.warn(`[viewer-ticket] no view ticket: the viewer URL's origin (${safeOrigin(src)}) is not an approved Layout origin; the frame loads without one`)
  }, [unapproved, src])
  const { src: ticketed, refusedStatus } = useLayoutViewerTicket(src, presentationId, 'view')
  if (refusedStatus !== null) return null
  // PL-60 (REVIEW-CX P3): a frame still waiting for its FIRST ticket is not mounted at all. An iframe with no src fires `load` on its empty about:blank document, which the rail takes for "the viewer
  // has loaded" (it raises the frame's opacity), so the rail shows an empty frame; with no element there is no such load, and the frame mounts, with its ticketed src, when the ticket arrives.
  if (presentationId && ticketed === null) return null
  return <iframe ref={ref} src={presentationId ? ticketed ?? undefined : src} {...rest} />
})
