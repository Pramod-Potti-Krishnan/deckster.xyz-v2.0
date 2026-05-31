import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"
import { getStripe } from "@/lib/stripe/stripe"

/**
 * DELETE /api/account
 * Permanently deletes the signed-in user's account and all associated data.
 *
 * Order matters:
 *  1. Cancel any live Stripe subscription (best-effort; never blocks deletion).
 *  2. Delete Payment rows explicitly — Payment has no cascade relation to User.
 *  3. Delete the User row — cascades Account, Session, ChatSession (+ messages,
 *     state cache, uploaded files), UploadedFile, and Subscription.
 *
 * The client is responsible for signing the user out after a 200.
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeSubscriptionId: true },
    })

    // 1. Best-effort Stripe subscription cancellation.
    if (user?.stripeSubscriptionId) {
      try {
        await getStripe().subscriptions.cancel(user.stripeSubscriptionId)
      } catch (stripeError) {
        // Log but continue — a Stripe hiccup must not strand the user's
        // deletion request. The webhook/portal can reconcile later.
        console.error("[api/account] Stripe cancel failed:", stripeError)
      }
    }

    // 2. Payment rows have no cascade relation — remove them explicitly.
    await prisma.payment.deleteMany({ where: { userId } })

    // 3. Delete the user; relations cascade.
    await prisma.user.delete({ where: { id: userId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[api/account] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
