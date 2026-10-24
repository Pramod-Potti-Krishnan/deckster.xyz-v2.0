// COMPOSER-2 (FUTURE-OPS-2 section 3, row 4 "first paint"): Studio's canvas shows sooner by (1) opening its connections early and
// (2) asking the Layout viewer for its slide info the moment the viewer has loaded, instead of one full poll interval later.
// Flag NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED: exact "true", default off. Off: nothing in this module runs a request, a timer or a
// react-dom call that the base did not, and the viewer's poll is the base's own setInterval.
//
// (1) Preconnect. React 19 hoists the <link rel="preconnect"> / <link rel="dns-prefetch"> a component asks for into <head>, on the server
//     and on the client, and de-dupes them per document. The origins: the Layout service (the iframe's own document, assets and
//     commands) and the four hosts Layout's viewer page loads from (jsDelivr, the Tailwind CDN, Google Fonts' stylesheet host and its font
//     host, which is fetched cross-origin, so its connection is the "anonymous" kind).
// (2) First poll. The viewer polls getCurrentSlideInfo (or composeGetState while a compose job runs) every 3 s, and the first tick comes
//     3 s after the iframe loaded. With the flag on, ONE tick runs at once when the poll starts for a frame that has just loaded. That tick
//     is a head start, not a health check: when it gets no usable answer (the viewer's scripts are not ready, a timeout, an error, or a
//     hollow success such as a deck with no slide count yet) it counts nothing against the polling backoff (the viewer's catch skips the
//     failure count for it) and changes nothing on screen (the viewer drops a hollow answer), and the interval ticks that follow are the
//     base's. While it is in flight the interval ticks wait (no two polls at once; 15 s at most). It runs once per loaded frame and URL, not on each
//     later restart of the poll effect (those restarts follow slide-count changes and failure backoff, and each must keep waiting its interval).
import { preconnect, prefetchDNS } from 'react-dom'

export const STUDIO_FIRST_PAINT_ENABLED = process.env.NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED === 'true'

export interface FirstPaintConnection {
  readonly origin: string
  /** Set for a host the page fetches cross-origin (fonts); its connection is the "anonymous" kind. */
  readonly crossOrigin?: 'anonymous'
}

/** The hosts Layout's viewer page loads from. Order is the order they are opened in, after Layout's. */
export const FIRST_PAINT_CDN_CONNECTIONS: ReadonlyArray<FirstPaintConnection> = [
  { origin: 'https://cdn.jsdelivr.net' },
  { origin: 'https://cdn.tailwindcss.com' },
  { origin: 'https://fonts.googleapis.com' },
  { origin: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
]

/** A service URL (or origin) to its origin, or null when it is missing, not http(s), or not a URL. */
export function firstPaintOriginOf(url: string | null | undefined): string | null {
  if (typeof url !== 'string' || !url.trim()) return null
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : null
  } catch {
    return null
  }
}

/** Layout first (when its URL is valid), then the CDN hosts; one entry per origin, the first one wins. */
export function firstPaintConnections(layoutUrl: string | null | undefined): FirstPaintConnection[] {
  const seen = new Set<string>()
  const out: FirstPaintConnection[] = []
  const layout = firstPaintOriginOf(layoutUrl)
  for (const connection of [...(layout ? [{ origin: layout }] : []), ...FIRST_PAINT_CDN_CONNECTIONS]) {
    if (seen.has(connection.origin)) continue
    seen.add(connection.origin)
    out.push(connection)
  }
  return out
}

// Browser only: React already de-dupes per document, so once a page has asked for a list the same list is not asked for again on every
// render of the viewer. On the server every render is its own document (its own <head>), so nothing is remembered there.
let warmedInBrowser: string | null = null

/**
 * Asks React to open the connections for Layout and its CDN hosts. Flag off: does nothing and returns []. Returns the connections it asked for
 * (empty when it asked for none this time).
 */
export function warmStudioFirstPaintConnections(layoutUrl: string | null | undefined): FirstPaintConnection[] {
  if (!STUDIO_FIRST_PAINT_ENABLED) return []
  const connections = firstPaintConnections(layoutUrl)
  if (typeof document !== 'undefined') {
    const key = connections.map(c => `${c.origin}|${c.crossOrigin ?? ''}`).join(',')
    if (key === warmedInBrowser) return []
    warmedInBrowser = key
  }
  for (const { origin, crossOrigin } of connections) {
    if (crossOrigin) preconnect(origin, { crossOrigin })
    else preconnect(origin)
    prefetchDNS(origin)
  }
  return connections
}

/** The most a head-start tick can hold the interval ticks back, so a tick that never settles cannot stop the polling for good (every command has its own 5 s timeout; a snapshot restore chains up to three). */
export const FIRST_POLL_MAX_HOLD_MS = 15_000

const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/**
 * Whether the head-start tick's answer may be acted on. Layout's viewer answers getCurrentSlideInfo (and composeGetState) from the moment its
 * script is loaded, but it draws and starts its slides some 300 ms later, and until then a "success" can carry no slides at all. An interval
 * tick cannot be sure of better, but it comes seconds later; the head start comes first, so it only acts on an answer with a positive slide
 * count and a current index (either reply shape). A hollow answer is dropped, not counted; the interval ticks carry on as before.
 */
export function isUsableFirstPollAnswer(answer: unknown): boolean {
  if (!answer || typeof answer !== 'object') return false
  const record = answer as Record<string, unknown>
  if (record.success !== true) return false
  const data = record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : record
  const total = Math.max(finite(data.real_slide_count) ?? 0, finite(data.total) ?? 0, finite(data.total_visual_sections) ?? 0, finite(data.visual_section_count) ?? 0)
  const index = finite(data.current_visual_index) ?? finite(data.index)
  return total > 0 && index !== null && index >= 0
}

interface FirstPollState {
  readonly url: string
  readonly holdUntil: number
  inFlight: boolean
}
// One state per frame element; a frame that navigates to another URL gets a new state, so each loaded document gets its head start.
const firstPolls = new WeakMap<object, FirstPollState>()

/**
 * The viewer's slide-info poll. `tick(firstTick)` is the viewer's own tick: it is called with no argument by the interval, exactly as the
 * base does, and with `true` once, at once, for the head-start tick (the tick must not count a failure of that call).
 *
 * Flag off, or no frame or URL yet: `setInterval(tick, intervalMs)`, the base's call. Returns the interval handle for clearInterval.
 */
export function startStudioSlideInfoPoll(
  frame: object | null | undefined,
  url: string | null | undefined,
  tick: (firstTick?: boolean) => unknown,
  intervalMs: number,
): ReturnType<typeof setInterval> {
  if (!STUDIO_FIRST_PAINT_ENABLED || !frame || !url) return setInterval(tick, intervalMs)
  let state = firstPolls.get(frame)
  if (!state || state.url !== url) {
    const claimed: FirstPollState = { url, holdUntil: Date.now() + FIRST_POLL_MAX_HOLD_MS, inFlight: true }
    state = claimed
    firstPolls.set(frame, claimed)
    let running: unknown
    try { running = tick(true) } catch { running = undefined }
    Promise.resolve(running).catch(() => undefined).then(() => { claimed.inFlight = false })
  }
  const current = state
  return setInterval(() => (current.inFlight && Date.now() < current.holdUntil ? undefined : tick()), intervalMs)
}
