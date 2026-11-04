import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getStripe } from '@/lib/stripe/stripe'
import { getOrCreateStripeCustomer } from '@/lib/stripe/stripe-utils'
import { billingCycleForPrice } from '@/lib/billing/security'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId } = await req.json()

    // Validate price ID; billingCycle is derived server-side from it (B9),
    // never taken from the client body.
    const billingCycle = billingCycleForPrice(priceId, {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    })

    if (!billingCycle) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 })
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(
      session.user.id,
      session.user.email,
      session.user.name
    )

    // Create checkout session
    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/pricing?canceled=true`,
      metadata: {
        userId: session.user.id,
        billingCycle,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
      },
    })

    return NextResponse.json({ sessionId: checkoutSession.id, url: checkoutSession.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
