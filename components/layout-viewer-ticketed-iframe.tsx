'use client'
/**
 * PL-60: a Layout viewer iframe that asks for a VIEW ticket (NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED, default off). Every other frame of the Studio that shows a deck from Layout
 * (the rail's live preview, the Present view-only frame, the template workspace) uses this in place of a bare <iframe>; the Builder's editing frame is the one frame with the edit ticket
 * (useLayoutViewerTicketSrc). Flag off: exactly the iframe it replaces (same props, same attribute order). On: no src until the ticket is minted, then the viewer URL with ?t=<ticket>,
 * renewed in place; a REFUSED ticket draws nothing (never a blank page over what the place shows otherwise) and is logged to the console, not toasted. A URL that is not a deck viewer
 * URL (no presentation id) loads as it is.
 */
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { useLayoutViewerTicket } from '@/lib/studio-layout-viewer-ticket-client'
import { presentationIdFromViewerUrl } from '@/lib/studio-layout-viewer-ticket'

type ViewTicketedIframeProps = Omit<ComponentPropsWithoutRef<'iframe'>, 'src'> & { src: string }

export const ViewTicketedIframe = forwardRef<HTMLIFrameElement, ViewTicketedIframeProps>(function ViewTicketedIframe({ src, ...rest }, ref) {
  const presentationId = presentationIdFromViewerUrl(src)
  const { src: ticketed, refusedStatus } = useLayoutViewerTicket(src, presentationId, 'view')
  if (refusedStatus !== null) return null
  return <iframe ref={ref} src={presentationId ? ticketed ?? undefined : src} {...rest} />
})
