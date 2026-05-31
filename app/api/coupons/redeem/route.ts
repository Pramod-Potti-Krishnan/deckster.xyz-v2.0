import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"
import { creditWallet } from "@/lib/wallet"

export async function POST(request: NextRequest) {
  try {
    if (process.env.COUPON_AUTH_ENABLED !== "true") {
      return NextResponse.json({ error: "Coupon authorization is not enabled" }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { code } = await request.json()
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 })
    }

    const normalizedCode = code.trim().toUpperCase()

    const result = await prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.findUnique({ where: { code: normalizedCode } })

      if (!coupon) {
        throw new RedeemError("Invalid coupon code")
      }
      if (!coupon.active) {
        throw new RedeemError("This coupon is no longer active")
      }
      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        throw new RedeemError("This coupon has expired")
      }
      if (coupon.maxRedemptions !== null && coupon.timesRedeemed >= coupon.maxRedemptions) {
        throw new RedeemError("This coupon has been fully redeemed")
      }

      const existing = await tx.couponRedemption.findUnique({
        where: { couponId_userId: { couponId: coupon.id, userId: session.user.id } },
      })
      if (existing) {
        throw new RedeemError("You have already redeemed this coupon")
      }

      await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId: session.user.id,
          amountCents: coupon.valueCents,
        },
      })

      await tx.coupon.update({
        where: { id: coupon.id },
        data: { timesRedeemed: { increment: 1 } },
      })

      const { balanceAfterCents } = await creditWallet({
        userId: session.user.id,
        amountCents: coupon.valueCents,
        reason: "coupon_redemption",
        sourceRef: `coupon:${coupon.id}:${session.user.id}`,
        metadata: { couponCode: coupon.code, couponId: coupon.id },
        tx,
      })

      await tx.user.update({
        where: { id: session.user.id },
        data: {
          approved: true,
          approvedAt: new Date(),
          approvedBy: `coupon:${coupon.code}`,
        },
      })

      return { balanceCents: balanceAfterCents, valueCents: coupon.valueCents }
    })

    return NextResponse.json({
      success: true,
      approved: true,
      balanceCents: result.balanceCents,
      creditedCents: result.valueCents,
    })
  } catch (error) {
    if (error instanceof RedeemError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error("[api/coupons/redeem] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

class RedeemError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RedeemError"
  }
}
