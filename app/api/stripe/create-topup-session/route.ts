import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { getStripe } from "@/lib/stripe/stripe"
import { getOrCreateStripeCustomer } from "@/lib/stripe/stripe-utils"

const CREDIT_PACKS = [
  { id: "pack_10", label: "$10", amountCents: 1000 },
  { id: "pack_25", label: "$25", amountCents: 2500 },
  { id: "pack_50", label: "$50", amountCents: 5000 },
  { id: "pack_100", label: "$100", amountCents: 10000 },
] as const

type PackId = (typeof CREDIT_PACKS)[number]["id"]

const PACK_MAP = new Map(CREDIT_PACKS.map((p) => [p.id, p]))

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { packId } = await req.json()

    const pack = PACK_MAP.get(packId as PackId)
    if (!pack) {
      return NextResponse.json(
        { error: "Invalid credit pack", validPacks: CREDIT_PACKS.map((p) => p.id) },
        { status: 400 },
      )
    }

    const customerId = await getOrCreateStripeCustomer(
      session.user.id,
      session.user.email,
      session.user.name,
    )

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL

    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Deckster Credit Top-up — ${pack.label}`,
              description: `${pack.label} in credits for AI presentation generation`,
            },
            unit_amount: pack.amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: "wallet_topup",
        userId: session.user.id,
        packId: pack.id,
        amountCents: String(pack.amountCents),
      },
      success_url: `${baseUrl}/billing?topup=success&amount=${pack.amountCents}`,
      cancel_url: `${baseUrl}/billing?topup=canceled`,
    })

    return NextResponse.json({ sessionId: checkoutSession.id, url: checkoutSession.url })
  } catch (error) {
    console.error("[api/stripe/create-topup-session] Error:", error)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
