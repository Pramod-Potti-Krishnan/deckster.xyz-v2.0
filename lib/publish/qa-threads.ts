/**
 * The asker's own thread list, held in a browser cookie.
 *
 * An anonymous asker has no account, so a follow-up token is the ONLY way they
 * can ever find their answer again. This cookie is that memory.
 *
 * Client-side on purpose. The cookie is scoped to `/p/{slug}` so it is not sent
 * with every request in the app — which also means the browser does not send it
 * to `/api/publish/[slug]/ask`. A server-side merge would therefore read an
 * empty list and overwrite earlier threads on every question. One owner, on the
 * page where the cookie is actually in scope.
 */

export interface ThreadEntry {
  token: string
  questionId: string
  askedAt: string
}

/** 90 days. The token itself does not expire; it dies with the deck. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90

/** A cookie has a hard size limit, and an unbounded array would eventually
 *  make every request to the deck fail. Oldest out first. */
export const MAX_TRACKED_THREADS = 20

export function followUpCookieName(slug: string): string {
  return `dq_${slug}`
}

/** Tolerant of anything: a malformed or tampered cookie yields an empty list
 *  rather than breaking the panel for the rest of the session. */
export function parseThreads(raw: string | null | undefined): ThreadEntry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(decodeURIComponent(raw))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is ThreadEntry =>
        !!entry &&
        typeof entry.token === 'string' &&
        typeof entry.questionId === 'string' &&
        typeof entry.askedAt === 'string'
    )
  } catch {
    return []
  }
}

/** Append, de-duplicate by token, and trim oldest-first. Pure, so the trimming
 *  rule is testable without a browser. */
export function appendThread(existing: ThreadEntry[], entry: ThreadEntry): ThreadEntry[] {
  const merged = [...existing.filter((row) => row.token !== entry.token), entry]
  return merged.length > MAX_TRACKED_THREADS ? merged.slice(-MAX_TRACKED_THREADS) : merged
}

export function serialiseThreads(threads: ThreadEntry[]): string {
  return encodeURIComponent(JSON.stringify(threads))
}

function readRawCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? match[1] : null
}

export function readThreads(slug: string): ThreadEntry[] {
  return parseThreads(readRawCookie(followUpCookieName(slug)))
}

/** Record a new thread for this deck. Called by the panel after `/ask` returns. */
export function rememberThread(slug: string, entry: ThreadEntry): ThreadEntry[] {
  if (typeof document === 'undefined') return []
  const threads = appendThread(readThreads(slug), entry)
  const secure = window.location.protocol === 'https:' ? '; secure' : ''
  document.cookie =
    `${followUpCookieName(slug)}=${serialiseThreads(threads)}` +
    `; path=/p/${slug}; max-age=${MAX_AGE_SECONDS}; samesite=lax${secure}`
  return threads
}
