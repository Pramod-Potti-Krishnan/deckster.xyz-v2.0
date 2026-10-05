/** Backend service bases for publish: explicit configuration in every deployment. */
import { requireServiceUrl, ServiceUrlConfigError, type ServiceUrlCandidate } from '@/lib/service-url'

const PROD_APP_ORIGINS = ['https://deckster.xyz', 'https://www.deckster.xyz']

/** @deprecated Historical reference exports only. Never used as resolver defaults. */
export const PROD_LAYOUT_SERVICE_URL = 'https://web-production-f0d13.up.railway.app'
/** @deprecated Historical reference exports only. Never used as resolver defaults. */
export const PROD_DOWNLOAD_SERVICE_URL = 'https://web-production-4908a.up.railway.app'
/** @deprecated Historical reference exports only. Never used as resolver defaults. */
export const PROD_RESEARCHER_URL = 'https://researcher-v1.up.railway.app'

/** Existing exported error type retained; all deployments require explicit URLs. */
export class PublishServiceConfigError extends ServiceUrlConfigError {
  constructor(varNames: string[], serviceLabel: string, reason: 'missing' | 'invalid' = 'missing') {
    super(serviceLabel, varNames, reason)
    this.name = 'PublishServiceConfigError'
  }
}

/** Deployment classification only; this never authorizes a backend fallback. */
export function isProductionDeployment(): boolean {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '')
  return PROD_APP_ORIGINS.includes(appUrl)
}

function resolve(candidates: readonly ServiceUrlCandidate[], serviceLabel: string): string {
  try {
    return requireServiceUrl(serviceLabel, candidates, { stripTrailingSlash: true })
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) {
      throw new PublishServiceConfigError([...error.variableNames], serviceLabel,
        error.code === 'SERVICE_URL_INVALID' ? 'invalid' : 'missing')
    }
    throw error
  }
}

/** Server-only alias first, public alias second; neither is a default. */
export function getLayoutServiceBaseUrl(): string {
  return resolve([
    { name: 'LAYOUT_SERVICE_URL', value: process.env.LAYOUT_SERVICE_URL },
    { name: 'NEXT_PUBLIC_LAYOUT_SERVICE_URL', value: process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL },
  ], 'Layout Service')
}

/** Public base used by iframe/download consumers; never substitutes server-only config. */
export function getPublicLayoutBaseUrl(): string {
  return resolve([
    { name: 'NEXT_PUBLIC_LAYOUT_SERVICE_URL', value: process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL },
  ], 'Layout Service')
}

export function getDownloadServiceUrl(): string {
  return resolve([
    { name: 'NEXT_PUBLIC_DOWNLOAD_SERVICE_URL', value: process.env.NEXT_PUBLIC_DOWNLOAD_SERVICE_URL },
  ], 'Downloads Service')
}

export function getResearcherBaseUrl(): string {
  return resolve([
    { name: 'RESEARCHER_SERVICE_URL', value: process.env.RESEARCHER_SERVICE_URL },
    { name: 'KNOWLEDGE_SERVICE_URL', value: process.env.KNOWLEDGE_SERVICE_URL },
  ], 'Researcher Service')
}
