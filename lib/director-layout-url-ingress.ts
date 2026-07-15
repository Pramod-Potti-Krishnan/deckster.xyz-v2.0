import {
  gateLayoutViewerUrlIngress,
  type LayoutViewerUrlIngressDecision,
  type LayoutViewerUrlPolicy,
} from './layout-viewer-url-policy'

export type DirectorLayoutUrlKind = 'sync_final' | 'final' | 'blank' | 'strawman' | 'slide_ready'

export interface GuardedDirectorLayoutUrlMessage<TMessage> {
  message: TMessage
  ingress: (LayoutViewerUrlIngressDecision & {
    kind: DirectorLayoutUrlKind
    field: string
  }) | null
}

function clearPresentationFields(payload: Record<string, any>): Record<string, any> {
  return {
    ...payload,
    url: null,
    presentation_url: null,
    preview_url: null,
    presentation_id: null,
    preview_presentation_id: null,
    metadata: payload.metadata ? {
      ...payload.metadata,
      presentation_url: null,
      preview_url: null,
      presentation_id: null,
      preview_presentation_id: null,
    } : payload.metadata,
    strawman: payload.strawman ? {
      ...payload.strawman,
      preview_url: null,
      preview_presentation_id: null,
    } : payload.strawman,
  }
}

/**
 * Validate every Director frame that can introduce a Layout viewer URL before
 * it is stored, persisted, or forwarded to callbacks. Rejected frames retain
 * their non-URL content, but all known URL/id aliases are redacted.
 */
export function guardDirectorLayoutUrlMessage<
  TMessage extends { type: string; payload: Record<string, any> },
>(
  message: TMessage,
  policy: LayoutViewerUrlPolicy,
): GuardedDirectorLayoutUrlMessage<TMessage> {
  const payload = message.payload || {}
  let kind: DirectorLayoutUrlKind | null = null
  let field = ''
  let url: string | null | undefined
  let presentationId: string | null | undefined

  switch (message.type) {
    case 'sync_response':
      kind = 'sync_final'
      field = 'payload.presentation_url'
      url = payload.presentation_url
      presentationId = payload.presentation_id
      break
    case 'presentation_url':
      kind = 'final'
      field = 'payload.url'
      url = payload.url
      presentationId = payload.presentation_id
      break
    case 'presentation_init':
      kind = 'blank'
      field = 'payload.presentation_url'
      url = payload.presentation_url
        || payload.preview_url
        || payload.url
        || payload.metadata?.preview_url
        || payload.metadata?.presentation_url
      presentationId = payload.presentation_id
        || payload.preview_presentation_id
        || payload.metadata?.preview_presentation_id
        || payload.metadata?.presentation_id
      break
    case 'slide_update':
      kind = payload.is_blank ? 'blank' : 'strawman'
      field = 'payload.preview_url'
      url = payload.preview_url
        || payload.metadata?.preview_url
        || payload.strawman?.preview_url
        || payload.url
      presentationId = payload.metadata?.preview_presentation_id
        || payload.preview_presentation_id
        || payload.strawman?.preview_presentation_id
        || payload.presentation_id
      break
    case 'slide_ready':
      if (!payload.presentation_url) return { message, ingress: null }
      kind = 'slide_ready'
      field = 'payload.presentation_url'
      url = payload.presentation_url
      presentationId = payload.presentation_id
      break
    default:
      return { message, ingress: null }
  }

  if (!kind) return { message, ingress: null }

  const decision = gateLayoutViewerUrlIngress(url, presentationId, policy)
  const ingress = { ...decision, kind, field }
  if (decision.status === 'allowed') return { message, ingress }

  return {
    message: {
      ...message,
      payload: clearPresentationFields(payload),
    },
    ingress,
  }
}
