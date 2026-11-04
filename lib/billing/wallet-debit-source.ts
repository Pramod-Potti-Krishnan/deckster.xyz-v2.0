// FRONTEND-1 (L-BILLING F4, Studio half). The ONE switch that says who debits the wallet for usage, read by every debit path (today /api/wallet/debit;
// the meter receiver, POST /api/internal/meter, reads it too when it lands) so the flat browser-reported debit and the router meter feed never both debit.
// WALLET_DEBIT_SOURCE (server-only, runtime): "flat" (default, and anything that is not exactly "router") = today: /api/wallet/debit charges browser-reported tokens at the flat rate.
// "router" = the router meter is the single debit source: /api/wallet/debit records nothing and answers a no-op 200; top-ups are debited from the meter feed instead.
// "flat_strict" (L-BILLING B3) = flat, but a debit that does not fit the caps or the prepaid reserve is REFUSED: 402 { code: "wallet_capped" } (CAPPED_CODE), nothing recorded.
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

/** B3: a capped debit is refused (not recorded as capped) only under "flat_strict". */
export function refuseCappedDebit(env: Record<string, string | undefined> = process.env): boolean {
  return walletDebitSource(env) === "flat_strict"
}
