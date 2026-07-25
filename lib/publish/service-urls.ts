// Backend service URLs for the publish feature, with a non-production guard.
//
// Every backend URL in this app is written as `process.env.X || <production
// default>`, which means a deployment that forgets to set X silently talks to
// PRODUCTION. That is merely confusing for read-only features, but publish
// WRITES: it creates snapshots (POST /snapshot) and deletes them (DELETE
// /api/presentations/{id}). A UAT run against the production Layout Service
// would create and delete presentations in production.
//
// Rule enforced here: a deployment may only fall back to a production backend
// if it *is* production. Production is identified by NEXT_PUBLIC_APP_URL —
// unset (legacy/production behaviour, unchanged) or an exact deckster.xyz
// origin. Any other deployment (e.g. the UAT Vercel project, which sets
// NEXT_PUBLIC_APP_URL=https://deckster-xyz-uat.vercel.app) must configure the
// service URLs explicitly, or publish fails loudly instead of touching prod.

const PROD_APP_ORIGINS = ['https://deckster.xyz', 'https://www.deckster.xyz']

export const PROD_LAYOUT_SERVICE_URL = 'https://web-production-f0d13.up.railway.app'
export const PROD_DOWNLOAD_SERVICE_URL = 'https://web-production-4908a.up.railway.app'

const trimTrailingSlash = (value: string) => value.trim().replace(/\/+$/, '')

/** Thrown when a non-production deployment has no explicit service URL. */
export class PublishServiceConfigError extends Error {
  constructor(varNames: string[], serviceLabel: string) {
    super(
      `${serviceLabel} is not configured for this deployment. Set ${varNames.join(' or ')} ` +
        `to the environment's own ${serviceLabel} (e.g. the UAT service URL). Refusing to fall ` +
        `back to the production service from a non-production deployment.`
    )
    this.name = 'PublishServiceConfigError'
  }
}

/**
 * Is this deployment production? NEXT_PUBLIC_APP_URL unset keeps the previous
 * behaviour so production (and local dev without the var) is unaffected.
 */
export function isProductionDeployment(): boolean {
  const appUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL || '')
  if (!appUrl) return true
  return PROD_APP_ORIGINS.includes(appUrl)
}

function resolve(
  configured: (string | undefined)[],
  prodFallback: string,
  varNames: string[],
  serviceLabel: string
): string {
  for (const value of configured) {
    if (value && value.trim()) return trimTrailingSlash(value)
  }
  if (isProductionDeployment()) return prodFallback
  throw new PublishServiceConfigError(varNames, serviceLabel)
}

/**
 * Server-side Layout Service origin for publish API routes (prefers the
 * server-only var, then the public one).
 */
export function getLayoutServiceBaseUrl(): string {
  return resolve(
    [process.env.LAYOUT_SERVICE_URL, process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL],
    PROD_LAYOUT_SERVICE_URL,
    ['LAYOUT_SERVICE_URL', 'NEXT_PUBLIC_LAYOUT_SERVICE_URL'],
    'Layout Service'
  )
}

/**
 * PUBLIC Layout origin — used for viewer iframe src and for the URL handed to
 * the Downloads service (which must be able to reach it itself).
 */
export function getPublicLayoutBaseUrl(): string {
  return resolve(
    [process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL],
    PROD_LAYOUT_SERVICE_URL,
    ['NEXT_PUBLIC_LAYOUT_SERVICE_URL'],
    'Layout Service'
  )
}

export function getDownloadServiceUrl(): string {
  return resolve(
    [process.env.NEXT_PUBLIC_DOWNLOAD_SERVICE_URL],
    PROD_DOWNLOAD_SERVICE_URL,
    ['NEXT_PUBLIC_DOWNLOAD_SERVICE_URL'],
    'Downloads Service'
  )
}
