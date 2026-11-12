import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { requireApprovedUser } from '@/lib/api-hardening'
import { restEntitlementHeaders } from '@/lib/director-rest-entitlement'
import {
  BRAND_RECORD_MAX_BODY_BYTES,
  brandRecordIsEmpty,
  classifyDirectorBrandError,
  isStudioBrandKitEnabled,
  readBrandResponse,
  validateBrandRecord,
  type BrandApiCode,
} from '@/lib/studio-brand-kit'

export const dynamic = 'force-dynamic'

// BRAND KIT RECORD PROXY (flag NEXT_PUBLIC_STUDIO_BRAND_KIT, exact "true", default off; spec streams/pass5/BRAND-KIT-CALLER.md BK-C12, BK-C14, BK-C15, BK-C19). GET and PUT /api/themes/{id}/brand to Director's
// GET and PUT /api/users/{user}/themes/{id}/brand (Director !628 / !673, DIRECTOR_BRAND_KIT_ENABLED; the routes are not in Director's OpenAPI). With the flag off this route does not exist: 404 before the session is read,
// the database is asked or Director is called.
//   - the user in the Director path is the signed-in session's own id (or e-mail), exactly as the other theme proxies; a browser can name a theme, never a user;
//   - every call is signed with X-Deckster-Entitlement (the existing helper, the same user id, the method of THIS call: GET for a read, PUT for a write), minted here per request. Director's brand routes refuse an unsigned
//     call, so it must be on when the brand kit is (DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED "true" and DIRECTOR_WS_AUTH_SECRET);
//   - a PUT REPLACES the whole record, so the body is checked here (only Director's six keys, https logo link, the length limits, the eight catalog fonts) and an EMPTY record is refused unless the call says ?clear=1: an
//     empty extraction or a form with nothing in it can never clear a kit by accident;
//   - Director's refusals come back as Studio codes (BK-C15), never as Director's text; nothing is cached.
const NO_STORE = { 'Cache-Control': 'no-store' }

function directorBaseUrl(): string {
  return requireServiceUrl('Director', [{ name: 'DIRECTOR_API_URL', value: process.env.DIRECTOR_API_URL }])
}

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email
  return uid ?? null
}

const refuse = (status: number, code: BrandApiCode, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error: code, code, ...extra }, { status, headers: NO_STORE })

/** Director's answer, as Studio's: { id, brand } on success, else the classified refusal. */
async function answer(r: Response): Promise<NextResponse> {
  let body: unknown = null
  try {
    body = await r.json()
  } catch {
    body = null
  }
  if (r.ok) {
    const read = readBrandResponse(body)
    return read ? NextResponse.json(read, { status: 200, headers: NO_STORE }) : refuse(502, 'director_error')
  }
  const classified = classifyDirectorBrandError(r.status, body)
  return refuse(classified.status, classified.code, { retryable: classified.retryable })
}

function failed(error: unknown): NextResponse {
  if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code }, { status: 503, headers: NO_STORE })
  return refuse(502, 'director_unreachable')
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isStudioBrandKitEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const userId = await resolveUserId()
  if (!userId) return refuse(401, 'signin')
  const { id } = await context.params
  try {
    const r = await fetch(
      `${directorBaseUrl()}/api/users/${encodeURIComponent(userId)}/themes/${encodeURIComponent(id)}/brand`,
      { cache: 'no-store', headers: restEntitlementHeaders(userId, 'GET') },
    )
    return await answer(r)
  } catch (error) {
    return failed(error)
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isStudioBrandKitEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.
  const notApproved = await requireApprovedUser()
  if (notApproved) return notApproved
  const userId = await resolveUserId()
  if (!userId) return refuse(401, 'signin')
  const { id } = await context.params
  let text: string
  try {
    text = await req.text()
  } catch {
    return refuse(400, 'bad_request')
  }
  if (Buffer.byteLength(text, 'utf8') > BRAND_RECORD_MAX_BODY_BYTES) return refuse(413, 'too_large') // bytes, not UTF-16 units (a body of accented text is longer in bytes than it reads)
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    return refuse(400, 'bad_request')
  }
  const checked = validateBrandRecord(payload)
  if (!checked.ok) return refuse(422, 'invalid_brand', { field: checked.field })
  if (brandRecordIsEmpty(checked.record) && new URL(req.url).searchParams.get('clear') !== '1') return refuse(400, 'clear_refused')
  try {
    const r = await fetch(
      `${directorBaseUrl()}/api/users/${encodeURIComponent(userId)}/themes/${encodeURIComponent(id)}/brand`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...restEntitlementHeaders(userId, 'PUT') },
        body: JSON.stringify(checked.record),
      },
    )
    return await answer(r)
  } catch (error) {
    return failed(error)
  }
}
