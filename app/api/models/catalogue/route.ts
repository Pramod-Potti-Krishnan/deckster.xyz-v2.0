import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { catalogueCallFailure, mapDirectorCatalogueResponse, parseCatalogueQuery } from '@/lib/studio-model-catalog'

export const dynamic = 'force-dynamic'

const DIRECTOR_TIMEOUT_MS = 15000

function directorBaseUrl(): string {
  return requireServiceUrl('Director', [{ name: 'DIRECTOR_API_URL', value: process.env.DIRECTOR_API_URL }], { stripTrailingSlash: true })
}

/**
 * GET /api/models/catalogue: the Intelligence page's "Models" section reads Director's read-only model catalogue through here, server side, so the browser never calls Director or the router
 * and Studio holds no router key (ruling MC). Behind NEXT_PUBLIC_STUDIO_MODEL_CATALOG (exact "true", default off): with it off this is not a route at all (404, before any session read or backend call).
 *
 * Signed-in people only. Forwards ONLY include_available (true | false), limit (a whole number from 1, reduced to 200) and offset (a whole number from 0), validated as Director validates
 * them and rebuilt here; any other parameter, a repeat or a bad value is a 400 and nothing is sent. Director answers GET /api/v1/models/catalogue with a subset of the router's catalogue (no
 * prices); its body is returned as it is. Its 503 (router not configured / unreachable, which is UAT's answer until the router URL and key are set) stays a 503 with service_unavailable: true,
 * its 502 and anything unexpected become a 502, in Studio's own words.
 */
export async function GET(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG !== 'true') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id || session?.user?.email
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = parseCatalogueQuery([...new URL(req.url).searchParams.entries()])
  if (!query.ok) return NextResponse.json({ error: query.error, code: query.code }, { status: 400 })

  try {
    const response = await fetch(`${directorBaseUrl()}/api/v1/models/catalogue${query.search}`, {
      method: 'GET',
      // TODO(entitlement): Director's REST reads need a signed `X-Deckster-Entitlement` header (minted for GET) once DIRECTOR_REST_ENTITLEMENT_READ_REQUIRED_ENABLED goes on. No Studio proxy sends
      // one yet, and Director does not check it today, so none is sent. When Studio gains the minting helper, add the header here (and nowhere else: nothing identifying the person goes with this request).
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(DIRECTOR_TIMEOUT_MS),
    })
    let body: unknown = null
    try { body = await response.json() } catch { body = null }
    const outcome = mapDirectorCatalogueResponse(response.status, body)
    return NextResponse.json(outcome.body, { status: outcome.status })
  } catch (error) {
    const failure = error instanceof ServiceUrlConfigError
      ? catalogueCallFailure('not-configured', error.code)
      : catalogueCallFailure(error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError') ? 'timeout' : 'unreachable')
    return NextResponse.json(failure.body, { status: failure.status })
  }
}
