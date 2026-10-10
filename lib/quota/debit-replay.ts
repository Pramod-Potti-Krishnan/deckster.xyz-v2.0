/**
 * Answering a repeated delivery of one turn's wallet debit (R-20261007-frontend-19).
 * Used by `POST /api/wallet/debit` only with DECKSTER_QUOTA_LIVE_TIER_ENABLED on.
 *
 * Why this exists. A turn is booked at most once already: the ledger row's
 * `source_ref` (`token_usage:<messageId>`) is UNIQUE (prisma/schema.prisma,
 * WalletTransaction.sourceRef), and `debitWallet` / `recordPlanUsage`
 * (lib/wallet.ts) look the key up inside the same transaction as the balance
 * update and return the existing row without touching the balance. So a
 * re-sent request can never charge twice. What it could still do is answer
 * wrongly or fail:
 *  - the first delivery booked the turn as plan-included; the retry now sees
 *    that spend in the quota picture, decides the turn no longer fits, enters
 *    the wallet branch, finds the existing row and reports `deducted: true,
 *    source: "topup"` although nothing was taken from the wallet;
 *  - two deliveries in flight together both pass the lookup; the second one's
 *    insert hits the unique key and its whole transaction (balance update
 *    included) rolls back: no double charge, but it surfaces as a 500.
 * With the flag on the route reads the existing row first (and again after a
 * unique-key loss) and replays what was booked, so the answer is the same on
 * every delivery.
 */
import { prisma } from '@/lib/prisma'

export interface PriorTokenUsage {
  costCents: number
  source: 'plan' | 'topup'
  capped: boolean
}

/**
 * What the ledger already holds for this turn, or null when nothing was booked
 * for THIS user under this key. A row owned by another user is not replayed (the
 * key is globally unique; the legacy path handles that case as it always did).
 */
export async function findPriorTokenUsage(userId: string, sourceRef: string): Promise<PriorTokenUsage | null> {
  const row = await prisma.walletTransaction.findUnique({
    where: { sourceRef },
    select: { userId: true, amountCents: true, metadata: true },
  })
  if (!row || row.userId !== userId) return null
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}
  return {
    costCents: row.amountCents,
    source: meta.source === 'topup' ? 'topup' : 'plan',
    capped: meta.capped === true,
  }
}

/** Prisma's unique-constraint violation (P2002), however it is wrapped. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
}
