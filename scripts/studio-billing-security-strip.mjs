// FRONTEND-1 for PROGRAM-1 (Pass 4, 4 Nov): billing security, SECURITY-AUDIT-BILLING B4-B9, on program1/billing-security-fixes.
// Every line this change adds to an EXISTING file carries the marker BILLING-SECURITY (a whole token). A single marked line is a pure insertion. A run of lines that REPLACES base code sits between
// "// BILLING-SECURITY begin <id>" and "// BILLING-SECURITY end <id>"; BILLING_SECURITY_WAS[file][id] is the base text it replaced ('' for an insertion). stripBillingSecurity puts every block's base
// text back and takes every single marked line out, so each owned file is BASE_COMMIT's byte for byte (scripts/test-studio-billing-security.mjs proves it, and that a stray edit is caught).
// Owned files: app/api/webhooks/stripe/route.ts (the dispatch moves to lib/billing/stripe-webhook.ts), app/api/coupons/redeem/route.ts (B4 claim, B5 always on, B9 P2002), lib/wallet.ts (B9 race, B8 clawback),
// app/api/stripe/create-checkout-session/route.ts (B9 billing cycle) and prisma/schema.prisma (the StripeWebhookEvent model).
// Two older proofs are taught to read through the registry (BILLING_SECURITY_EDITS: [line now, line before], whole lines): scripts/test-stripe-real-tier-webhook.mjs and scripts/test-studio-p2-admin.mjs.
// scripts/test-studio-payments-open-soon.mjs already reads through it. How the older pins reach this strip: three LATER-CHANGE lines in scripts/studio-later-changes.mjs. Plain node, no imports, no I/O.

export const BASE_COMMIT = '3e1ce88e' // origin/studio-v4-dev-preparation-code merged into program1/billing-security-fixes
export const BILLING_SECURITY_FLAG = 'STUDIO_BILLING_COUPON_TIER_HARDENING'
export const BILLING_SECURITY_MARKER_RE = /(?<![\w-])BILLING-SECURITY(?![\w-])/
const BEGIN_RE = /^\s*\/\/ BILLING-SECURITY begin (\S+)$/
const END_RE = /^\s*\/\/ BILLING-SECURITY end (\S+)$/

/** Per owned file, per block id: the base text the block replaced. */
export const BILLING_SECURITY_WAS = {
  "app/api/webhooks/stripe/route.ts": {
    "route-imports": "import { creditWallet } from '@/lib/wallet'\nimport { tryResolveStripeSubscriptionPlan } from '@/lib/stripe/subscription-plan'\n",
    "route-dispatch": "  try {\n    switch (event.type) {\n      case 'checkout.session.completed':\n        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)\n        break\n\n      case 'customer.subscription.created':\n      case 'customer.subscription.updated':\n        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)\n        break\n\n      case 'customer.subscription.deleted':\n        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)\n        break\n\n      case 'invoice.payment_succeeded':\n        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)\n        break\n\n      case 'invoice.payment_failed':\n        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)\n        break\n\n      default:\n        console.log(`Unhandled event type: ${event.type}`)\n    ",
    "route-handlers": "\n    return NextResponse.json({ received: true })\n  } catch (error) {\n    console.error('Error processing webhook:', error)\n    return NextResponse.json(\n      { error: 'Webhook processing failed' },\n      { status: 500 }\n    )\n  }\n}\n\nasync function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {\n  console.log('\u2705 Checkout session completed:', session.id)\n\n  const userId = session.metadata?.userId\n  if (!userId) {\n    console.error('No userId in session metadata')\n    return\n  }\n\n  if (session.metadata?.kind === 'wallet_topup') {\n    await handleWalletTopup(session)\n    return\n  }\n\n  // Subscription will be created by subscription.created event\n  // Just log success here\n  console.log(`User ${userId} completed checkout for subscription ${session.subscription}`)\n}\n\nasync function handleWalletTopup(session: Stripe.Checkout.Session) {\n  const userId = session.metadata?.userId\n  const amountCents = parseInt(session.metadata?.amountCents || '0', 10)\n\n  if (!userId || amountCents <= 0) {\n    console.error('[wallet_topup] Missing userId or invalid amountCents in metadata')\n    return\n  }\n\n  const sourceRef = `stripe_topup:${session.id}`\n\n  try {\n    const { balanceAfterCents } = await creditWallet({\n      userId,\n      amountCents,\n      reason: 'card_topup',\n      sourceRef,\n      metadata: {\n        stripeSessionId: session.id,\n        stripePaymentIntent: typeof session.payment_intent === 'string'\n          ? session.payment_intent\n          : session.payment_intent?.id ?? null,\n        packId: session.metadata?.packId ?? null,\n      },\n    })\n\n    console.log(`\u2705 Wallet topped up: user=${userId}, credited=${amountCents}c, balance=${balanceAfterCents}c`)\n  } catch (error: any) {\n    if (error?.message?.includes('Unique constraint')) {\n      console.log(`[wallet_topup] Already processed: ${sourceRef}`)\n      return\n    }\n    throw error\n  }\n}\n\nasync function handleSubscriptionUpdated(subscription: Stripe.Subscription) {\n  console.log('\ud83d\udcdd Subscription updated:', subscription.id)\n\n  // Validate before any writes. Unset/false preserves the legacy webhook payloads. With the flag on, a\n  // subscription whose plan cannot be resolved (unknown price, price config missing or ambiguous, no item\n  // or more than one base-plan item) takes exactly the legacy path below and logs one warning, so Stripe\n  // gets a 200 and does not retry.\n  const resolution = process.env.STRIPE_REAL_TIER_MAPPING_ENABLED === 'true'\n    ? tryResolveStripeSubscriptionPlan(subscription.items, {\n        STRIPE_STARTER_MONTHLY_PRICE_ID: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,\n        STRIPE_STARTER_YEARLY_PRICE_ID: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,\n        STRIPE_PRO_MONTHLY_PRICE_ID: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,\n        STRIPE_PRO_YEARLY_PRICE_ID: process.env.STRIPE_PRO_YEARLY_PRICE_ID,\n        STRIPE_MAX_MONTHLY_PRICE_ID: process.env.STRIPE_MAX_MONTHLY_PRICE_ID,\n        STRIPE_MAX_YEARLY_PRICE_ID: process.env.STRIPE_MAX_YEARLY_PRICE_ID,\n      })\n    : null\n  const mappedPlan = resolution?.ok ? resolution.plan : null\n  if (resolution && !resolution.ok) {\n    console.warn(`[stripe-real-tier] plan not resolved (${resolution.reason}), keeping the legacy tier; price ids: ${resolution.priceIds.join(', ') || 'none'}`)\n  }\n\n  let userId = subscription.metadata.userId\n\n  if (!userId) {\n    // Try to find user by customer ID\n    const user = await prisma.user.findUnique({\n      where: { stripeCustomerId: subscription.customer as string },\n    })\n    if (!user) {\n      console.error('No user found for subscription')\n      return\n    }\n    userId = user.id\n  }\n\n  const priceId = mappedPlan ? mappedPlan.priceId : subscription.items.data[0]?.price.id\n  const productId = mappedPlan ? mappedPlan.productId : subscription.items.data[0]?.price.product as string\n\n  // Determine tier and billing cycle\n  let tier = 'pro'\n  let billingCycle = 'monthly'\n\n  if (mappedPlan) {\n    tier = mappedPlan.tier\n    billingCycle = mappedPlan.billingCycle\n  } else if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) {\n    billingCycle = 'yearly'\n  }\n\n  // Upsert subscription\n  await prisma.subscription.upsert({\n    where: { stripeSubscriptionId: subscription.id },\n    update: {\n      ...(mappedPlan ? { tier, billingCycle } : {}),\n      status: subscription.status,\n      stripePriceId: priceId,\n      stripeProductId: productId,\n      currentPeriodStart: new Date(subscription.current_period_start * 1000),\n      currentPeriodEnd: new Date(subscription.current_period_end * 1000),\n      cancelAtPeriodEnd: subscription.cancel_at_period_end,\n      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,\n      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,\n      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,\n    },\n    create: {\n      userId,\n      stripeSubscriptionId: subscription.id,\n      stripeCustomerId: subscription.customer as string,\n      stripePriceId: priceId,\n      stripeProductId: productId,\n      status: subscription.status,\n      tier,\n      billingCycle,\n      currentPeriodStart: new Date(subscription.current_period_start * 1000),\n      currentPeriodEnd: new Date(subscription.current_period_end * 1000),\n      cancelAtPeriodEnd: subscription.cancel_at_period_end,\n      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,\n      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,\n    },\n  })\n\n  // Update user tier\n  const newTier = subscription.status === 'active' || subscription.status === 'trialing' ? tier : 'free'\n  await prisma.user.update({\n    where: {\n      stripeCustomerId: subscription.customer as string,\n    },\n    data: {\n      tier: newTier,\n      stripeSubscriptionId: subscription.id,\n      stripePriceId: priceId,\n      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),\n    },\n  })\n\n  console.log(`\u2705 Updated user tier to: ${newTier}`)\n}\n\nasync function handleSubscriptionDeleted(subscription: Stripe.Subscription) {\n  console.log('\ud83d\uddd1\ufe0f Subscription deleted:', subscription.id)\n\n  // Update subscription status\n  await prisma.subscription.update({\n    where: { stripeSubscriptionId: subscription.id },\n    data: {\n      status: 'canceled',\n      canceledAt: new Date(),\n    },\n  })\n\n  // Downgrade user to free tier\n  await prisma.user.update({\n    where: { stripeCustomerId: subscription.customer as string },\n    data: {\n      tier: 'free',\n      stripeSubscriptionId: null,\n      stripePriceId: null,\n      stripeCurrentPeriodEnd: null,\n    },\n  })\n\n  console.log('\u2705 User downgraded to free tier')\n}\n\nasync function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {\n  console.log('\ud83d\udcb0 Invoice payment succeeded:', invoice.id)\n\n  // Find user\n  const user = await prisma.user.findUnique({\n    where: { stripeCustomerId: invoice.customer as string },\n  })\n\n  if (!user) {\n    console.error('No user found for invoice')\n    return\n  }\n\n  // Record payment\n  await prisma.payment.create({\n    data: {\n      userId: user.id,\n      stripeInvoiceId: invoice.id,\n      stripePaymentIntentId: invoice.payment_intent as string,\n      stripeSubscriptionId: invoice.subscription as string,\n      amount: invoice.amount_paid,\n      currency: invoice.currency,\n      status: 'paid',\n      invoiceUrl: invoice.hosted_invoice_url,\n      invoicePdf: invoice.invoice_pdf,\n    },\n  })\n\n  console.log('\u2705 Payment recorded')\n}\n\nasync function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {\n  console.log('\u274c Invoice payment failed:', invoice.id)\n\n  // Find user\n  const user = await prisma.user.findUnique({\n    where: { stripeCustomerId: invoice.customer as string },\n  })\n\n  if (!user) {\n    console.error('No user found for invoice')\n    return\n  }\n\n  // Record failed payment\n  await prisma.payment.create({\n    data: {\n      userId: user.id,\n      stripeInvoiceId: invoice.id,\n      stripePaymentIntentId: invoice.payment_intent as string,\n      stripeSubscriptionId: invoice.subscription as string,\n      amount: invoice.amount_due,\n      currency: invoice.currency,\n      status: 'failed',\n      invoiceUrl: invoice.hosted_invoice_url,\n    },\n  })\n\n  // TODO: Send email notification to user about failed payment\n\n  console.log('\u2705 Failed payment recorded')\n}\n"
  },
  "app/api/coupons/redeem/route.ts": {
    "redeem-precheck": "      if (coupon.maxRedemptions !== null && coupon.timesRedeemed >= coupon.maxRedemptions) {\n        throw new RedeemError(\"This coupon has been fully redeemed\")\n      }\n",
    "redeem-claim": "      await tx.coupon.update({\n        where: { id: coupon.id },\n        data: { timesRedeemed: { increment: 1 } },\n      })\n",
    "redeem-tier": "      await tx.user.update({\n        where: { id: session.user.id },\n        data: {\n          approved: true,\n          approvedAt: new Date(),\n          approvedBy: `coupon:${coupon.code}`,\n          tier: coupon.tier,\n        },\n      })\n\n      return { balanceCents: balanceAfterCents, valueCents: coupon.valueCents, tier: coupon.tier }\n",
    "redeem-p2002": ""
  },
  "lib/wallet.ts": {
    "wallet-negative": "    if (user.walletBalanceCents < 0) {\n",
    "wallet-race": "  return prisma.$transaction(async (txClient) => run(txClient))\n",
    "wallet-clawback": ""
  },
  "app/api/stripe/create-checkout-session/route.ts": {
    "checkout-cycle": "    const { priceId, billingCycle } = await req.json()\n"
  },
  "prisma/schema.prisma": {
    "schema-model": ""
  }
}

export const BILLING_SECURITY_FILES = Object.keys(BILLING_SECURITY_WAS)

/** The older proofs this change teaches: [line now, line before] per edit. */
export const BILLING_SECURITY_EDITS = {
  "scripts/test-stripe-real-tier-webhook.mjs": [
    [
      "import { stackMutants, stackScope } from './studio-stack-tolerant.mjs'; import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (BILLING-SECURITY): the later-changes registry\n",
      "import { stackMutants, stackScope } from './studio-stack-tolerant.mjs'\n"
    ],
    [
      "const read = relative => stripLaterChanges(relative, fs.readFileSync(path.join(ROOT, relative), 'utf8')) // LATER-CHANGES: registry read (BILLING-SECURITY): a registered later change's lines come out before the route is run or mutated\n",
      "const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8')\n"
    ]
  ],
  "scripts/test-studio-p2-admin.mjs": [
    [
      "    eq(stripLaterChanges(rel, read(rel)), baseSource(rel), `${label}: ${rel} is the base commit's file, byte for byte`) // LATER-CHANGES: registry read (BILLING-SECURITY): every registered later change's lines come out (D1 in cleanup-sessions, billing security in the redeem route)\n",
      "    eq(rel === 'app/api/admin/cleanup-sessions/route.ts' ? stripLaterChanges(rel, read(rel)) : read(rel), baseSource(rel), `${label}: ${rel} is the base commit's file, byte for byte`)\n"
    ]
  ]
}

export const BILLING_SECURITY_PIN_FILES = Object.keys(BILLING_SECURITY_EDITS)

export const BILLING_SECURITY_NEW_FILES = [
  'lib/billing/security.ts',
  'lib/billing/stripe-webhook.ts',
  'migrations/add-stripe-webhook-events.sql',
  'scripts/studio-billing-security-strip.mjs',
  'scripts/test-studio-billing-security.mjs',
]

export const BILLING_SECURITY_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...BILLING_SECURITY_PIN_FILES]

export const BILLING_SECURITY_SCOPE_FILES = new Set([...BILLING_SECURITY_FILES, ...BILLING_SECURITY_NEW_FILES, ...BILLING_SECURITY_OWN_EDITS])

export const BILLING_SECURITY_ENV_BLOCK = "# STUDIO BILLING COUPON TIER HARDENING (FRONTEND-1 for PROGRAM-1; SECURITY-AUDIT-BILLING B8). Server-only; on only for the string \"true\"; default off, and then refunds and disputes behave as today.\n# On: a Stripe charge.refunded or charge.dispute.created on a wallet top-up claws back its share once per refund id / dispute id, capped in total at the credited top-up, and the balance may go negative (B8).\n# Leave off until PK rules. Not behind this flag: B5 (a coupon grants credits and approval only, never a tier; PK 4 Nov), the event claim, paid-only top-ups and the price-mapped tier.\nSTUDIO_BILLING_COUPON_TIER_HARDENING=\"false\"\n"

/** The file without this change: blocks get their base text back, single marked lines go. Any other file comes back as it is. */
export function stripBillingSecurity(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in BILLING_SECURITY_EDITS) return (BILLING_SECURITY_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
  const was = BILLING_SECURITY_WAS[rel]
  if (!was) return text
  const lines = text.split('\n'), out = []
  for (let i = 0; i < lines.length; i++) {
    const begin = lines[i].match(BEGIN_RE)
    if (begin) {
      let j = i + 1
      while (j < lines.length && lines[j].match(END_RE)?.[1] !== begin[1]) j++
      if (j >= lines.length || !(begin[1] in was)) return text // unbalanced or unknown block: not ours to strip, the proof fails on it
      out.push({ block: was[begin[1]] })
      i = j
      continue
    }
    if (BILLING_SECURITY_MARKER_RE.test(lines[i])) continue
    out.push(lines[i])
  }
  // a block stands for its lines and their newline; its base text carries its own newlines
  let result = ''
  for (let k = 0; k < out.length; k++) {
    const piece = out[k]
    if (typeof piece === 'string') result += piece + (k < out.length - 1 ? '\n' : '')
    else result += piece.block
  }
  return result
}
