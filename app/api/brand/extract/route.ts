import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { requireApprovedUser } from '@/lib/api-hardening'
import { getThemeBuilderUrl } from '@/lib/config'
import { ServiceUrlConfigError } from '@/lib/service-url'
import {
  BRAND_EXTRACT_MAX_BYTES,
  BRAND_EXTRACT_MIME_TYPES,
  BRAND_EXTRACT_TIMEOUT_MS,
  isStudioBrandKitEnabled,
  parseBrandExtract,
  sniffBrandImageMime,
  type BrandExtractCode,
} from '@/lib/studio-brand-kit'
import { takeBrandExtractSlot } from '@/lib/studio-brand-kit-server'

export const dynamic = 'force-dynamic'
// BK-C5: the route outlasts Theme Builder's worst case (30 s upload read + 30 s vision deadline), so it may run past the default limit.
export const maxDuration = 90

// BRAND KIT EXTRACT (flag NEXT_PUBLIC_STUDIO_BRAND_KIT, exact "true", default off; spec streams/pass5/BRAND-KIT-CALLER.md BK-C4, BK-C5, BK-C8, BK-C9). With the flag off this route does not exist: 404 before the session is read, the database
// is asked, the key is read or Theme Builder is called. On, it is the ONLY caller of Theme Builder's POST /api/theme/v2/brand-extract (the browser never calls it: Theme Builder allows any origin and trusts one server-only key).
//   - signed in, and an approved user when STUDIO_API_HARDENING_V1_ENABLED is on;
//   - the key is THEME_BUILDER_BRAND_EXTRACT_KEY (server only, never NEXT_PUBLIC_, never logged, never sent to the browser); the one request carries Content-Type and X-API-Key and nothing else the browser sent (no cookies, no
//     attribution headers: only a verified token-mode identity is attributed by Theme Builder, and Studio sends none);
//   - the body is the raw PNG or JPEG bytes (not multipart, not base64), at most 4 MiB, and its first bytes must say it is what its Content-Type says: a bad file is refused here, before anything is counted or paid;
//   - one request is one paid call: a per-person daily cap (STUDIO_BRAND_EXTRACT_DAILY_CAP, default 10, counted before the call and failing closed), no retry, redirects refused, a fetch timeout above Theme Builder's worst case;
//   - the answer is Theme Builder's own preview, cleaned (lib/studio-brand-kit.ts parseBrandExtract), with Cache-Control: no-store; every failure is a fixed Studio sentence, never Theme Builder's text.
const NO_STORE = { 'Cache-Control': 'no-store' }

const fail = (status: number, code: BrandExtractCode | 'bad_request', extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error: code, code, ...extra }, { status, headers: NO_STORE })

async function sessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email
  return uid ?? null
}

/** The body, read at most up to the cap (the stream is cancelled when it goes over), or null when it is over. */
async function readBounded(req: NextRequest): Promise<Uint8Array | null> {
  const reader = req.body?.getReader()
  if (!reader) return new Uint8Array(0)
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    total += chunk.value.byteLength
    if (total > BRAND_EXTRACT_MAX_BYTES) { await reader.cancel(); return null }
    chunks.push(chunk.value)
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.byteLength }
  return out
}

export async function POST(req: NextRequest) {
  if (!isStudioBrandKitEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const userId = await sessionUserId()
  if (!userId) return fail(401, 'signin')
  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.
  const notApproved = await requireApprovedUser()
  if (notApproved) return notApproved

  const key = process.env.THEME_BUILDER_BRAND_EXTRACT_KEY
  if (!key) return fail(503, 'unconfigured')
  let endpoint: string
  try {
    endpoint = `${getThemeBuilderUrl().replace(/\/+$/, '')}/api/theme/v2/brand-extract`
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code }, { status: 503, headers: NO_STORE })
    return fail(503, 'unavailable')
  }

  // exactly one Content-Type, exactly image/png or image/jpeg (no parameters): what Theme Builder requires, checked before anything is read
  const types = req.headers.get('content-type')
  const mime = BRAND_EXTRACT_MIME_TYPES.find(candidate => candidate === (types ?? '').trim().toLowerCase())
  if (!mime) return fail(415, 'type')
  const declared = req.headers.get('content-length')
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > BRAND_EXTRACT_MAX_BYTES)) return fail(413, 'size')

  let bytes: Uint8Array | null
  try {
    bytes = await readBounded(req)
  } catch {
    return fail(400, 'unreadable')
  }
  if (bytes === null) return fail(413, 'size')
  if (bytes.byteLength === 0) return fail(400, 'empty')
  if (sniffBrandImageMime(bytes) !== mime) return fail(415, 'type')

  // one more paid call for this person today? counted BEFORE the call (any outcome may have reached the model); unreadable count = no call
  const slot = await takeBrandExtractSlot(userId)
  if (slot === 'cap') return fail(429, 'cap')
  if (slot === 'unavailable') return fail(503, 'unavailable')

  let upstream: Response
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': mime, 'X-API-Key': key },
      body: bytes as unknown as BodyInit,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(BRAND_EXTRACT_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    console.error(`[brand-extract] Theme Builder ${timedOut ? 'timed out' : 'unreachable'}`)
    return timedOut ? fail(504, 'timeout') : fail(502, 'failed', { upstream: 'theme_builder_unreachable' })
  }

  if (upstream.status === 200) {
    let parsed: ReturnType<typeof parseBrandExtract> = null
    try {
      parsed = parseBrandExtract(await upstream.json())
    } catch {
      parsed = null
    }
    if (!parsed) { console.error('[brand-extract] Theme Builder answered 200 with a body that is not the contract'); return fail(502, 'failed') }
    return NextResponse.json(parsed, { status: 200, headers: NO_STORE })
  }
  // Theme Builder's status decides Studio's sentence (BK-C8); its own text is never passed on, and never the key
  console.error(`[brand-extract] Theme Builder answered ${upstream.status}`)
  switch (upstream.status) {
    case 400: return fail(400, 'unreadable')
    case 413: return fail(413, 'size')
    case 415: return fail(415, 'type')
    case 422: return fail(422, 'no_colors')
    case 504: return fail(504, 'timeout')
    case 401: case 404: case 503: return fail(503, 'unavailable')
    default: return fail(502, 'failed')
  }
}
