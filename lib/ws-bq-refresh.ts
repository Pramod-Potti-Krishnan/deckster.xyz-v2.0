/**
 * "The plan or the wallet just changed: re-mint the Director token now."
 *
 * The build-quota claim (`bq`, contract F-quota-bq-claim v1) lives exactly as
 * long as the Director WS token and is re-minted by the existing `auth_refresh`
 * timer (~9 min). A user who redeems a coupon, tops up or checks out would
 * otherwise stay refused until the next timer. Those flows run on other pages
 * (/redeem, /billing), and the live Director socket is owned by the builder,
 * usually in another tab, so the request goes over a same-origin
 * BroadcastChannel (it also reaches the sender's own tab). Without
 * BroadcastChannel it falls back to a window event for the current document.
 *
 * Client only, no React. The listener is the builder's WS hook
 * (hooks/use-deckster-websocket-v2.ts), which spells the two names below itself
 * so its import list is unchanged; scripts/test-ws-bq-claim.mjs holds them equal.
 * Nothing happens unless that socket's token carries a claim (the ws-token
 * response says so only when DECKSTER_WS_BQ_CLAIM_ENABLED is on), so with the
 * flag off this changes no behaviour.
 */

export const BQ_REFRESH_CHANNEL = 'deckster-ws-bq-refresh'
export const BQ_REFRESH_EVENT = 'deckster:ws-bq-refresh'

/**
 * Top-up and checkout credit the account from a Stripe webhook that can land a
 * moment after the success redirect, so those two ask once more after this
 * delay. A coupon redeem credits inside its own request: no follow-up.
 */
export const BQ_REFRESH_FOLLOW_UP_MS = 10_000

export type BqRefreshReason = 'redeem' | 'topup' | 'checkout'

function emit(reason: BqRefreshReason): void {
  if (typeof window === 'undefined') return
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(BQ_REFRESH_CHANNEL)
      channel.postMessage({ reason })
      channel.close()
      return
    }
    window.dispatchEvent(new CustomEvent(BQ_REFRESH_EVENT, { detail: { reason } }))
  } catch {
    // A refresh request is best effort: the ~9 minute timer still re-mints.
  }
}

/**
 * Ask every open builder to re-mint its Director token. Returns a function that
 * cancels the pending follow-up (call it when the page unmounts).
 */
export function requestBqClaimRefresh(reason: BqRefreshReason): () => void {
  emit(reason)
  if (reason === 'redeem') return () => {}
  const timer = setTimeout(() => emit(reason), BQ_REFRESH_FOLLOW_UP_MS)
  return () => clearTimeout(timer)
}
