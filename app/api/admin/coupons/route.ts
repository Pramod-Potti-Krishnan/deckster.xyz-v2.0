import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"
import { studioP2AdminOn, studioP2AdminPageWindow, studioP2AdminPaging, studioP2AdminParseExpiry, studioP2AdminTotalsFromGroups } from "@/lib/studio-p2-admin"

function isAdmin(email: string | null | undefined): boolean {
  return !!email && email === process.env.DEV_BYPASS_EMAIL
}

const VALID_TIERS = ["starter", "pro", "premium"] as const
type CouponTier = (typeof VALID_TIERS)[number]

function isValidTier(value: unknown): value is CouponTier {
  return typeof value === "string" && (VALID_TIERS as readonly string[]).includes(value)
}

// PASS2 ADMIN hardening (NEXT_PUBLIC_STUDIO_P2_ADMIN, default off). Off, every line of this route below runs exactly as it always did.
const hardened = () => studioP2AdminOn(process.env.NEXT_PUBLIC_STUDIO_P2_ADMIN)

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (hardened() && !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (hardened()) {
      // one page at a time, and the figures over every coupon from the database's own aggregates
      const paging = studioP2AdminPaging((name) => request.nextUrl.searchParams.get(name))
      const [total, active, groups] = await Promise.all([
        prisma.coupon.count(),
        prisma.coupon.count({ where: { active: true } }),
        prisma.coupon.groupBy({ by: ["valueCents"], _sum: { timesRedeemed: true } }),
      ])
      const window = studioP2AdminPageWindow(total, paging.page, paging.limit)
      const page = await prisma.coupon.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }], // a fixed order inside a tie, so no row is on two pages
        include: {
          _count: { select: { redemptions: true } },
        },
        skip: window.skip,
        take: window.take,
      })
      return NextResponse.json({
        coupons: page,
        page: window.page,
        limit: window.take,
        total,
        pageCount: window.pageCount,
        totals: studioP2AdminTotalsFromGroups(total, active, groups),
      })
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
    if (hardened() && !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { code, valueCents, tier, maxRedemptions, perUserLimit, expiresAt, note } = body

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }
    if (!valueCents || typeof valueCents !== "number" || valueCents <= 0) {
      return NextResponse.json({ error: "Value (cents) must be a positive number" }, { status: 400 })
    }
    if (tier !== undefined && !isValidTier(tier)) {
      return NextResponse.json(
        { error: "Tier must be one of: starter, pro, premium" },
        { status: 400 },
      )
    }

    // an expiry must say its time zone (the form sends the admin's offset), and be a real day and time
    const expiry = hardened() ? studioP2AdminParseExpiry(expiresAt) : null
    if (expiry && !expiry.ok) {
      return NextResponse.json({ error: expiry.error }, { status: 400 })
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
        tier: tier ?? "starter",
        maxRedemptions: maxRedemptions ?? null,
        perUserLimit: perUserLimit ?? 1,
        expiresAt: expiry && expiry.ok ? expiry.date : expiresAt ? new Date(expiresAt) : null,
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
