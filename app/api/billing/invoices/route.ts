import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/billing/invoices
 * Real invoice history for the signed-in user, read from Payment rows
 * persisted by the Stripe webhook (app/api/webhooks/stripe/route.ts).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payments = await prisma.payment.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        invoiceUrl: true,
        invoicePdf: true,
        createdAt: true,
      },
    })

    const invoices = payments.map((p) => ({
      id: p.id,
      date: p.createdAt.toISOString(),
      // amount is stored in cents
      amount: p.amount / 100,
      currency: p.currency,
      status: p.status,
      downloadUrl: p.invoicePdf || p.invoiceUrl || null,
    }))

    return NextResponse.json({ invoices })
  } catch (error) {
    console.error("[api/billing/invoices] GET error:", error)
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 })
  }
}
