import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"

const MAX_NAME_LENGTH = 80

/**
 * PATCH /api/profile
 * Update the signed-in user's editable profile fields.
 * Currently supports: display name. (Email is Google-linked and read-only.)
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const rawName = typeof body.name === "string" ? body.name.trim() : ""

    if (!rawName) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 })
    }
    if (rawName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Display name must be ${MAX_NAME_LENGTH} characters or fewer` },
        { status: 400 }
      )
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: rawName },
      select: { name: true, email: true, image: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[api/profile] PATCH error:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
