/**
 * MULTITAB J1 P1b: a second tab on the same session made both tabs evict each other.
 *
 * Flag NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB (exact "true", default off). Off, nothing here is consulted for behaviour: the hook
 * treats every close alike (today's backoff), the page shows no notice and gates nothing.
 *
 * Cause: Director keeps ONE live socket per session. A new connect for a session closes the open one with code 4000 and the
 * reason "New connection opened" (director-v4.0 src/handlers/websocket.py handle_connection), and sends everything after
 * that to the newest socket only. Studio treated that close like a network drop and reconnected on its 1.5/3/6/12 s ladder,
 * so two tabs evicted each other about nine times in 45 s until one ran out of retries ("Couldn't reconnect"), and every
 * reconnect re-sent the socket-ready set_theme. Neither tab ever said why.
 *
 * On (newest tab wins, the model Director already has):
 *  1. A close of the CURRENT socket with exactly code 4000 and reason "New connection opened" puts the hook in the
 *     `superseded` reconnect status and schedules NO reconnect: no timer, no ping, no set_theme. Every other close
 *     (including Studio's own 4000 heartbeat closes, whose reasons differ) keeps today's backoff.
 *  2. The superseded tab says so (header "Open in another tab", a notice with a "Use here" button, the composer
 *     placeholder), a send shows the notice instead of silently reconnecting, and Add Slide / Add Element / Theme / Template
 *     are disabled with the same hint. Browsing the deck stays possible.
 *  3. "Use here" is the existing explicit connect(): this tab opens a new socket (fresh retry budget), Director evicts the
 *     other tab, and that tab shows the same notice. No loop is possible: neither tab reconnects after an eviction.
 *
 * Not changed: reducer, cache, history restore, keys, payload shapes. The only outbound difference from today is the
 * ABSENCE of reconnect attempts after a 4000 "New connection opened" close (plus the one explicit connect on "Use here").
 *
 * Pure policy and copy only: no React, no network. The Next build inlines the flag below.
 */

/** Read as a literal so the Next build inlines it into client bundles. */
export const STUDIO_ONE_LIVE_TAB_ENABLED = process.env.NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB === 'true'

/** What Director closes the older socket of a session with when a newer one connects (websocket.py L1618-1620). */
export const DIRECTOR_SUPERSEDED_CLOSE_CODE = 4000
export const DIRECTOR_SUPERSEDED_CLOSE_REASON = 'New connection opened'

/**
 * Whether a socket close is Director's "this session was opened in another tab" eviction. Both the code and the exact reason
 * must match: Studio's own heartbeat retire also uses 4000 ("Director heartbeat timeout" / "Director heartbeat send failed")
 * and must keep reconnecting.
 */
export function isDirectorSupersededClose(event: { code?: unknown; reason?: unknown } | null | undefined): boolean {
  return Boolean(event)
    && event!.code === DIRECTOR_SUPERSEDED_CLOSE_CODE
    && event!.reason === DIRECTOR_SUPERSEDED_CLOSE_REASON
}

/** Whether the page should treat this tab as paused (flag on and the hook reports `superseded`). */
export function isTabSuperseded(enabled: boolean, reconnectStatus: string | null | undefined): boolean {
  return enabled && reconnectStatus === 'superseded'
}

// PK-approved copy (13 Oct 2026).
export const SUPERSEDED_NOTICE_TITLE = 'This session is open in another tab.'
export const SUPERSEDED_NOTICE_DETAIL = 'Changes there are live; this tab is paused.'
export const SUPERSEDED_NOTICE_TEXT = `${SUPERSEDED_NOTICE_TITLE} ${SUPERSEDED_NOTICE_DETAIL}`
export const SUPERSEDED_USE_HERE_LABEL = 'Use here'
/** The Director header's connection line and the composer placeholder while this tab is paused. */
export const SUPERSEDED_STATUS_TEXT = 'Open in another tab'
