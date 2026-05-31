import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"

function isAdmin(email: string | null | undefined): boolean {
  return !!email && email === process.env.DEV_BYPASS_EMAIL
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const allowedFields: Record<string, boolean> = {
      active: true,
      maxRedemptions: true,
      perUserLimit: true,
      expiresAt: true,
      note: true,
    }

    const data: Record<string, any> = {}
    for (const key of Object.keys(body)) {
      if (allowedFields[key]) {
        if (key === "expiresAt" && body[key]) {
          data[key] = new Date(body[key])
        } else {
          data[key] = body[key]
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data,
    })

    return NextResponse.json({ coupon })
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 })
    }
    console.error("[api/admin/coupons/[id]] PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
