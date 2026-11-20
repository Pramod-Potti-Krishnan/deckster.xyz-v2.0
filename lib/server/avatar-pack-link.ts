// AVATAR-W5 Step A (A-2): the SERVER-ONLY link minter for a private avatar pack ("my companion"). A pack file is never public: the same-origin route GET /api/avatar/pack/<packId>/<path> (see lib/server/avatar-pack-access.ts)
// decides who may have a file, then asks a minter for a short-lived link to that ONE file and answers a 302 to it. This module is the minter side, behind an interface so the real signer (a private Supabase Storage bucket), the
// dev-only stand-in and the tests' fakes are interchangeable. It is IMPORT-FREE (no imports at all: the proof transpiles it and runs it with fakes, no network), reads no environment itself (the environment is passed in), logs
// nothing (a log line could carry a link, a user id or a pack id) and never throws: every failure is a null, which the route turns into the one 404.
// Server variables (names only; nobody creates them here): AVATAR_PACK_BUCKET (the private bucket's name), AVATAR_PACK_LINK_TTL_SECONDS (optional), AVATAR_PACK_DEV_STANDIN (development only).

type Env = Record<string, string | undefined>

/** Who owns a pack. Handed to mintPackLink (and so to the minter) for the future spawn service (Step B: POST /v1/packs/{packId}/mint takes the owner) and for auditing; it does NOT authorise here (the route checks the owner against the session before it asks for a link). */
export interface PackOwner { app: string; tenantId: string; userId: string }

/** Turns one (pack, relative path) into a short-lived link, or null (no such file / cannot sign). Must not throw, but callers treat a throw as null. */
export interface PackLinkMinter {
  mint(input: { owner: PackOwner; packId: string; path: string; ttlSeconds: number }): Promise<string | null>
}

/** The one call the real signer needs: Supabase Storage's createSignedUrl, adapted to take the bucket too. */
export interface SignedUrlStorage {
  createSignedUrl(bucket: string, key: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: unknown }>
}

export type PackFileExists = (relativePath: string) => boolean | Promise<boolean>

export const PACK_BUCKET_VAR = 'AVATAR_PACK_BUCKET'
export const PACK_LINK_TTL_VAR = 'AVATAR_PACK_LINK_TTL_SECONDS'
export const PACK_DEV_STANDIN_VAR = 'AVATAR_PACK_DEV_STANDIN'

/** The pack id: written out here because this file is import-free (lib/studio-avatar-spawn.ts holds the same pattern; the proof compares them). */
export const PACK_ID_PATTERN = /^u-[a-z0-9]{26}$/
/** One path segment: starts with a letter, digit or underscore (so no ".", "..", hidden file, "%" or separator), then letters, digits, "_", "." and "-". */
export const PACK_SEGMENT_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/
export const PACK_PATH_MAX_SEGMENTS = 6
export const PACK_PATH_MAX_LENGTH = 200
/** Exactly what the player fetches (FRONTEND-1's ruling). */
export const PACK_FILE_EXTENSIONS: readonly string[] = ['.json', '.webp', '.png']
/** A private bucket's name is not a secret, but it must be one plain name: it ends up as one segment of the signed link's path. */
export const BUCKET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

export const LINK_TTL_DEFAULT = 300
export const LINK_TTL_MIN = 60
export const LINK_TTL_MAX = 900
/** The most a browser may keep the 302 (seconds); the redirect's max-age is also never more than a fifth of the link's life. */
export const REDIRECT_MAX_AGE_CAP = 60
export const LINK_MAX_LENGTH = 2048

export const DEV_STAND_IN_ROOT = 'public/companions/maya/'
export const DEV_STAND_IN_URL = '/companions/maya/'

export function validPackId(packId: unknown): packId is string {
  return typeof packId === 'string' && PACK_ID_PATTERN.test(packId)
}

/** The relative path inside a pack, or null when it is not one the player fetches. 1 to 6 segments of the segment pattern, 200 characters at most, no ".." anywhere, final extension .json .webp or .png.
 *  Nothing is rewritten: a path is either exactly what was asked for, or refused. */
export function safePackPath(path: string): string | null {
  if (typeof path !== 'string' || path.length === 0 || path.length > PACK_PATH_MAX_LENGTH) return null
  if (path.includes('..')) return null
  const segments = path.split('/')
  if (segments.length > PACK_PATH_MAX_SEGMENTS) return null
  for (const segment of segments) if (!PACK_SEGMENT_PATTERN.test(segment)) return null
  const last = segments[segments.length - 1]
  const dot = last.lastIndexOf('.')
  if (dot < 1 || !PACK_FILE_EXTENSIONS.includes(last.slice(dot))) return null
  return segments.join('/')
}

/** A whole number of seconds, 60 to 900; anything that is not a whole number (or is missing) is the default, 300. */
export function clampTtlSeconds(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\s*-?\d{1,9}\s*$/.test(value) ? Number(value) : Number.NaN
  if (!Number.isInteger(n)) return LINK_TTL_DEFAULT
  return Math.min(LINK_TTL_MAX, Math.max(LINK_TTL_MIN, n))
}

/** How long a minted link lives: AVATAR_PACK_LINK_TTL_SECONDS, default 300, clamped to 60..900, junk = 300. */
export function linkTtlSeconds(env: Env): number {
  return clampTtlSeconds(env[PACK_LINK_TTL_VAR])
}

/** The 302's max-age: at most 60 and at most a fifth of the link's life, so a browser never keeps a redirect anywhere near the end of its link. */
export function redirectMaxAge(ttlSeconds: number): number {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return 0
  return Math.min(REDIRECT_MAX_AGE_CAP, Math.floor(ttlSeconds / 5))
}

/** A link the browser may be sent to: an https URL with no credentials in it, or a path on this same origin (the dev stand-in). Printable ASCII only, one line, no "//" or "/\" start (that would leave the origin). */
export function safeLink(url: unknown, allowSameOrigin = true): string | null {
  if (typeof url !== 'string' || url.length === 0 || url.length > LINK_MAX_LENGTH || !/^[\x21-\x7e]+$/.test(url)) return null
  if (url.startsWith('https://')) {
    let parsed: URL
    try { parsed = new URL(url) } catch { return null }
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return null
    return url
  }
  if (allowSameOrigin && /^\/(?![/\\])/.test(url)) return url
  return null
}

export function devStandInActive(env: Env): boolean {
  return env.NODE_ENV === 'development' && env[PACK_DEV_STANDIN_VAR] === 'true'
}

/** The dev-only stand-in: serves Maya's committed pack (public/companions/maya/) as if it were the owner's private one, for any registered pack id, when that file exists. Active ONLY when NODE_ENV is
 *  exactly "development" and AVATAR_PACK_DEV_STANDIN is exactly "true"; in any other environment it mints nothing. */
export function devStandInMinter(options: { env: Env; fileExists: PackFileExists }): PackLinkMinter & { active(env?: Env): boolean } {
  return {
    active: (env?: Env) => devStandInActive(env ?? options.env),
    async mint({ packId, path }) {
      try {
        if (!devStandInActive(options.env)) return null
        if (!validPackId(packId)) return null
        const clean = safePackPath(path)
        if (!clean) return null
        if (!(await options.fileExists(DEV_STAND_IN_ROOT + clean))) return null
        return DEV_STAND_IN_URL + clean
      } catch {
        return null
      }
    },
  }
}

/** The real signer: the object key is `<packId>/<relative path>` in the private bucket; the answer is Supabase's signed link, which must be https. Any error, empty answer or throw is null. */
export function supabasePackLinkMinter(options: { storage: SignedUrlStorage; bucket: string }): PackLinkMinter {
  return {
    async mint({ packId, path, ttlSeconds }) {
      try {
        if (!validPackId(packId)) return null
        const clean = safePackPath(path)
        if (!clean) return null
        if (typeof options.bucket !== 'string' || !BUCKET_PATTERN.test(options.bucket)) return null
        const { data, error } = await options.storage.createSignedUrl(options.bucket, `${packId}/${clean}`, clampTtlSeconds(ttlSeconds))
        if (error || !data) return null
        return safeLink(data.signedUrl, false)
      } catch {
        return null
      }
    },
  }
}

/** The minter that never links anything: what a missing bucket or missing storage gets (fail closed). */
export const closedMinter: PackLinkMinter = { async mint() { return null } }

/** Which minter this environment gets: the dev stand-in when it is active; else the Supabase signer when AVATAR_PACK_BUCKET names a bucket and storage is given; else the closed one. */
export function selectMinter(env: Env, deps: { storage?: SignedUrlStorage; fileExists?: PackFileExists }): PackLinkMinter {
  if (devStandInActive(env)) return devStandInMinter({ env, fileExists: deps.fileExists ?? (() => false) })
  const bucket = env[PACK_BUCKET_VAR]
  if (typeof bucket === 'string' && bucket.length > 0 && deps.storage) return supabasePackLinkMinter({ storage: deps.storage, bucket })
  return closedMinter
}

/** SERVER-ONLY. One short-lived link to ONE file of ONE pack, or null. Re-checks the pack id and the path itself (whatever the caller did), asks the minter for at most the clamped ttl, and refuses any link that is not
 *  https or a same-origin path. `owner` is accepted for the spawn service and for auditing; it does not authorise: the caller has already matched it against the signed-in user. */
export async function mintPackLink(
  owner: PackOwner,
  packId: string,
  path: string,
  deps: { minter: PackLinkMinter; ttlSeconds?: number },
): Promise<{ url: string; ttlSeconds: number } | null> {
  try {
    if (!validPackId(packId)) return null
    const clean = safePackPath(path)
    if (!clean || !deps || !deps.minter || typeof deps.minter.mint !== 'function') return null
    const ttlSeconds = clampTtlSeconds(deps.ttlSeconds)
    const url = safeLink(await deps.minter.mint({ owner, packId, path: clean, ttlSeconds }))
    return url ? { url, ttlSeconds } : null
  } catch {
    return null
  }
}
