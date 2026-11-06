// FRONTEND-1 (L-BILLING F4, Studio half). The ONE switch that says who debits the wallet for usage, read by every debit path (today /api/wallet/debit;
// the meter receiver, POST /api/internal/meter, reads it too when it lands) so the flat browser-reported debit and the router meter feed never both debit.
// WALLET_DEBIT_SOURCE (server-only, runtime): "flat" (default, and anything that is not exactly "router") = today: /api/wallet/debit charges browser-reported tokens at the flat rate.
// "router" = the router meter is the single debit source: /api/wallet/debit records nothing and answers a no-op 200; top-ups are debited from the meter feed instead.
// "flat_strict" (L-BILLING B3, PROGRAM-1 ruling) = flat, and the post-turn debit ALWAYS lands as today (an over-cap one is logged and kept as the capped record);
// the refusal is a PRE-BUILD check: GET /api/wallet/precheck answers 402 { code: "wallet_capped" } (CAPPED_STATUS / CAPPED_CODE) when the user is over the caps with no top-up balance.
// The meter receiver (METER_RECEIVER_MODE, default off) is not built yet.
export type WalletDebitSource = "flat" | "flat_strict" | "router"
/** The status/code a capped, refused debit answers with (F5 keys its refusal screen on it). */
export const CAPPED_STATUS = 402
export const CAPPED_CODE = "wallet_capped"

export function walletDebitSource(env: Record<string, string | undefined> = process.env): WalletDebitSource {
  const v = env.WALLET_DEBIT_SOURCE
  return v === "router" ? "router" : v === "flat_strict" ? "flat_strict" : "flat"
}

/** The browser-reported flat debit runs only while the source is "flat". */
export function flatDebitEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return walletDebitSource(env) !== "router"
}

/** The meter receiver may apply `from_topup` to the wallet only while the source is "router" (otherwise it records receipts only). */
export function meterFeedDebitsWallet(env: Record<string, string | undefined> = process.env): boolean {
  return walletDebitSource(env) === "router"
}

/** B3: the pre-build cap check refuses only under "flat_strict". */
export function preBuildCapCheck(env: Record<string, string | undefined> = process.env): boolean {
  return walletDebitSource(env) === "flat_strict"
}

/** B3 decision (pure): refuse a new build/turn when the check is on, a 1-cent charge no longer fits the plan caps, and the top-up balance is empty. */
export function preBuildRefused(enabled: boolean, fitsOneCent: boolean, walletBalanceCents: number): boolean {
  return enabled && !fitsOneCent && !(walletBalanceCents > 0)
}

/** PK ruling (v1): under "flat_strict" only, the caps are the monthly cap alone (no daily or weekly cap) and "this period" is the UTC calendar month. Other values keep today's ET windows and all three caps. */
export function monthlyOnlyCaps(env: Record<string, string | undefined> = process.env): boolean {
  return walletDebitSource(env) === "flat_strict"
}

/** The first instant of `now`'s UTC calendar month. */
export function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
