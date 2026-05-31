import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"

function isAdmin(email: string | null | undefined): boolean {
  return !!email && email === process.env.DEV_BYPASS_EMAIL
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { redemptions: true } },
      },
    })

    return NextResponse.json({ coupons })
  } catch (error) {
    console.error("[api/admin/coupons] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { code, valueCents, maxRedemptions, perUserLimit, expiresAt, note } = body

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }
    if (!valueCents || typeof valueCents !== "number" || valueCents <= 0) {
      return NextResponse.json({ error: "Value (cents) must be a positive number" }, { status: 400 })
    }

    const normalizedCode = code.trim().toUpperCase()

    const existing = await prisma.coupon.findUnique({ where: { code: normalizedCode } })
    if (existing) {
      return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 })
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: normalizedCode,
        valueCents,
        maxRedemptions: maxRedemptions ?? null,
        perUserLimit: perUserLimit ?? 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        note: note ?? null,
        createdBy: session.user.email,
      },
    })

    return NextResponse.json({ coupon }, { status: 201 })
  } catch (error) {
    console.error("[api/admin/coupons] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
