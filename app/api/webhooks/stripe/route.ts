import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getStripe } from '@/lib/stripe/stripe'
import { prisma } from '@/lib/prisma'
// BILLING-SECURITY begin route-imports
import { creditWallet, clawbackWallet } from '@/lib/wallet'
import { processStripeWebhookEvent } from '@/lib/billing/stripe-webhook'
// BILLING-SECURITY end route-imports
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

  // BILLING-SECURITY begin route-dispatch
  // B6/B7/B8/B9: the event is claimed and handled in one transaction (lib/billing/stripe-webhook.ts).
  const outcome = await processStripeWebhookEvent(event, { prisma, creditWallet, clawbackWallet, env: process.env })
  return NextResponse.json(outcome.body, { status: outcome.status })
  // BILLING-SECURITY end route-dispatch
}
// BILLING-SECURITY begin route-handlers
// BILLING-SECURITY end route-handlers
