type ViewerIframe = Pick<HTMLIFrameElement, 'src' | 'contentWindow'>
type ViewerMessage = Pick<MessageEvent, 'origin' | 'source'>

/**
 * Resolve the origin of the viewer that is actually loaded in the iframe.
 *
 * Restored sessions can carry a viewer URL whose origin differs from the
 * environment's configured Layout Service origin. The iframe URL is therefore
 * authoritative for a loaded viewer; the configured origin is only a fallback
 * while the iframe has no usable src.
 */
export function getLayoutViewerOrigin(
  iframe: Pick<ViewerIframe, 'src'> | null,
  fallbackOrigin: string,
): string {
  if (!iframe?.src) return fallbackOrigin

  try {
    return new URL(iframe.src).origin
  } catch {
    return fallbackOrigin
  }
}

/**
 * Accept a viewer message only when both its origin and its Window source
 * match the currently loaded iframe.
 */
export function isTrustedLayoutViewerMessage(
  event: ViewerMessage,
  iframe: ViewerIframe | null,
  fallbackOrigin: string,
): boolean {
  const viewerWindow = iframe?.contentWindow
  if (!viewerWindow || event.source !== viewerWindow) return false

  return event.origin === getLayoutViewerOrigin(iframe, fallbackOrigin)
}
