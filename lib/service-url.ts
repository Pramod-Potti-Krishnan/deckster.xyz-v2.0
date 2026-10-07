/** Explicit service configuration only. Pure/import-safe; performs no requests. */
export type ServiceUrlProtocol = 'http:' | 'https:' | 'ws:' | 'wss:'
export interface ServiceUrlCandidate {
  name: string
  value: string | null | undefined
}
export interface ServiceUrlOptions {
  protocols?: readonly ServiceUrlProtocol[]
  stripTrailingSlash?: boolean
  urlType?: 'base' | 'endpoint'
}
export type ServiceUrlErrorCode = 'SERVICE_URL_NOT_CONFIGURED' | 'SERVICE_URL_INVALID'

/** Messages identify configuration names, never configured URLs or credentials. */
export class ServiceUrlConfigError extends Error {
  readonly code: ServiceUrlErrorCode
  readonly serviceLabel: string
  readonly variableNames: readonly string[]

  constructor(serviceLabel: string, variableNames: readonly string[], reason: 'missing' | 'invalid' = 'missing') {
    const names = variableNames.join(' or ')
    super(reason === 'missing'
      ? `${serviceLabel} is not configured. Set ${names} before using this service.`
      : `${serviceLabel} has an invalid service URL in ${names}. Configure an absolute URL with the required protocol before using this service.`)
    this.name = 'ServiceUrlConfigError'
    this.code = reason === 'missing' ? 'SERVICE_URL_NOT_CONFIGURED' : 'SERVICE_URL_INVALID'
    this.serviceLabel = serviceLabel
    this.variableNames = [...variableNames]
  }
}

/**
 * Call at the action boundary, before constructing a request/iframe/socket URL.
 * Supply explicit process.env.NAME reads here so Next can inline public values.
 * Blank aliases are absent; an invalid selected alias never chooses another host.
 */
export function requireServiceUrl(
  serviceLabel: string,
  candidates: readonly ServiceUrlCandidate[],
  options: ServiceUrlOptions = {},
): string {
  const selected = candidates.find(candidate => candidate.value != null &&
    (typeof candidate.value !== 'string' || candidate.value.trim() !== ''))
  if (!selected) throw new ServiceUrlConfigError(serviceLabel, candidates.map(candidate => candidate.name))
  const protocols = options.protocols ?? ['http:', 'https:']
  const value = typeof selected.value === 'string' ? selected.value.trim() : ''
  let parsed: URL
  try {
    // URL() alone accepts implicit forms such as https:host and removes controls.
    if (!/^[a-z][a-z\d+.-]*:\/\/[^/]/i.test(value) || /[\u0000-\u0020\u007f]/.test(value) || value.includes('\\')) throw new Error('Invalid URL form')
    parsed = new URL(value)
    if (!parsed.hostname || !protocols.includes(parsed.protocol as ServiceUrlProtocol)) throw new Error('Invalid protocol or hostname')
    const urlType = options.urlType ?? (parsed.protocol === 'ws:' || parsed.protocol === 'wss:' ? 'endpoint' : 'base')
    if (parsed.username || parsed.password || value.includes('#') || (urlType === 'base' && value.includes('?'))) throw new Error('Invalid service URL base or credentials')
  } catch {
    throw new ServiceUrlConfigError(serviceLabel, [selected.name], 'invalid')
  }
  // Preserve explicit paths/query strings/case. Opt-in normalization is only for
  // existing base-URL callers; never trim a slash inside a query or fragment.
  return options.stripTrailingSlash && !value.includes('?') && !value.includes('#') ? value.replace(/\/+$/, '') : value
}

/** Import-safe introspection. This does not authorize an action using url ?? ''. */
export function inspectServiceUrl(
  serviceLabel: string,
  candidates: readonly ServiceUrlCandidate[],
  options: ServiceUrlOptions = {},
): { url: string | null; error: ServiceUrlConfigError | null } {
  try {
    return { url: requireServiceUrl(serviceLabel, candidates, options), error: null }
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return { url: null, error }
    throw error
  }
}
