/**
 * Downloads auth (program1/studio-flip-enablers; Downloads program1/downloads-hardening accepts `Authorization: Bearer <HS256 JWT>`
 * verified with DOWNLOADS_USER_JWT_SECRET = the Supabase JWT secret).
 *
 * Studio signs in with NextAuth, so there is no Supabase session in the browser. The server mints a short-lived Supabase-format
 * access token (HS256, {sub: DB user id, role/aud "authenticated", iat, exp}) with server-only SUPABASE_JWT_SECRET at
 * GET /api/downloads/access-token; the browser attaches it as a Bearer header on /convert/* calls.
 *
 * Flag NEXT_PUBLIC_STUDIO_DOWNLOADS_AUTH_ENABLED (exact "true", default off). Off: downloadAuthHeaders() returns {} without a
 * request, so Downloads calls are byte-identical. On but no token: {} (the call goes out as before and Downloads decides).
 */
import { createHmac } from 'crypto'

export const DOWNLOADS_ACCESS_TOKEN_PATH = '/api/downloads/access-token'
export const DOWNLOADS_ACCESS_TOKEN_TTL_SECONDS = 600

export function isStudioDownloadsAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STUDIO_DOWNLOADS_AUTH_ENABLED === 'true'
}

/** Server-only mint. Null when the secret or subject is empty. */
export function mintSupabaseAccessToken(input: { secret: string; sub: string; ttlSeconds?: number; nowSeconds?: number }): { token: string; expiresAt: number } | null {
  if (!input.secret || !input.sub) return null
  const iat = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const exp = iat + (input.ttlSeconds ?? DOWNLOADS_ACCESS_TOKEN_TTL_SECONDS)
  const enc = (o: object) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url')
  const head = enc({ alg: 'HS256', typ: 'JWT' })
  const body = enc({ sub: input.sub, role: 'authenticated', aud: 'authenticated', iat, exp })
  const sig = createHmac('sha256', input.secret).update(`${head}.${body}`).digest('base64url')
  return { token: `${head}.${body}.${sig}`, expiresAt: exp }
}
