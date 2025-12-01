import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`🔔 Webhook received: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('✅ Checkout session completed:', session.id)

  const userId = session.metadata?.userId
  if (!userId) {
    console.error('No userId in session metadata')
    return
  }

  // Subscription will be created by subscription.created event
  // Just log success here
  console.log(`User ${userId} completed checkout for subscription ${session.subscription}`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('📝 Subscription updated:', subscription.id)

  let userId = subscription.metadata.userId

  if (!userId) {
    // Try to find user by customer ID
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: subscription.customer as string },
    })
    if (!user) {
      console.error('No user found for subscription')
      return
    }
    userId = user.id
  }

  const priceId = subscription.items.data[0]?.price.id
  const productId = subscription.items.data[0]?.price.product as string

  // Determine tier and billing cycle
  let tier = 'pro'
  let billingCycle = 'monthly'

  if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) {
    billingCycle = 'yearly'
  }

  // Upsert subscription
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: {
      status: subscription.status,
      stripePriceId: priceId,
      stripeProductId: productId,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    },
    create: {
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      stripePriceId: priceId,
      stripeProductId: productId,
      status: subscription.status,
      tier,
      billingCycle,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    },
  })

  // Update user tier
  const newTier = subscription.status === 'active' || subscription.status === 'trialing' ? tier : 'free'
  await prisma.user.update({
    where: {
      stripeCustomerId: subscription.customer as string,
    },
    data: {
      tier: newTier,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  })

  console.log(`✅ Updated user tier to: ${newTier}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('🗑️ Subscription deleted:', subscription.id)

  // Update subscription status
  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: 'canceled',
      canceledAt: new Date(),
    },
  })

  // Downgrade user to free tier
  await prisma.user.update({
    where: { stripeCustomerId: subscription.customer as string },
    data: {
      tier: 'free',
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
    },
  })

  console.log('✅ User downgraded to free tier')
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('💰 Invoice payment succeeded:', invoice.id)

  // Find user
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: invoice.customer as string },
  })

  if (!user) {
    console.error('No user found for invoice')
    return
  }

  // Record payment
  await prisma.payment.create({
    data: {
      userId: user.id,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: invoice.payment_intent as string,
      stripeSubscriptionId: invoice.subscription as string,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'paid',
      invoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
    },
  })

  console.log('✅ Payment recorded')
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('❌ Invoice payment failed:', invoice.id)

  // Find user
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: invoice.customer as string },
  })

  if (!user) {
    console.error('No user found for invoice')
    return
  }

  // Record failed payment
  await prisma.payment.create({
    data: {
      userId: user.id,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: invoice.payment_intent as string,
      stripeSubscriptionId: invoice.subscription as string,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: 'failed',
      invoiceUrl: invoice.hosted_invoice_url,
    },
  })

  // TODO: Send email notification to user about failed payment

  console.log('✅ Failed payment recorded')
}
