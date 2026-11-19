// AVATAR-W5 Step A (A-1, A-3, A-5): the SERVER decisions behind the two same-origin routes of "my companions" (app/api/avatar/companions/route.ts, app/api/avatar/pack/[packId]/[...path]/route.ts). The route files are thin; the
// session, the flag, the registry, the path rules and the answer are all here, IMPORT-FREE (no imports at all; the environment, the signed-in user and the link minter are injected) so the proof runs it with fakes and no network.
// The rules (FRONTEND-1, owner, 19 Nov): the flag off, a signed-out caller, a caller who is not the pack's owner, an unknown or erased pack, an unsafe path, a file that cannot be linked and a link that cannot be minted ALL get
// ONE identical 404 (same status, same headers, same body; refuse()). The owner of a registered, live pack gets a 302 to a short-lived link for that ONE file. The owner comes from the SERVER session only, never from the request.
// Nothing here logs (a log line could carry a user id, a pack id or a link) and no error text ever names any of them. Behind NEXT_PUBLIC_STUDIO_MY_COMPANIONS (exactly "true", and only with the Studio shell flag exactly "true"): with it off
// both routes answer the one 404 before the session, the registry or the minter is touched.
// NO OPEN REDIRECT (FRONTEND-1, 19 Nov 22:51Z): the Location of the 302 is the link the minter answered, accepted only when it is the configured Supabase storage origin (NEXT_PUBLIC_SUPABASE_URL) plus the signing path of exactly this pack and file,
// or, in development with the stand-in on, exactly Maya's path (redirectTarget). Nothing from the request (host, forwarded headers, origin, referer, query) is ever read into it; every other link is the one 404.
// Server variables (names only; nobody creates them here): AVATAR_COMPANIONS_REGISTRY (JSON, the registry of ONE), plus the minter's own (see lib/server/avatar-pack-link.ts).

type Env = Record<string, string | undefined>

/** Same shapes as lib/server/avatar-pack-link.ts (that file and this one are both import-free, so the types are written out in both; the proof runs them together). */
export interface PackOwner { app: string; tenantId: string; userId: string }
export interface PackLinkMinter {
  mint(input: { owner: PackOwner; packId: string; path: string; ttlSeconds: number }): Promise<string | null>
}

export const MY_COMPANIONS_FLAG = 'NEXT_PUBLIC_STUDIO_MY_COMPANIONS'
/** The Studio shell flag this one also needs (the exact string "true"). */
export const STUDIO_SHELL_FLAG = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
export const REGISTRY_VAR = 'AVATAR_COMPANIONS_REGISTRY'
export const REGISTRY_MAX_ENTRIES = 20
export const REGISTRY_MAX_CHARS = 100_000
export const OWNER_APP = 'deckster'
export const OWNER_TENANT = 'deckster'
export const USER_ID_MAX = 200
export const NAME_MAX = 40
export const PACK_ROUTE_BASE = '/api/avatar/pack'

export interface RegistryEntry { id: string; displayName: string; packBaseUrl: string; owner: PackOwner; erased: boolean }
/** What the list route may say about a companion: these three fields and nothing else (never the owner). */
export interface CompanionView { id: string; displayName: string; packBaseUrl: string }

export interface AccessDeps {
  env: Env
  /** The signed-in Studio user's opaque id from the SERVER session, or null when nobody is signed in. Called only after the flag is known to be on. */
  userId: () => Promise<string | null>
}
export interface PackDeps extends AccessDeps {
  /** The minter, or a function that builds it from the environment (called only once the caller is known to own the pack, so a signer is never built for anyone else). */
  minter: PackLinkMinter | ((env: Env) => PackLinkMinter)
}
/** The two handlers read nothing of the request but its method and its URL. */
export type RequestLike = { method: string; url: string }

// ---- written out here (this file is import-free); lib/server/avatar-pack-link.ts has the same rules and the proof runs one table through both. A ".." inside a segment ("a..b.webp") is refused by the raw-path check in handlePack
// (the raw path must equal the segments joined, and may not contain ".."), which link's safePackPath does by itself. ----
const PACK_ID_PATTERN = /^u-[a-z0-9]{26}$/
const SEGMENT_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/
const PATH_MAX_SEGMENTS = 6
const PATH_MAX_LENGTH = 200
const FILE_EXTENSIONS: readonly string[] = ['.json', '.webp', '.png']
const LINK_TTL_VAR = 'AVATAR_PACK_LINK_TTL_SECONDS'
const SUPABASE_URL_VAR = 'NEXT_PUBLIC_SUPABASE_URL'
const DEV_STAND_IN_VAR = 'AVATAR_PACK_DEV_STANDIN'
/** What Supabase's createSignedUrl returns: `<project url>/storage/v1/object/sign/<bucket>/<packId>/<path>?token=...`. */
const SIGN_PREFIX = '/storage/v1/object/sign/'
/** The dev stand-in's whole link: Maya's committed pack under public/, this same origin. */
const DEV_STAND_IN_PATH = '/companions/maya/'

function packPath(segments: unknown): string | null {
  if (!Array.isArray(segments) || segments.length < 1 || segments.length > PATH_MAX_SEGMENTS) return null
  for (const segment of segments) if (typeof segment !== 'string' || !SEGMENT_PATTERN.test(segment)) return null
  const path = (segments as string[]).join('/')
  if (path.length > PATH_MAX_LENGTH) return null
  const last = (segments as string[])[segments.length - 1]
  const dot = last.lastIndexOf('.')
  if (dot < 1 || !FILE_EXTENSIONS.includes(last.slice(dot))) return null
  return path
}

function linkTtl(env: Env): number {
  const raw = env[LINK_TTL_VAR]
  const n = typeof raw === 'string' && /^\s*-?\d{1,9}\s*$/.test(raw) ? Number(raw) : Number.NaN
  if (!Number.isInteger(n)) return 300
  return Math.min(900, Math.max(60, n))
}

function maxAge(ttlSeconds: number): number {
  return Math.min(60, Math.floor(ttlSeconds / 5))
}

/** The origin of the configured Supabase project: NEXT_PUBLIC_SUPABASE_URL must itself be an https URL with no credentials in it, else null (so no link can be accepted). */
function storageOrigin(env: Env): string | null {
  const raw = env[SUPABASE_URL_VAR]
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}

/** The dev-only stand-in is on: NODE_ENV exactly "development" and the variable exactly "true" (the same rule as lib/server/avatar-pack-link.ts). */
function devStandInOn(env: Env): boolean {
  return env.NODE_ENV === 'development' && env[DEV_STAND_IN_VAR] === 'true'
}

/** The ONLY links a 302 may carry (no open redirect): what the minter answered is checked against the server's own configuration and the one file asked for, never against anything in the request.
 *  (a) the configured Supabase storage origin (https, the same origin as NEXT_PUBLIC_SUPABASE_URL) with the signing path `/storage/v1/object/sign/<bucket>/<packId>/<path>` for exactly this pack and file: no userinfo, no fragment, no backslash,
 *      no "%", no "//", no "..", no dot-segment (the raw path equals the cleaned one), printable ASCII, 2048 characters at most; or
 *  (b) only while the dev stand-in is on, exactly `/companions/maya/<path>`.
 *  Anything else (another origin or scheme or port, a lookalike host, another pack or file, a path on this site outside (b), a protocol-relative link, an unset or unusable NEXT_PUBLIC_SUPABASE_URL) is null, which is the one 404. */
function redirectTarget(link: unknown, env: Env, packId: string, path: string): string | null {
  if (typeof link !== 'string' || link.length === 0 || link.length > 2048 || !/^[\x21-\x7e]+$/.test(link)) return null
  if (!link.startsWith('https://')) return devStandInOn(env) && link === `${DEV_STAND_IN_PATH}${path}` ? link : null
  const origin = storageOrigin(env)
  if (origin === null) return null
  const parts = /^https:\/\/[^/?#]*(\/[^?#]*)(?:\?[^#]*)?$/.exec(link)
  if (!parts || link.includes('\\')) return null
  let parsed: URL
  try { parsed = new URL(link) } catch { return null }
  if (parsed.origin !== origin || parsed.username || parsed.password) return null
  const rawPath = parts[1]
  if (rawPath !== parsed.pathname || rawPath.includes('%') || rawPath.includes('//') || rawPath.includes('..')) return null
  if (!rawPath.startsWith(SIGN_PREFIX) || !rawPath.endsWith(`/${packId}/${path}`)) return null
  return link
}

// ---- the flag ----
/** Show my companions (no upload): the shell flag AND this one, each exactly "true". Server and client read the same two names. */
export function studioMyCompanionsOn(env: Env): boolean {
  return env[STUDIO_SHELL_FLAG] === 'true' && env[MY_COMPANIONS_FLAG] === 'true'
}

// ---- the registry of ONE (A-3) ----
function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g, ' ').replace(/\s+/g, ' ').trim()
  return name.length >= 1 && name.length <= NAME_MAX ? name : null
}

/** The registry from a JSON string (or an already parsed array): at most 20 entries, each `{ id, displayName, owner: { userId }, erased? }`. A bad JSON text or a value that is not an array is an empty registry; a bad entry is dropped
 *  (a bad id, name or owner; a given packBaseUrl that is not exactly the one derived from the id). The first entry for an id wins. An `erased` that is anything but absent or false counts as erased (fail closed). Never throws. */
export function parseRegistry(raw: unknown): RegistryEntry[] {
  let value: unknown = raw
  try {
    if (typeof raw === 'string') {
      if (raw.length === 0 || raw.length > REGISTRY_MAX_CHARS) return []
      value = JSON.parse(raw)
    }
  } catch {
    return []
  }
  if (!Array.isArray(value)) return []
  const entries: RegistryEntry[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (entries.length >= REGISTRY_MAX_ENTRIES) break
    try {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const entry = item as { id?: unknown; displayName?: unknown; packBaseUrl?: unknown; owner?: unknown; erased?: unknown }
      if (typeof entry.id !== 'string' || !PACK_ID_PATTERN.test(entry.id) || seen.has(entry.id)) continue
      const packBaseUrl = `${PACK_ROUTE_BASE}/${entry.id}`
      if (entry.packBaseUrl !== undefined && entry.packBaseUrl !== packBaseUrl) continue
      const displayName = cleanName(entry.displayName)
      if (displayName === null) continue
      const owner = entry.owner as { userId?: unknown } | null | undefined
      if (!owner || typeof owner !== 'object' || typeof owner.userId !== 'string' || owner.userId.length === 0 || owner.userId.length > USER_ID_MAX) continue
      seen.add(entry.id)
      entries.push({ id: entry.id, displayName, packBaseUrl, owner: { app: OWNER_APP, tenantId: OWNER_TENANT, userId: owner.userId }, erased: entry.erased !== undefined && entry.erased !== false })
    } catch {
      continue
    }
  }
  return entries
}

export function registryFromEnv(env: Env): RegistryEntry[] {
  return parseRegistry(env[REGISTRY_VAR])
}

/** What this user may see: their own, live (not erased) companions, as `{ id, displayName, packBaseUrl }`. No user id, or a user id that is not a non-empty string, sees none. */
export function companionsFor(registry: RegistryEntry[], userId: unknown): CompanionView[] {
  if (typeof userId !== 'string' || userId.length === 0) return []
  return registry
    .filter(entry => !entry.erased && entry.owner.userId === userId)
    .map(entry => ({ id: entry.id, displayName: entry.displayName, packBaseUrl: entry.packBaseUrl }))
}

// ---- the answers ----
/** The one 404: the same status, headers and body for every refusal reason, so nothing tells a caller which check failed (or that the pack exists). */
export function refuse(): Response {
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } })
}

function isReadMethod(request: RequestLike): boolean {
  const method = typeof request?.method === 'string' ? request.method.toUpperCase() : ''
  return method === 'GET' || method === 'HEAD'
}

/** The caller's id from the server session; null for nobody, anything that is not a non-empty string, or a session that cannot be read. */
async function sessionUserId(deps: AccessDeps): Promise<string | null> {
  try {
    const id = await deps.userId()
    return typeof id === 'string' && id.length > 0 ? id : null
  } catch {
    return null
  }
}

/** The part of the RAW request path (before any decoding or dot-segment clean-up) after `/api/avatar/pack/<id>/`, or null when the URL is not for that pack. */
function rawPackPath(url: unknown, packId: string): string | null {
  if (typeof url !== 'string') return null
  const match = /^(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*)?(\/[^?#]*)/.exec(url)
  if (!match) return null
  const prefix = `${PACK_ROUTE_BASE}/${packId}/`
  return match[1].startsWith(prefix) ? match[1].slice(prefix.length) : null
}

/** GET /api/avatar/companions -> 200 `{ companions: [{ id, displayName, packBaseUrl }] }`: only this user's own live entries, `Cache-Control: private, no-store`. Anything else is the one 404. */
export async function handleCompanions(request: RequestLike, deps: AccessDeps): Promise<Response> {
  if (!studioMyCompanionsOn(deps.env)) return refuse()
  if (!isReadMethod(request)) return refuse()
  const userId = await sessionUserId(deps)
  if (userId === null) return refuse()
  const companions = companionsFor(registryFromEnv(deps.env), userId)
  return new Response(JSON.stringify({ companions }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } })
}

/** GET /api/avatar/pack/<packId>/<path...> -> 302 to a short-lived link for that one file, for the pack's owner only. Order: flag, method, pack id, path (the segments AND the raw URL), session, registry (known, live, owned),
 *  minter. Every way out but the redirect is the one 404. */
export async function handlePack(request: RequestLike, packId: string, segments: string[], deps: PackDeps): Promise<Response> {
  if (!studioMyCompanionsOn(deps.env)) return refuse()
  if (!isReadMethod(request)) return refuse()
  if (typeof packId !== 'string' || !PACK_ID_PATTERN.test(packId)) return refuse()
  const path = packPath(segments)
  if (path === null) return refuse()
  const raw = rawPackPath(request?.url, packId)
  if (raw === null || raw.includes('%') || raw.includes('\\') || raw.includes('//') || raw.includes('..') || raw !== path) return refuse()
  const userId = await sessionUserId(deps)
  if (userId === null) return refuse()
  const entry = registryFromEnv(deps.env).find(candidate => candidate.id === packId)
  if (!entry || entry.erased || entry.owner.userId !== userId) return refuse()
  const ttlSeconds = linkTtl(deps.env)
  let link: string | null = null
  try {
    const minter = typeof deps.minter === 'function' ? deps.minter(deps.env) : deps.minter
    link = redirectTarget(await minter.mint({ owner: entry.owner, packId, path, ttlSeconds }), deps.env, packId, path)
  } catch {
    return refuse()
  }
  if (link === null) return refuse()
  return new Response(null, { status: 302, headers: { Location: link, 'Cache-Control': `private, max-age=${maxAge(ttlSeconds)}`, Vary: 'Cookie', 'Referrer-Policy': 'no-referrer' } })
}
