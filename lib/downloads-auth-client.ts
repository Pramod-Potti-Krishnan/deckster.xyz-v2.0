/** Browser half of lib/downloads-access-token.ts (no crypto import here). Flag NEXT_PUBLIC_STUDIO_DOWNLOADS_AUTH_ENABLED, default off. */
const PATH = '/api/downloads/access-token'
let cached: { token: string; expiresAt: number } | null = null

export function resetDownloadAuthCacheForTests(): void { cached = null }

/** `{ Authorization: 'Bearer …' }` or `{}`. Off: `{}` and no request. */
export async function downloadAuthHeaders(fetchImpl: typeof fetch = fetch, nowMs: number = Date.now()): Promise<Record<string, string>> {
  if (process.env.NEXT_PUBLIC_STUDIO_DOWNLOADS_AUTH_ENABLED !== 'true') return {}
  if (cached && cached.expiresAt * 1000 - nowMs > 60_000) return { Authorization: `Bearer ${cached.token}` }
  try {
    const res = await fetchImpl(PATH, { cache: 'no-store', credentials: 'same-origin' })
    if (!res.ok) return {}
    const body = await res.json()
    if (!body || typeof body.access_token !== 'string' || !body.access_token) return {}
    cached = { token: body.access_token, expiresAt: Number(body.expires_at) || 0 }
    return { Authorization: `Bearer ${cached.token}` }
  } catch {
    return {}
  }
}
