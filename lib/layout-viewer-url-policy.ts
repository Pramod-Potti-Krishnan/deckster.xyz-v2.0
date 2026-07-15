export type LayoutViewerUrlField =
  | 'presentationUrl'
  | 'blankPresentationUrl'
  | 'strawmanPreviewUrl'
  | 'finalPresentationUrl'

export type LayoutViewerUrlBlockReason =
  | 'invalid_url'
  | 'unsupported_protocol'
  | 'credentials_not_allowed'
  | 'unapproved_origin'

export interface LayoutViewerUrlPolicy {
  configuredOrigin: string | null
  allowedOrigins: readonly string[]
}

export type LayoutViewerUrlDecision =
  | { status: 'empty'; url: null; origin: null }
  | { status: 'allowed'; url: string; origin: string }
  | {
      status: 'blocked'
      origin: string | null
      reason: LayoutViewerUrlBlockReason
    }

export type LayoutViewerUrlIngressDecision =
  | { status: 'empty'; url: null; presentationId: null; origin: null }
  | { status: 'allowed'; url: string; presentationId: string | null; origin: string }
  | {
      status: 'blocked'
      url: null
      presentationId: null
      origin: string | null
      reason: LayoutViewerUrlBlockReason
    }

export interface RestoredLayoutViewerUrls {
  presentationUrl?: string | null
  presentationId?: string | null
  blankPresentationUrl?: string | null
  blankPresentationId?: string | null
  strawmanPreviewUrl?: string | null
  strawmanPresentationId?: string | null
  finalPresentationUrl?: string | null
  finalPresentationId?: string | null
}

export interface BlockedRestoredLayoutViewerUrl {
  field: LayoutViewerUrlField
  origin: string | null
  reason: LayoutViewerUrlBlockReason
}

const RESTORED_URL_FIELDS: ReadonlyArray<{
  urlField: LayoutViewerUrlField
  idField: keyof RestoredLayoutViewerUrls
}> = [
  { urlField: 'presentationUrl', idField: 'presentationId' },
  { urlField: 'blankPresentationUrl', idField: 'blankPresentationId' },
  { urlField: 'strawmanPreviewUrl', idField: 'strawmanPresentationId' },
  { urlField: 'finalPresentationUrl', idField: 'finalPresentationId' },
]

function parseHttpOrigin(value: string): string | null {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    if (parsed.username || parsed.password) return null
    return parsed.origin
  } catch {
    return null
  }
}

/**
 * Build the exact-origin allowlist for Layout viewer iframes.
 *
 * The environment's configured Layout Service is always the primary approved
 * origin. Extra origins must be explicitly listed; this is useful for a
 * controlled migration, but UAT must not list the production Layout origin.
 */
export function createLayoutViewerUrlPolicy(
  configuredLayoutServiceUrl: string,
  additionalAllowedOrigins: string | readonly string[] = [],
): LayoutViewerUrlPolicy {
  const configuredOrigin = parseHttpOrigin(configuredLayoutServiceUrl)
  const additions = typeof additionalAllowedOrigins === 'string'
    ? additionalAllowedOrigins.split(',')
    : additionalAllowedOrigins

  const allowedOrigins = new Set<string>()
  if (configuredOrigin) allowedOrigins.add(configuredOrigin)

  for (const value of additions) {
    const origin = parseHttpOrigin(value.trim())
    if (origin) allowedOrigins.add(origin)
  }

  return {
    configuredOrigin,
    allowedOrigins: Array.from(allowedOrigins),
  }
}

export function evaluateLayoutViewerUrl(
  value: string | null | undefined,
  policy: LayoutViewerUrlPolicy,
): LayoutViewerUrlDecision {
  if (!value) return { status: 'empty', url: null, origin: null }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { status: 'blocked', origin: null, reason: 'invalid_url' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      status: 'blocked',
      origin: parsed.origin === 'null' ? null : parsed.origin,
      reason: 'unsupported_protocol',
    }
  }

  if (parsed.username || parsed.password) {
    return {
      status: 'blocked',
      origin: parsed.origin,
      reason: 'credentials_not_allowed',
    }
  }

  if (!policy.allowedOrigins.includes(parsed.origin)) {
    return {
      status: 'blocked',
      origin: parsed.origin,
      reason: 'unapproved_origin',
    }
  }

  return { status: 'allowed', url: value, origin: parsed.origin }
}

/**
 * Gate a URL and its paired presentation id as one unit. A rejected or missing
 * URL always clears the id so downstream state cannot target the configured
 * Layout API with an id produced by another environment.
 */
export function gateLayoutViewerUrlIngress(
  value: string | null | undefined,
  presentationId: string | null | undefined,
  policy: LayoutViewerUrlPolicy,
): LayoutViewerUrlIngressDecision {
  const decision = evaluateLayoutViewerUrl(value, policy)
  if (decision.status === 'allowed') {
    return {
      status: 'allowed',
      url: decision.url,
      presentationId: presentationId || null,
      origin: decision.origin,
    }
  }
  if (decision.status === 'empty') {
    return { status: 'empty', url: null, presentationId: null, origin: null }
  }
  return {
    status: 'blocked',
    url: null,
    presentationId: null,
    origin: decision.origin,
    reason: decision.reason,
  }
}

/**
 * Fail closed when restoring viewer URLs from sessionStorage or the database.
 * URLs and paired ids are cleared so later code cannot accidentally embed a
 * foreign viewer or target the configured Layout API with a foreign id.
 */
export function sanitizeRestoredLayoutViewerUrls<T extends RestoredLayoutViewerUrls>(
  restoredState: T,
  policy: LayoutViewerUrlPolicy,
): { state: T; blocked: BlockedRestoredLayoutViewerUrl[] } {
  const state = { ...restoredState }
  const writableState = state as Record<string, unknown>
  const blocked: BlockedRestoredLayoutViewerUrl[] = []

  for (const { urlField, idField } of RESTORED_URL_FIELDS) {
    const decision = evaluateLayoutViewerUrl(restoredState[urlField], policy)
    if (decision.status !== 'blocked') continue

    writableState[urlField] = null
    writableState[idField] = null
    blocked.push({
      field: urlField,
      origin: decision.origin,
      reason: decision.reason,
    })
  }

  return { state, blocked }
}
