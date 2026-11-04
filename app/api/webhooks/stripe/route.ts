import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getStripe } from '@/lib/stripe/stripe'
import { prisma } from '@/lib/prisma'
import { creditWallet } from '@/lib/wallet'
import { tryResolveStripeSubscriptionPlan } from '@/lib/stripe/subscription-plan'
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
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`🔔 Webhook received: ${event.type}`)

  // B7: dedupe by event.id. A replay of an already-processed event is acked.
  const claim = await claimEvent(event)
  if (claim === 'duplicate') {
    console.log(`[stripe-webhook] Duplicate event ignored: ${event.id}`)
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, event)
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

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge)
        break

      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object as Stripe.Dispute)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    // Release the claim so Stripe's retry is processed, not dropped as a duplicate.
    if (claim === 'claimed') await releaseEvent(event.id)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

function eventObjectId(event: Stripe.Event): string | null {
  const obj = event.data?.object as { id?: unknown } | undefined
  return typeof obj?.id === 'string' ? obj.id : null
}

/**
 * Record event.id before processing. Returns 'duplicate' if already recorded,
 * 'untracked' if the table is not migrated yet (old behaviour, no dedupe).
 */
async function claimEvent(event: Stripe.Event): Promise<'claimed' | 'duplicate' | 'untracked'> {
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
        objectId: eventObjectId(event),
        eventCreated: event.created,
      },
    })
    return 'claimed'
  } catch (error) {
    if (isUniqueViolation(error)) return 'duplicate'
    if (isMissingTable(error)) {
      console.warn('[stripe-webhook] fe_stripe_webhook_events missing; dedupe disabled until migrated')
      return 'untracked'
    }
    throw error
  }
}

async function releaseEvent(eventId: string) {
  try {
    await prisma.stripeWebhookEvent.delete({ where: { id: eventId } })
  } catch {
    console.error('[stripe-webhook] Failed to release event claim:', eventId)
  }
}

/** Newest already-processed subscription event `created` for this subscription (excluding this event). */
async function newestProcessedSubscriptionEvent(subscriptionId: string, eventId: string): Promise<number | null> {
  try {
    const newest = await prisma.stripeWebhookEvent.findFirst({
      where: {
        objectId: subscriptionId,
        id: { not: eventId },
        type: { startsWith: 'customer.subscription.' },
      },
      orderBy: { eventCreated: 'desc' },
      select: { eventCreated: true },
    })
    return newest?.eventCreated ?? null
  } catch (error) {
    if (isMissingTable(error)) return null
    throw error
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('✅ Checkout session completed:', session.id)

  const userId = session.metadata?.userId
  if (!userId) {
    console.error('No userId in session metadata')
    return
  }

  if (session.metadata?.kind === 'wallet_topup') {
    // B8: delayed payment methods complete checkout unpaid; credit only when
    // paid (checkout.session.async_payment_succeeded re-enters here).
    if (!isTopupPaid(session)) {
      console.log(`[wallet_topup] Session ${session.id} not paid yet (payment_status=${session.payment_status}); not crediting`)
      return
    }
    await handleWalletTopup(session)
    return
  }

  // Subscription will be created by subscription.created event
  // Just log success here
  console.log(`User ${userId} completed checkout for subscription ${session.subscription}`)
}

async function handleWalletTopup(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const amountCents = parseInt(session.metadata?.amountCents || '0', 10)

  if (!userId || amountCents <= 0) {
    console.error('[wallet_topup] Missing userId or invalid amountCents in metadata')
    return
  }

  const sourceRef = `stripe_topup:${session.id}`

  try {
    const { balanceAfterCents } = await creditWallet({
      userId,
      amountCents,
      reason: 'card_topup',
      sourceRef,
      metadata: {
        stripeSessionId: session.id,
        stripePaymentIntent: typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
        packId: session.metadata?.packId ?? null,
      },
    })

    console.log(`✅ Wallet topped up: user=${userId}, credited=${amountCents}c, balance=${balanceAfterCents}c`)
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      console.log(`[wallet_topup] Already processed: ${sourceRef}`)
      return
    }
    throw error
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, event: Stripe.Event) {
  console.log('📝 Subscription updated:', subscription.id)

  // Validate before any writes. Unset/false preserves the legacy webhook payloads. With the flag on, a
  // subscription whose plan cannot be resolved (unknown price, price config missing or ambiguous, no item
  // or more than one base-plan item) takes exactly the legacy path below and logs one warning, so Stripe
  // gets a 200 and does not retry.
  const resolution = process.env.STRIPE_REAL_TIER_MAPPING_ENABLED === 'true'
    ? tryResolveStripeSubscriptionPlan(subscription.items, {
        STRIPE_STARTER_MONTHLY_PRICE_ID: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
        STRIPE_STARTER_YEARLY_PRICE_ID: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
        STRIPE_PRO_MONTHLY_PRICE_ID: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
        STRIPE_PRO_YEARLY_PRICE_ID: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
        STRIPE_MAX_MONTHLY_PRICE_ID: process.env.STRIPE_MAX_MONTHLY_PRICE_ID,
        STRIPE_MAX_YEARLY_PRICE_ID: process.env.STRIPE_MAX_YEARLY_PRICE_ID,
      })
    : null
  const mappedPlan = resolution?.ok ? resolution.plan : null
  if (resolution && !resolution.ok) {
    console.warn(`[stripe-real-tier] plan not resolved (${resolution.reason}), keeping the legacy tier; price ids: ${resolution.priceIds.join(', ') || 'none'}`)
  }

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

  const priceId = mappedPlan ? mappedPlan.priceId : subscription.items.data[0]?.price.id
  const productId = mappedPlan ? mappedPlan.productId : subscription.items.data[0]?.price.product as string

  // Determine tier and billing cycle
  let tier = 'pro'
  let billingCycle = 'monthly'

  if (mappedPlan) {
    tier = mappedPlan.tier
    billingCycle = mappedPlan.billingCycle
  } else if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) {
    billingCycle = 'yearly'
  }

  // Upsert subscription
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: {
      ...(mappedPlan ? { tier, billingCycle } : {}),
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

  // Record payment (B7: upsert by invoice id; a prior failed attempt or a
  // replay must not hit the unique index and 500 forever)
  const paid = {
    stripePaymentIntentId: invoice.payment_intent as string,
    stripeSubscriptionId: invoice.subscription as string,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: 'paid',
    invoiceUrl: invoice.hosted_invoice_url,
    invoicePdf: invoice.invoice_pdf,
  }
  await prisma.payment.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: paid,
    create: { userId: user.id, stripeInvoiceId: invoice.id, ...paid },
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

  // Record failed payment (B7: upsert; never overwrite an invoice already paid)
  const existing = await prisma.payment.findUnique({
    where: { stripeInvoiceId: invoice.id },
    select: { status: true },
  })
  if (existing?.status === 'paid') {
    console.log('[stripe-webhook] Late payment_failed for paid invoice ignored:', invoice.id)
    return
  }
  const failed = {
    stripePaymentIntentId: invoice.payment_intent as string,
    stripeSubscriptionId: invoice.subscription as string,
    amount: invoice.amount_due,
    currency: invoice.currency,
    status: 'failed',
    invoiceUrl: invoice.hosted_invoice_url,
  }
  await prisma.payment.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: failed,
    create: { userId: user.id, stripeInvoiceId: invoice.id, ...failed },
  })

  // TODO: Send email notification to user about failed payment

  console.log('✅ Failed payment recorded')
}

// B8: refunds/disputes on wallet top-ups claw the credited amount back (the
// balance may go negative, which blocks further spend).
function paymentIntentIdOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

async function findTopupCredit(paymentIntentId: string) {
  const topup = await prisma.walletTransaction.findFirst({
    where: { reason: 'card_topup', metadata: { path: ['stripePaymentIntent'], equals: paymentIntentId } },
    select: { userId: true, amountCents: true },
  })
  if (!topup) return null
  const clawed = await prisma.walletTransaction.aggregate({
    where: { reason: 'refund_clawback', metadata: { path: ['stripePaymentIntent'], equals: paymentIntentId } },
    _sum: { amountCents: true },
  })
  return { ...topup, alreadyDebitedCents: clawed._sum.amountCents ?? 0 }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const pi = paymentIntentIdOf(charge.payment_intent as string | { id: string } | null)
  if (!pi) return
  const topup = await findTopupCredit(pi)
  if (!topup) {
    console.log('[stripe-webhook] charge.refunded not a wallet top-up:', charge.id)
    return
  }
  const cents = refundClawbackCents({
    creditedCents: topup.amountCents,
    chargeAmount: charge.amount,
    amountRefunded: charge.amount_refunded,
    alreadyDebitedCents: topup.alreadyDebitedCents,
  })
  if (cents <= 0) return
  await clawbackWallet({
    userId: topup.userId,
    amountCents: cents,
    sourceRef: `stripe_refund:${charge.id}:${charge.amount_refunded}`,
    metadata: { stripePaymentIntent: pi, stripeChargeId: charge.id, kind: 'refund' },
  })
  console.log(`[stripe-webhook] Refund clawback: user=${topup.userId}, debited=${cents}c`)
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const pi = paymentIntentIdOf(dispute.payment_intent as string | { id: string } | null)
  if (!pi) return
  const topup = await findTopupCredit(pi)
  if (!topup) {
    console.log('[stripe-webhook] dispute not on a wallet top-up:', dispute.id)
    return
  }
  const cents = disputeClawbackCents(topup.amountCents, topup.alreadyDebitedCents)
  if (cents <= 0) return
  await clawbackWallet({
    userId: topup.userId,
    amountCents: cents,
    sourceRef: `stripe_dispute:${dispute.id}`,
    metadata: { stripePaymentIntent: pi, stripeDisputeId: dispute.id, kind: 'dispute' },
  })
  console.log(`[stripe-webhook] Dispute clawback: user=${topup.userId}, debited=${cents}c`)
}
