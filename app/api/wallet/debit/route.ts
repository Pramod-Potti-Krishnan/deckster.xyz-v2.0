import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { debitWallet, recordPlanUsage, InsufficientFundsError } from "@/lib/wallet"
import { tokensToUsdCents } from "@/lib/pricing/tokens"
import { getQuotaStatus, fitsWithinCaps, type Tier } from "@/lib/quota/quota"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const tier = (session.user.tier ?? "free") as Tier

    const { messageId, tokens, actionType } = await request.json()

    if (!messageId || typeof messageId !== "string") {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 })
    }
    if (!tokens || typeof tokens !== "number" || tokens <= 0) {
      return NextResponse.json({ error: "tokens must be a positive number" }, { status: 400 })
    }

    const costCents = tokensToUsdCents(tokens)

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
      })
    }

    const sourceRef = `token_usage:${messageId}`
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

    const after = await getQuotaStatus(userId, tier)

    return NextResponse.json({
      costCents,
      deducted,
      source,
      capped,
      balanceCents: after.walletBalanceCents,
      quota: after,
    })
  } catch (error) {
    console.error("[api/wallet/debit] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
