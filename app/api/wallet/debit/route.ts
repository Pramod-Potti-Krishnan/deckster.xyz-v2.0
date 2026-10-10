import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { debitWallet, recordPlanUsage, InsufficientFundsError } from "@/lib/wallet"
import { tokensToUsdCents } from "@/lib/pricing/tokens"
import { getQuotaStatus, fitsWithinCaps, type Tier } from "@/lib/quota/quota"
import { resolveQuotaTier } from "@/lib/quota/live-tier"
import { isQuotaLiveTierEnabled, quotaLiveTierResponseInit } from "@/lib/quota/live-tier-flag"
import { findPriorTokenUsage, isUniqueViolation, type PriorTokenUsage } from "@/lib/quota/debit-replay"

export async function POST(request: NextRequest) {
  // Flag DECKSTER_QUOTA_LIVE_TIER_ENABLED (default off): set once this turn's
  // ledger key is known, so a duplicate delivery that loses the unique-key race
  // can be answered from the row the winner wrote (see lib/quota/debit-replay.ts).
  let duplicateOf: { userId: string; sourceRef: string; tier: Tier } | null = null

  // What the ledger already booked for this turn, as the response body: the same
  // answer on every delivery (flag on only).
  const replayBody = async (userId: string, tier: Tier, prior: PriorTokenUsage) => {
    const after = await getQuotaStatus(userId, tier)
    return {
      costCents: prior.costCents,
      deducted: prior.source === "topup",
      source: prior.source,
      capped: prior.capped,
      balanceCents: after.walletBalanceCents,
      quota: after,
    }
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const sessionTier = (session.user.tier ?? "free") as Tier

    const { messageId, tokens, actionType } = await request.json()

    if (!messageId || typeof messageId !== "string") {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 })
    }
    if (!tokens || typeof tokens !== "number" || tokens <= 0) {
      return NextResponse.json({ error: "tokens must be a positive number" }, { status: 400 })
    }

    const costCents = tokensToUsdCents(tokens)

    // Flag on: the live database tier instead of the session JWT's (off returns
    // `sessionTier` without a read).
    const tier = await resolveQuotaTier(userId, sessionTier)

    // Pre-charge snapshot: tells us caps, what's already spent this period, and
    // the prepaid reserve available for overflow.
    const before = await getQuotaStatus(userId, tier)

    if (costCents === 0) {
      return NextResponse.json({
        costCents: 0,
        deducted: false,
        source: "plan",
        capped: false,
        balanceCents: before.walletBalanceCents,
        quota: before,
      }, quotaLiveTierResponseInit())
    }

    const sourceRef = `token_usage:${messageId}`
    if (isQuotaLiveTierEnabled()) {
      // A repeated delivery of a turn that is already booked is answered from
      // the ledger and books nothing.
      duplicateOf = { userId, sourceRef, tier }
      const prior = await findPriorTokenUsage(userId, sourceRef)
      if (prior) {
        return NextResponse.json(await replayBody(userId, tier, prior), quotaLiveTierResponseInit())
      }
    }
    let source: "plan" | "topup" = "plan"
    let deducted = false
    let capped = false

    if (fitsWithinCaps(before.caps, before.spent, costCents)) {
      // Within plan caps -> included. Record usage, don't touch the wallet.
      await recordPlanUsage({
        userId,
        amountCents: costCents,
        tokens,
        sourceRef,
        metadata: { messageId, tokens, actionType: actionType ?? null, costCents, source: "plan" },
      })
    } else {
      // Over a cap -> draw from the prepaid overflow reserve.
      try {
        await debitWallet({
          userId,
          amountCents: costCents,
          reason: "token_usage",
          sourceRef,
          tokens,
          metadata: { messageId, tokens, actionType: actionType ?? null, costCents, source: "topup" },
        })
        source = "topup"
        deducted = true
      } catch (error) {
        if (error instanceof InsufficientFundsError) {
          // Director already completed this turn — never lose the accounting.
          // Record it against the plan and flag `capped` so the UI blocks the
          // NEXT send until the period resets or the user tops up.
          await recordPlanUsage({
            userId,
            amountCents: costCents,
            tokens,
            sourceRef,
            metadata: {
              messageId,
              tokens,
              actionType: actionType ?? null,
              costCents,
              source: "plan",
              capped: true,
            },
          })
          capped = true
        } else {
          throw error
        }
      }
    }

    if (duplicateOf) {
      // Flag on: report what the ledger holds for this turn. Identical to the
      // local values unless a concurrent delivery of the same turn booked it
      // first (e.g. this one's wallet debit rolled back as insufficient because
      // the winner had already taken the money, and it then found the winner's row).
      try {
        const booked = await findPriorTokenUsage(userId, sourceRef)
        if (booked) {
          source = booked.source
          deducted = booked.source === "topup"
          capped = booked.capped
        }
      } catch (syncError) {
        // Best effort: the turn is booked; keep the local values rather than fail the request.
        console.error("[api/wallet/debit] Ledger read after booking failed:", syncError)
      }
    }

    const after = await getQuotaStatus(userId, tier)

    return NextResponse.json({
      costCents,
      deducted,
      source,
      capped,
      balanceCents: after.walletBalanceCents,
      quota: after,
    }, quotaLiveTierResponseInit())
  } catch (error) {
    if (duplicateOf && isUniqueViolation(error)) {
      // Another delivery of this same turn won the insert; this one's whole
      // transaction (balance update included) rolled back, so nothing was taken
      // twice. Answer with what the winner booked.
      try {
        const prior = await findPriorTokenUsage(duplicateOf.userId, duplicateOf.sourceRef)
        if (prior) {
          return NextResponse.json(
            await replayBody(duplicateOf.userId, duplicateOf.tier, prior),
            quotaLiveTierResponseInit(),
          )
        }
      } catch (replayError) {
        console.error("[api/wallet/debit] Duplicate replay failed:", replayError)
      }
    }
    console.error("[api/wallet/debit] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
