import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/account/usage
 * Real usage metrics for the signed-in user, derived from existing tables.
 * - presentationCount: number of chat sessions (decks)
 * - storageBytes: sum of uploaded-file sizes
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    const [presentationCount, storageAgg] = await Promise.all([
      prisma.chatSession.count({ where: { userId } }),
      prisma.uploadedFile.aggregate({
        where: { userId },
        _sum: { fileSize: true },
      }),
    ])

    return NextResponse.json({
      presentationCount,
      storageBytes: storageAgg._sum.fileSize ?? 0,
    })
  } catch (error) {
    console.error("[api/account/usage] GET error:", error)
    return NextResponse.json({ error: "Failed to load usage" }, { status: 500 })
  }
}
