import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { debitWallet, InsufficientFundsError } from "@/lib/wallet"
import { tokensToUsdCents } from "@/lib/pricing/tokens"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { messageId, tokens, actionType } = await request.json()

    if (!messageId || typeof messageId !== "string") {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 })
    }
    if (!tokens || typeof tokens !== "number" || tokens <= 0) {
      return NextResponse.json({ error: "tokens must be a positive number" }, { status: 400 })
    }

    const costCents = tokensToUsdCents(tokens)

    if (costCents === 0) {
      return NextResponse.json({ balanceCents: 0, costCents: 0, deducted: false })
    }

    const { balanceAfterCents, transactionId } = await debitWallet({
      userId: session.user.id,
      amountCents: costCents,
      reason: "token_usage",
      sourceRef: `token_usage:${messageId}`,
      metadata: { messageId, tokens, actionType: actionType ?? null, costCents },
    })

    return NextResponse.json({
      balanceCents: balanceAfterCents,
      costCents,
      deducted: true,
      transactionId,
    })
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return NextResponse.json(
        {
          error: "Insufficient balance",
          balanceCents: error.currentBalanceCents,
          costCents: error.requestedCents,
        },
        { status: 402 }
      )
    }
    console.error("[api/wallet/debit] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
