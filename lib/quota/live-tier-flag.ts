/**
 * Flag for the live-DB tier on Studio's quota routes and the idempotent
 * wallet-debit replay (R-20261007-frontend-19, J8.1).
 *
 * DECKSTER_QUOTA_LIVE_TIER_ENABLED: server env, read at runtime, only the exact
 * string `true` turns it on, default off. Same convention as
 * DECKSTER_WS_BQ_CLAIM_ENABLED (lib/quota/build-quota.ts). Kept free of the
 * database client so light routes such as /api/version can report it.
 *
 * Off: `GET /api/usage/quota` and `POST /api/wallet/debit` take the tier from the
 * session JWT, exactly as before, and answer with exactly the bytes they did.
 *
 * On:
 *  - both routes take the tier from the live `User.tier` (`readLiveTier`);
 *  - the debit route answers a repeated delivery of the same turn (same
 *    messageId) from the ledger row that already exists, and a duplicate that
 *    loses a race (unique `source_ref`) the same way, instead of a 500;
 *  - both routes add the `x-deckster-debit-idempotent: 1` response header, which
 *    is what tells the browser hook that a failed debit may be re-sent (the hook
 *    spells the same header name; scripts/test-quota-live-tier.mjs holds them equal).
 */
export const QUOTA_LIVE_TIER_FLAG = 'DECKSTER_QUOTA_LIVE_TIER_ENABLED'

export function isQuotaLiveTierEnabled(): boolean {
  return process.env.DECKSTER_QUOTA_LIVE_TIER_ENABLED === 'true'
}

/** Response header set only with the flag on: "this server books a debit once per messageId". */
export const QUOTA_DEBIT_IDEMPOTENT_HEADER = 'x-deckster-debit-idempotent'

/** `NextResponse.json(body, init)` init for the two routes: `undefined` (no init at all) with the flag off. */
export function quotaLiveTierResponseInit(): { headers: Record<string, string> } | undefined {
  return isQuotaLiveTierEnabled() ? { headers: { [QUOTA_DEBIT_IDEMPOTENT_HEADER]: '1' } } : undefined
}
