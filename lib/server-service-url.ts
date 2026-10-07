/**
 * Server-side service-URL resolution for the API proxies (J8.0, R-20261007-frontend-22).
 *
 * Today every server proxy reads `process.env.X || <default>`, and the default is
 * either the PRODUCTION host or localhost. A deployment that forgets to set X
 * therefore talks to production without anyone noticing (CLAUDE.md gotcha #2).
 *
 * This module puts that behind ONE server flag, default off:
 *
 *   DECKSTER_SERVICE_URL_FAIL_CLOSED_ENABLED unset / not 'true'  (today)
 *     - resolves exactly like the old `a || b || default` chain, byte for byte;
 *     - the only addition is ONE console.warn per process per variable chain the
 *       first time a production/localhost default is actually used (variable
 *       names only, never a value).
 *
 *   DECKSTER_SERVICE_URL_FAIL_CLOSED_ENABLED=true
 *     - the default is never used. A missing variable throws ServiceUrlConfigError
 *       (lib/service-url.ts requireServiceUrl, copied from the Studio branch) and
 *       the route answers 503 `service_url_not_configured` without calling out.
 *
 * Pure and import-safe: no Next imports, no requests. Resolve at the action
 * boundary (inside the handler), never at module load, so `next build` is not
 * affected by a missing variable. The NextResponse mapping lives in
 * lib/service-url-response.ts.
 */
import {
  requireServiceUrl,
  type ServiceUrlCandidate,
  type ServiceUrlOptions,
} from '@/lib/service-url'

export const SERVICE_URL_FAIL_CLOSED_FLAG = 'DECKSTER_SERVICE_URL_FAIL_CLOSED_ENABLED'

/** Server-only flag (no NEXT_PUBLIC_ twin). Same `=== 'true'` convention as the repo's other flags. */
export function isServiceUrlFailClosedEnabled(): boolean {
  return process.env.DECKSTER_SERVICE_URL_FAIL_CLOSED_ENABLED === 'true'
}

export type ServiceUrlFallbackKind = 'production' | 'localhost'

export interface ServiceUrlFallback {
  value: string
  kind: ServiceUrlFallbackKind
}

// The defaults the proxies shipped with. Kept here (not removed) so flag-off stays identical.
export const DIRECTOR_PRODUCTION_URL = 'https://directorv33-production.up.railway.app'
export const DIRECTOR_LOCALHOST_URL = 'http://localhost:8000'
export const RESEARCHER_PRODUCTION_URL = 'https://researcher-v1.up.railway.app'
export const LAYOUT_PRODUCTION_URL = 'https://web-production-f0d13.up.railway.app'

const warned = new Set<string>()

/**
 * One log line per process per variable chain. Names only: never log a URL
 * value (a configured URL can carry a host that identifies the environment).
 */
export function warnServiceUrlFallbackOnce(
  serviceLabel: string,
  variableNames: readonly string[],
  kind: ServiceUrlFallbackKind,
): void {
  const key = `${serviceLabel}|${variableNames.join(',')}`
  if (warned.has(key)) return
  warned.add(key)
  console.warn(
    `[service-url] ${serviceLabel}: ${variableNames.join(' / ')} is not set; using the built-in ${kind} default. ` +
      `Set it explicitly and enable ${SERVICE_URL_FAIL_CLOSED_FLAG}=true to fail closed instead of falling back.`,
  )
}

/**
 * Flag off: the legacy `candidates[0] || candidates[1] || ... || fallback`
 * (first truthy value, returned untouched). Flag on: requireServiceUrl, which
 * throws ServiceUrlConfigError instead of ever using the fallback.
 */
export function resolveServiceUrl(
  serviceLabel: string,
  candidates: readonly ServiceUrlCandidate[],
  fallback: ServiceUrlFallback,
  options: ServiceUrlOptions = {},
): string {
  if (isServiceUrlFailClosedEnabled()) {
    return requireServiceUrl(serviceLabel, candidates, { stripTrailingSlash: true, ...options })
  }
  for (const candidate of candidates) {
    if (candidate.value) return candidate.value
  }
  warnServiceUrlFallbackOnce(serviceLabel, candidates.map(candidate => candidate.name), fallback.kind)
  return fallback.value
}

// ---------------------------------------------------------------------------
// One resolver per distinct variable chain, so the names live in one place.
// process.env.NEXT_PUBLIC_* must stay a literal read so Next can inline it.
// ---------------------------------------------------------------------------

/** templates / themes / ingest-jobs proxies. */
export const directorApiUrl = (): string =>
  resolveServiceUrl(
    'Director',
    [{ name: 'DIRECTOR_API_URL', value: process.env.DIRECTOR_API_URL }],
    { value: DIRECTOR_PRODUCTION_URL, kind: 'production' },
  )

/** Session handoff proxy (accepts the public name as an alias). */
export const directorHandoffUrl = (): string =>
  resolveServiceUrl(
    'Director',
    [
      { name: 'DIRECTOR_API_URL', value: process.env.DIRECTOR_API_URL },
      { name: 'NEXT_PUBLIC_DIRECTOR_API_URL', value: process.env.NEXT_PUBLIC_DIRECTOR_API_URL },
    ],
    { value: DIRECTOR_PRODUCTION_URL, kind: 'production' },
  )

/** Slide Composer compose / refine / jobs proxies (the only chain that defaulted to localhost). */
export const slideComposerDirectorUrl = (): string =>
  resolveServiceUrl(
    'Slide Composer Director',
    [
      { name: 'SLIDE_COMPOSER_DIRECTOR_URL', value: process.env.SLIDE_COMPOSER_DIRECTOR_URL },
      { name: 'DIRECTOR_API_URL', value: process.env.DIRECTOR_API_URL },
      { name: 'NEXT_PUBLIC_DIRECTOR_API_URL', value: process.env.NEXT_PUBLIC_DIRECTOR_API_URL },
    ],
    { value: DIRECTOR_LOCALHOST_URL, kind: 'localhost' },
  )

/** /api/knowledge-graph/* proxies (lib/kg-proxy.ts). */
export const knowledgeGraphUrl = (): string =>
  resolveServiceUrl(
    'Knowledge Service',
    [{ name: 'KNOWLEDGE_SERVICE_URL', value: process.env.KNOWLEDGE_SERVICE_URL }],
    { value: RESEARCHER_PRODUCTION_URL, kind: 'production' },
  )

/** /api/upload via lib/knowledge-service-client.ts (same chain as lib/config.ts knowledgeServiceUrl). */
export const knowledgeUploadUrl = (): string =>
  resolveServiceUrl(
    'Knowledge Service',
    [
      { name: 'NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL', value: process.env.NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL },
      { name: 'KNOWLEDGE_SERVICE_URL', value: process.env.KNOWLEDGE_SERVICE_URL },
    ],
    { value: RESEARCHER_PRODUCTION_URL, kind: 'production' },
  )

/**
 * Server presence check for the Layout Service URL that lib/layout-service-client.ts
 * bakes in at build (NEXT_PUBLIC_LAYOUT_SERVICE_URL || production). The returned
 * URL is not used to call anything: the narration routes keep using the module
 * constant, so flag-off request behaviour is untouched. Flag on + unset throws.
 */
export const layoutServiceCheck = (): string =>
  resolveServiceUrl(
    'Layout Service',
    [{ name: 'NEXT_PUBLIC_LAYOUT_SERVICE_URL', value: process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL }],
    { value: LAYOUT_PRODUCTION_URL, kind: 'production' },
  )
