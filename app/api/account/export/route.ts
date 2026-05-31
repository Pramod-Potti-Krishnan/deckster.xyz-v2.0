import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/account/export
 * Returns a downloadable JSON bundle of the signed-in user's own data:
 * profile, chat sessions + messages, uploaded-file metadata, and billing
 * summaries. No tokens or secrets are included.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    const [user, chatSessions, uploadedFiles, subscriptions, payments] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            tier: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.chatSession.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          include: {
            messages: {
              orderBy: { timestamp: "asc" },
              select: {
                id: true,
                messageType: true,
                timestamp: true,
                userText: true,
                payload: true,
              },
            },
          },
        }),
        prisma.uploadedFile.findMany({
          where: { userId },
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            fileType: true,
            uploadStatus: true,
            uploadedAt: true,
          },
        }),
        prisma.subscription.findMany({
          where: { userId },
          select: {
            status: true,
            tier: true,
            billingCycle: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            createdAt: true,
          },
        }),
        prisma.payment.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: {
            amount: true,
            currency: true,
            status: true,
            invoiceUrl: true,
            createdAt: true,
          },
        }),
      ])

    const bundle = {
      exportedAt: new Date().toISOString(),
      profile: user,
      presentations: chatSessions,
      uploadedFiles,
      billing: { subscriptions, payments },
    }

    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="deckster-export-${date}.json"`,
      },
    })
  } catch (error) {
    console.error("[api/account/export] GET error:", error)
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 })
  }
}
