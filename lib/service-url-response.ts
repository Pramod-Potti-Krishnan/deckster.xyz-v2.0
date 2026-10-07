/**
 * Route-facing wrappers over lib/server-service-url.ts (J8.0, R-20261007-frontend-22).
 *
 * Call one at the top of a handler, after auth/validation and before the first
 * outbound request, in the same `{ ...; error }` shape lib/kg-proxy.ts uses:
 *
 *   const director = directorApiUrlOrResponse()
 *   if (director.error) return director.error
 *   const DIRECTOR_API_URL = director.url
 *
 * With DECKSTER_SERVICE_URL_FAIL_CLOSED_ENABLED off these never return an error,
 * so a handler behaves exactly as it did before. With it on, a missing or invalid
 * variable becomes a 503 `service_url_not_configured` (or `service_url_invalid`)
 * naming the variables, never their values, and the handler never reaches fetch.
 */
import { NextResponse } from 'next/server'
import { ServiceUrlConfigError } from '@/lib/service-url'
import {
  directorApiUrl,
  directorHandoffUrl,
  knowledgeGraphUrl,
  knowledgeUploadUrl,
  layoutServiceCheck,
  slideComposerDirectorUrl,
} from '@/lib/server-service-url'

export type ServiceUrlOrResponse =
  | { url: string; error?: undefined }
  | { url?: undefined; error: NextResponse }

/** 503 body for a ServiceUrlConfigError. Names only; never a configured value. */
export function serviceUrlErrorResponse(
  error: ServiceUrlConfigError,
  extra: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json(
    {
      error: error.code === 'SERVICE_URL_NOT_CONFIGURED' ? 'service_url_not_configured' : 'service_url_invalid',
      code: error.code,
      message: error.message,
      service: error.serviceLabel,
      variables: error.variableNames,
      ...extra,
    },
    { status: 503 },
  )
}

function guard(
  resolve: () => string,
  extra: (error: ServiceUrlConfigError) => Record<string, unknown> = () => ({}),
): ServiceUrlOrResponse {
  try {
    return { url: resolve() }
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return { error: serviceUrlErrorResponse(error, extra(error)) }
    throw error
  }
}

export const directorApiUrlOrResponse = (): ServiceUrlOrResponse => guard(directorApiUrl)

export const directorHandoffUrlOrResponse = (): ServiceUrlOrResponse => guard(directorHandoffUrl)

/** Slide Composer routes answer with their `{ status, stage, errors }` envelope as well. */
export const slideComposerDirectorUrlOrResponse = (): ServiceUrlOrResponse =>
  guard(slideComposerDirectorUrl, error => ({ status: 'error', stage: 'proxy', errors: [error.message] }))

/** The KG UI already understands `service_unavailable: true` on a 503. */
export const knowledgeGraphUrlOrResponse = (): ServiceUrlOrResponse =>
  guard(knowledgeGraphUrl, () => ({ service_unavailable: true }))

export const knowledgeUploadUrlOrResponse = (): ServiceUrlOrResponse => guard(knowledgeUploadUrl)

/** Presence check only (see layoutServiceCheck): null means carry on. */
export function layoutServiceGuardResponse(): NextResponse | null {
  const checked = guard(layoutServiceCheck)
  return checked.error ?? null
}
