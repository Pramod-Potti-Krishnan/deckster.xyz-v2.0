/**
 * The Stripe webhook's event processing (SECURITY-AUDIT-BILLING B6/B7/B8/B9), after the signature check.
 * app/api/webhooks/stripe/route.ts verifies the signature and hands the event here with its dependencies, so
 * scripts/test-studio-billing-security.mjs can run this file against a mocked Prisma.
 *
 * - B7 claim: the event id is claimed (INSERT ... ON CONFLICT DO NOTHING) in the SAME interactive transaction as
 *   every write the handler makes. A crash or a throw rolls the claim back with the writes, so Stripe's retry is
 *   processed, never dropped as a duplicate; a concurrent duplicate waits on the primary key and then sees count 0.
 * - Missing fe_stripe_webhook_events (P2021): fail closed, 500, so Stripe retries once the migration is applied.
 * - B6: the tier comes from the price (lib/stripe/subscription-plan.ts, the STRIPE_*_PRICE_ID map). An active
 *   subscription whose price is unknown is never granted a tier: logged, nothing written, 500 (Stripe retries).
 * - B8: a top-up is credited only when payment_status is paid (and on async_payment_succeeded). With
 *   STUDIO_BILLING_COUPON_TIER_HARDENING on, each refund (by refund id) and dispute (by dispute id) of a top-up
 *   claws back its share, capped in total at the credited amount (user row locked); the balance may go negative.
 */
import type Stripe from 'stripe'
import { tryResolveStripeSubscriptionPlan } from '@/lib/stripe/subscription-plan'
import {
  isCouponTierHardeningOn,
  isMissingTable,
  isStaleSubscriptionEvent,
  isTopupPaid,
  refundClawbackCents,
} from '@/lib/billing/security'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tx = any
type WalletFn = (params: any) => Promise<{ balanceAfterCents: number; transactionId: string }>

export interface StripeWebhookDeps {
  prisma: { $transaction: (fn: (tx: Tx) => Promise<unknown>, options?: Record<string, unknown>) => Promise<unknown> }
  creditWallet: WalletFn
  clawbackWallet: WalletFn
  env: Record<string, string | undefined>
}

export interface StripeWebhookOutcome {
  status: number
  body: Record<string, unknown>
}

class UnknownPlanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnknownPlanError'
  }
}

const ACTIVE = new Set(['active', 'trialing'])

/** One clawback row per refund id (refund:<re_id>) and per dispute id (dispute:<dp_id>); the total per payment intent is capped at the top-up. */
export const clawbackSourceRef = (key: string) => `stripe_clawback:${key}`

function objectIdOf(event: Stripe.Event): string | null {
  const obj = event.data?.object as { id?: unknown } | undefined
  return typeof obj?.id === 'string' ? obj.id : null
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

export async function processStripeWebhookEvent(event: Stripe.Event, deps: StripeWebhookDeps): Promise<StripeWebhookOutcome> {
  try {
    const outcome = await deps.prisma.$transaction(async (tx: Tx) => {
      // The claim and the handler's writes commit or roll back together.
      const claim = await tx.stripeWebhookEvent.createMany({
        data: [{ id: event.id, type: event.type, objectId: objectIdOf(event), eventCreated: BigInt(event.created) }],
        skipDuplicates: true,
      })
      if (claim.count !== 1) return 'duplicate'
      await dispatch(event, tx, deps)
      return 'processed'
    }, { timeout: 20000 })
    if (outcome === 'duplicate') {
      console.log(`[stripe-webhook] Duplicate event ignored: ${event.id}`)
      return { status: 200, body: { received: true, duplicate: true } }
    }
    return { status: 200, body: { received: true } }
  } catch (error) {
    if (isMissingTable(error)) {
      console.error('[stripe-webhook] fe_stripe_webhook_events is missing (apply migrations/add-stripe-webhook-events.sql); failing closed so Stripe retries')
      return { status: 500, body: { error: 'Webhook event store unavailable' } }
    }
    console.error('Error processing webhook:', error instanceof Error ? `${error.name}: ${error.message}` : error)
    return { status: 500, body: { error: 'Webhook processing failed' } }
  }
}

async function dispatch(event: Stripe.Event, tx: Tx, deps: StripeWebhookDeps) {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return handleCheckoutSession(event.data.object as Stripe.Checkout.Session, tx, deps)
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(event.data.object as Stripe.Subscription, event, tx, deps)
    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(event.data.object as Stripe.Subscription, tx)
    case 'invoice.payment_succeeded':
      return handleInvoice(event.data.object as Stripe.Invoice, 'paid', tx)
    case 'invoice.payment_failed':
      return handleInvoice(event.data.object as Stripe.Invoice, 'failed', tx)
    case 'charge.refunded':
    case 'charge.dispute.created':
      if (isCouponTierHardeningOn(deps.env)) return handleClawback(event, tx, deps)
      console.log(`Unhandled event type: ${event.type}`)
      return
    default:
      console.log(`Unhandled event type: ${event.type}`)
  }
}

async function handleCheckoutSession(session: Stripe.Checkout.Session, tx: Tx, deps: StripeWebhookDeps) {
  const userId = session.metadata?.userId
  if (!userId) {
    console.error('No userId in session metadata')
    return
  }
  if (session.metadata?.kind !== 'wallet_topup') {
    console.log(`User ${userId} completed checkout for subscription ${session.subscription}`)
    return
  }
  // B8: only credit once Stripe says the money is in (an async method completes later with async_payment_succeeded).
  if (!isTopupPaid(session)) {
    console.log(`[wallet_topup] ${session.id} not paid yet (${session.payment_status}); not credited`)
    return
  }
  const amountCents = parseInt(session.metadata?.amountCents || '0', 10)
  if (amountCents <= 0) {
    console.error('[wallet_topup] Missing userId or invalid amountCents in metadata')
    return
  }
  const { balanceAfterCents } = await deps.creditWallet({
    userId,
    amountCents,
    reason: 'card_topup',
    sourceRef: `stripe_topup:${session.id}`,
    metadata: {
      stripeSessionId: session.id,
      stripePaymentIntent: idOf(session.payment_intent as string | { id: string } | null),
      packId: session.metadata?.packId ?? null,
    },
    tx,
  })
  console.log(`✅ Wallet topped up: credited=${amountCents}c, balance=${balanceAfterCents}c`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, event: Stripe.Event, tx: Tx, deps: StripeWebhookDeps) {
  // B7: an older event arriving after a newer one for the same subscription is ignored.
  const newest = await tx.stripeWebhookEvent.findFirst({
    where: { objectId: subscription.id, id: { not: event.id }, type: { startsWith: 'customer.subscription.' } },
    orderBy: { eventCreated: 'desc' },
    select: { eventCreated: true },
  })
  if (isStaleSubscriptionEvent(event.created, newest?.eventCreated)) {
    console.log(`[stripe-webhook] Stale ${event.type} for ${subscription.id} ignored`)
    return
  }
  const existing = await tx.subscription.findUnique({ where: { stripeSubscriptionId: subscription.id }, select: { status: true } })
  if (existing?.status === 'canceled') {
    console.log(`[stripe-webhook] ${event.type} for canceled ${subscription.id} ignored`)
    return
  }

  // B6: the tier is the price's (STRIPE_*_PRICE_ID), never a hard-coded 'pro'.
  const resolution = tryResolveStripeSubscriptionPlan(subscription.items, {
    STRIPE_STARTER_MONTHLY_PRICE_ID: deps.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    STRIPE_STARTER_YEARLY_PRICE_ID: deps.env.STRIPE_STARTER_YEARLY_PRICE_ID,
    STRIPE_PRO_MONTHLY_PRICE_ID: deps.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    STRIPE_PRO_YEARLY_PRICE_ID: deps.env.STRIPE_PRO_YEARLY_PRICE_ID,
    STRIPE_MAX_MONTHLY_PRICE_ID: deps.env.STRIPE_MAX_MONTHLY_PRICE_ID,
    STRIPE_MAX_YEARLY_PRICE_ID: deps.env.STRIPE_MAX_YEARLY_PRICE_ID,
  })
  const plan = resolution.ok ? resolution.plan : null
  const active = ACTIVE.has(subscription.status)
  if (!plan && active) {
    // Fail closed: nothing is granted or written; the 500 makes Stripe retry, and the event shows as failing in Stripe.
    const priceIds = resolution.ok ? [] : resolution.priceIds
    console.warn(`[stripe-webhook] plan not resolved (${resolution.ok ? 'ok' : resolution.reason}) for ${subscription.id}; no tier granted; price ids: ${priceIds.join(', ') || 'none'}`)
    throw new UnknownPlanError('Subscription price is not a known plan')
  }

  let userId = subscription.metadata?.userId
  if (!userId) {
    const user = await tx.user.findUnique({ where: { stripeCustomerId: subscription.customer as string } })
    if (!user) {
      console.error('No user found for subscription')
      return
    }
    userId = user.id
  }

  const item = subscription.items.data[0]
  const priceId = plan ? plan.priceId : item?.price.id
  const productId = plan ? plan.productId : (idOf(item?.price.product as string | { id: string } | null) ?? undefined)
  const period = {
    status: subscription.status,
    stripePriceId: priceId,
    stripeProductId: productId,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
  }
  await tx.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: {
      ...period,
      ...(plan ? { tier: plan.tier, billingCycle: plan.billingCycle } : {}),
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    },
    create: {
      ...period,
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      tier: plan ? plan.tier : 'free',
      billingCycle: plan ? plan.billingCycle : 'monthly',
    },
  })

  const newTier = active && plan ? plan.tier : 'free'
  await tx.user.update({
    where: { stripeCustomerId: subscription.customer as string },
    data: {
      tier: newTier,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  })
  console.log(`✅ Updated user tier to: ${newTier}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, tx: Tx) {
  const existing = await tx.subscription.findUnique({ where: { stripeSubscriptionId: subscription.id }, select: { status: true } })
  if (!existing) {
    console.log(`[stripe-webhook] subscription.deleted for ${subscription.id}: nothing to cancel`)
    return
  }
  await tx.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: 'canceled', canceledAt: new Date() },
  })
  await tx.user.update({
    where: { stripeCustomerId: subscription.customer as string },
    data: { tier: 'free', stripeSubscriptionId: null, stripePriceId: null, stripeCurrentPeriodEnd: null },
  })
  console.log('✅ User downgraded to free tier')
}

async function handleInvoice(invoice: Stripe.Invoice, status: 'paid' | 'failed', tx: Tx) {
  const user = await tx.user.findUnique({ where: { stripeCustomerId: invoice.customer as string } })
  if (!user) {
    console.error('No user found for invoice')
    return
  }
  if (status === 'failed') {
    // A late payment_failed never overwrites an invoice already paid.
    const existing = await tx.payment.findUnique({ where: { stripeInvoiceId: invoice.id }, select: { status: true } })
    if (existing?.status === 'paid') {
      console.log('[stripe-webhook] Late payment_failed for paid invoice ignored:', invoice.id)
      return
    }
  }
  const row = {
    stripePaymentIntentId: invoice.payment_intent as string,
    stripeSubscriptionId: invoice.subscription as string,
    amount: status === 'paid' ? invoice.amount_paid : invoice.amount_due,
    currency: invoice.currency,
    status,
    invoiceUrl: invoice.hosted_invoice_url,
    ...(status === 'paid' ? { invoicePdf: invoice.invoice_pdf } : {}),
  }
  // Upsert by invoice id: a retry or a prior failed attempt never hits the unique index and 500s forever.
  await tx.payment.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: row,
    create: { userId: user.id, stripeInvoiceId: invoice.id, ...row },
  })
}

async function handleClawback(event: Stripe.Event, tx: Tx, deps: StripeWebhookDeps) {
  const object = event.data.object as Stripe.Charge | Stripe.Dispute
  const pi = idOf(object.payment_intent as string | { id: string } | null)
  if (!pi) return
  const topup = await tx.walletTransaction.findFirst({
    where: { reason: 'card_topup', metadata: { path: ['stripePaymentIntent'], equals: pi } },
    select: { userId: true, amountCents: true },
  })
  if (!topup) {
    console.log(`[stripe-webhook] ${event.type} is not on a wallet top-up`)
    return
  }
  // Lock the user row first: every clawback for this payment intent serializes here, so the sum read below and the
  // debit commit together and concurrent refund + dispute can never exceed the credited top-up.
  await tx.user.update({ where: { id: topup.userId }, data: { walletBalanceCents: { increment: 0 } }, select: { id: true } })
  const clawed = await tx.walletTransaction.aggregate({
    where: { reason: 'refund_clawback', metadata: { path: ['stripePaymentIntent'], equals: pi } },
    _sum: { amountCents: true },
  })
  let remaining = Math.max(0, topup.amountCents - (clawed._sum.amountCents ?? 0))
  // One wallet row per refund id and per dispute id: a replay dedupes, a second partial refund claws its own share.
  const pieces: Array<{ sourceRef: string; cents: number; id: string; kind: string }> = []
  if (event.type === 'charge.refunded') {
    const charge = object as Stripe.Charge
    for (const refund of charge.refunds?.data ?? []) {
      if (refund.status && refund.status !== 'succeeded' && refund.status !== 'pending') continue
      const cents = refundClawbackCents({ creditedCents: topup.amountCents, chargeAmount: charge.amount, amountRefunded: refund.amount, alreadyDebitedCents: 0 })
      pieces.push({ sourceRef: clawbackSourceRef(`refund:${refund.id}`), cents, id: refund.id, kind: 'refund' })
    }
    if (!charge.refunds?.data?.length) console.warn(`[stripe-webhook] charge.refunded ${charge.id} carries no refund list; nothing clawed back`)
  } else {
    pieces.push({ sourceRef: clawbackSourceRef(`dispute:${object.id}`), cents: topup.amountCents, id: object.id, kind: 'dispute' })
  }
  for (const piece of pieces) {
    const already = await tx.walletTransaction.findUnique({ where: { sourceRef: piece.sourceRef }, select: { id: true } })
    if (already) continue
    const cents = Math.min(piece.cents, remaining)
    if (cents <= 0) continue
    await deps.clawbackWallet({
      userId: topup.userId,
      amountCents: cents,
      sourceRef: piece.sourceRef,
      metadata: { stripePaymentIntent: pi, stripeObjectId: piece.id, kind: piece.kind },
      tx,
    })
    remaining -= cents
    console.log(`[stripe-webhook] ${event.type} clawback (${piece.kind}): debited=${cents}c`)
  }
}
