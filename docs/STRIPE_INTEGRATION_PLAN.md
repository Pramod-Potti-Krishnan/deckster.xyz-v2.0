# Stripe Payment Integration Plan

## Overview
Implement full Stripe subscription payment system with checkout, customer portal, and webhook synchronization for Free/Pro/Enterprise tiers.

## Architecture Decisions

### Technology Choices
- **Stripe Checkout** (not Stripe Elements) - Faster implementation with Stripe-hosted payment pages
- **Customer Portal** (not custom UI) - Stripe-managed subscription updates and billing history
- **Webhook-driven sync** - Webhooks as source of truth for subscription status
- **JWT integration** - Add subscription status to NextAuth session token
- **Stripe API Version**: `2024-11-20.acacia` (latest as of Nov 2024)

### Pricing Structure
Based on `/app/page.tsx`:
- **Free Tier**: $0/month
  - Basic AI agents
  - Up to 3 presentations
  - Descriptive placeholders for visuals
- **Pro Tier**: $29/month or $290/year (save $58)
  - Advanced AI agents
  - Unlimited presentations
  - DALL-E 3 image generation
  - Brand Kit customization
- **Enterprise Tier**: Custom pricing
  - All Pro features
  - Quality Analyst
  - Custom narrative frameworks
  - Contact sales flow (no Stripe integration)

---

## Phase 1: Setup & Configuration

### 1.1 Install Dependencies
```bash
pnpm add stripe @stripe/stripe-js
```

**Packages**:
- `stripe` - Server-side Stripe SDK
- `@stripe/stripe-js` - Client-side Stripe library

### 1.2 Environment Variables
Create/update `.env.local` with:

```env
# Stripe API Keys (from Stripe Dashboard > Developers > API keys)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Webhook signing secret (from Stripe Dashboard > Developers > Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_...

# Product Price IDs (from Stripe Dashboard > Products)
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

### 1.3 Stripe Dashboard Setup (Manual Steps)

**Step 1: Create Products**
1. Go to Stripe Dashboard > Products > Add Product
2. Create "Deckster Pro - Monthly"
   - Name: Deckster Pro (Monthly)
   - Price: $29.00 USD / month
   - Recurring billing
   - Copy the `price_xxx` ID to `STRIPE_PRO_MONTHLY_PRICE_ID`
3. Create "Deckster Pro - Yearly"
   - Name: Deckster Pro (Yearly)
   - Price: $290.00 USD / year
   - Recurring billing
   - Copy the `price_xxx` ID to `STRIPE_PRO_YEARLY_PRICE_ID`

**Step 2: Configure Customer Portal**
1. Go to Stripe Dashboard > Settings > Billing > Customer Portal
2. Enable features:
   - ✅ Update payment method
   - ✅ View invoice history
   - ✅ Cancel subscription (with optional retention offers)
   - ✅ Pause subscription (optional)
3. Configure cancellation flow:
   - ✅ Cancel at period end (default)
   - ✅ Cancel immediately (optional)
4. Save settings

**Step 3: Get API Keys**
1. Go to Stripe Dashboard > Developers > API keys
2. Copy "Publishable key" to `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Copy "Secret key" to `STRIPE_SECRET_KEY`

**Step 4: Install Stripe CLI (for local testing)**
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local dev server
stripe listen --forward-to http://localhost:3002/api/webhooks/stripe
# Copy the webhook signing secret (whsec_...) to STRIPE_WEBHOOK_SECRET
```

### 1.4 Unit Test
- [ ] Verify Stripe client initializes without errors
- [ ] Verify environment variables are loaded correctly

---

## Phase 2: Database Schema Updates

### 2.1 Update Prisma Schema

**File**: `/prisma/schema.prisma`

```prisma
model User {
  id            String    @id @default(cuid())
  email         String?   @unique
  name          String?
  tier          String    @default("free") // "free" | "pro" | "enterprise"
  approved      Boolean   @default(false)

  // Stripe Integration Fields
  stripeCustomerId       String?   @unique @map("stripe_customer_id")
  stripeSubscriptionId   String?   @unique @map("stripe_subscription_id")
  stripePriceId          String?   @map("stripe_price_id")
  stripeCurrentPeriodEnd DateTime? @map("stripe_current_period_end")

  // Existing fields...
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  accounts      Account[]
  sessions      Session[]
  chatSessions  ChatSession[]
  subscriptions Subscription[] // New relation

  @@map("users")
}

model Subscription {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Stripe Fields
  stripeSubscriptionId String   @unique @map("stripe_subscription_id")
  stripeCustomerId     String   @map("stripe_customer_id")
  stripePriceId        String   @map("stripe_price_id")
  stripeProductId      String   @map("stripe_product_id")

  // Subscription Details
  status               String   // "active" | "canceled" | "incomplete" | "incomplete_expired" | "past_due" | "trialing" | "unpaid"
  tier                 String   // "pro" | "enterprise"
  billingCycle         String   // "monthly" | "yearly"

  // Billing Period
  currentPeriodStart   DateTime @map("current_period_start")
  currentPeriodEnd     DateTime @map("current_period_end")
  cancelAtPeriodEnd    Boolean  @default(false) @map("cancel_at_period_end")
  canceledAt           DateTime? @map("canceled_at")

  // Trial Info
  trialStart           DateTime? @map("trial_start")
  trialEnd             DateTime? @map("trial_end")

  // Metadata
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  @@map("subscriptions")
  @@index([userId])
  @@index([stripeCustomerId])
  @@index([status])
}

model Payment {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")

  // Stripe Fields
  stripeInvoiceId      String   @unique @map("stripe_invoice_id")
  stripePaymentIntentId String? @unique @map("stripe_payment_intent_id")
  stripeSubscriptionId String?  @map("stripe_subscription_id")

  // Payment Details
  amount               Int      // Amount in cents
  currency             String   @default("usd")
  status               String   // "paid" | "failed" | "pending"

  // Invoice Details
  invoiceUrl           String?  @map("invoice_url")
  invoicePdf           String?  @map("invoice_pdf")

  // Metadata
  createdAt            DateTime @default(now()) @map("created_at")

  @@map("payments")
  @@index([userId])
  @@index([status])
}
```

### 2.2 Run Migration

```bash
npx prisma migrate dev --name add_stripe_subscription
npx prisma generate
```

### 2.3 Unit Test
- [ ] Verify migration applied successfully
- [ ] Verify new tables exist in database
- [ ] Verify Prisma client regenerated with new types

---

## Phase 3: Core Stripe Integration

### 3.1 Stripe Client Initialization

**File**: `/lib/stripe/stripe.ts`

```typescript
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
})
```

### 3.2 Stripe Utility Functions

**File**: `/lib/stripe/stripe-utils.ts`

```typescript
import { stripe } from './stripe'
import { prisma } from '@/lib/prisma'

/**
 * Get or create Stripe customer for user
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string | null
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  })

  // Return existing customer ID
  if (user?.stripeCustomerId) {
    return user.stripeCustomerId
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: {
      userId,
    },
  })

  // Save customer ID to database
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  })

  return customer.id
}

/**
 * Get user's active subscription
 */
export async function getUserSubscription(userId: string) {
  return await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['active', 'trialing'] },
    },
  })
}

/**
 * Check if user has active pro subscription
 */
export async function hasActiveProSubscription(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId)
  return subscription !== null
}
```

### 3.3 Create Checkout Session API

**File**: `/app/api/stripe/create-checkout-session/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { stripe } from '@/lib/stripe/stripe'
import { getOrCreateStripeCustomer } from '@/lib/stripe/stripe-utils'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId, billingCycle } = await req.json()

    // Validate price ID
    const validPriceIds = [
      process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    ]

    if (!validPriceIds.includes(priceId)) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 })
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(
      session.user.id,
      session.user.email,
      session.user.name
    )

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
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
```

### 3.4 Create Portal Session API

**File**: `/app/api/stripe/create-portal-session/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { stripe } from '@/lib/stripe/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 400 }
      )
    }

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('Error creating portal session:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
```

### 3.5 Stripe Webhook Handler (CRITICAL)

**File**: `/app/api/webhooks/stripe/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = headers().get('stripe-signature')

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

  const userId = subscription.metadata.userId
  if (!userId) {
    // Try to find user by customer ID
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: subscription.customer as string },
    })
    if (!user) {
      console.error('No user found for subscription')
      return
    }
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
      userId: userId || (await prisma.user.findUnique({
        where: { stripeCustomerId: subscription.customer as string },
      }))!.id,
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
```

**IMPORTANT**: Disable body parsing for webhook route:

**File**: `/app/api/webhooks/stripe/route.ts` (add export config)

```typescript
export const config = {
  api: {
    bodyParser: false,
  },
}
```

### 3.6 Unit Tests
- [ ] Test Stripe client initialization
- [ ] Test `getOrCreateStripeCustomer()` creates customer
- [ ] Test `getOrCreateStripeCustomer()` returns existing customer ID
- [ ] Test checkout session creation
- [ ] Test webhook signature verification
- [ ] Test each webhook event handler (subscription.created, updated, deleted, etc.)

---

## Phase 4: Frontend Components

### 4.1 UpgradeButton Component

**File**: `/components/billing/UpgradeButton.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface UpgradeButtonProps {
  priceId: string
  billingCycle: 'monthly' | 'yearly'
  label?: string
  className?: string
}

export function UpgradeButton({
  priceId,
  billingCycle,
  label = 'Upgrade to Pro',
  className = '',
}: UpgradeButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleUpgrade = async () => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, billingCycle }),
      })

      const { url, error } = await response.json()

      if (error) {
        throw new Error(error)
      }

      // Redirect to Stripe Checkout
      window.location.href = url
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to start checkout. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleUpgrade}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        label
      )}
    </Button>
  )
}
```

### 4.2 ManageSubscriptionButton Component

**File**: `/components/billing/ManageSubscriptionButton.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function ManageSubscriptionButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleManageSubscription = async () => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
      })

      const { url, error } = await response.json()

      if (error) {
        throw new Error(error)
      }

      // Redirect to Stripe Customer Portal
      window.location.href = url
    } catch (error) {
      console.error('Error opening portal:', error)
      alert('Failed to open billing portal. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleManageSubscription}
      disabled={isLoading}
      variant="outline"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        'Manage Subscription'
      )}
    </Button>
  )
}
```

### 4.3 Subscription Hook

**File**: `/hooks/use-subscription.ts`

```typescript
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface Subscription {
  status: string
  tier: string
  billingCycle: string
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
}

export function useSubscription() {
  const { data: session } = useSession()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchSubscription() {
      if (!session?.user) {
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch('/api/subscription')
        if (response.ok) {
          const data = await response.json()
          setSubscription(data.subscription)
        }
      } catch (error) {
        console.error('Error fetching subscription:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubscription()
  }, [session])

  return {
    subscription,
    isLoading,
    isActive: subscription?.status === 'active' || subscription?.status === 'trialing',
    isPro: subscription?.tier === 'pro',
  }
}
```

**Also create API route**: `/app/api/subscription/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getUserSubscription } from '@/lib/stripe/stripe-utils'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const subscription = await getUserSubscription(session.user.id)

  return NextResponse.json({ subscription })
}
```

### 4.4 Update Pricing Page

**File**: `/app/pricing/page.tsx` (modify existing)

```typescript
import { UpgradeButton } from '@/components/billing/UpgradeButton'

// In the pricing cards, replace the existing buttons with:

{tier.name === 'Pro' && (
  <UpgradeButton
    priceId={process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID!}
    billingCycle="monthly"
    label="Start Pro Trial"
    className="w-full"
  />
)}

// Add toggle for monthly/yearly and conditionally use YEARLY_PRICE_ID
```

### 4.5 Update Billing Page

**File**: `/app/billing/page.tsx` (replace mocks with real data)

```typescript
'use client'

import { useSubscription } from '@/hooks/use-subscription'
import { ManageSubscriptionButton } from '@/components/billing/ManageSubscriptionButton'
import { UpgradeButton } from '@/components/billing/UpgradeButton'

export default function BillingPage() {
  const { subscription, isLoading, isActive, isPro } = useSubscription()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!isPro) {
    return (
      <div>
        <h1>Upgrade to Pro</h1>
        <UpgradeButton
          priceId={process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID!}
          billingCycle="monthly"
        />
      </div>
    )
  }

  return (
    <div>
      <h1>Billing</h1>
      <div>
        <p>Status: {subscription?.status}</p>
        <p>Tier: {subscription?.tier}</p>
        <p>Billing: {subscription?.billingCycle}</p>
        <p>Renews: {new Date(subscription!.currentPeriodEnd).toLocaleDateString()}</p>
        {subscription?.cancelAtPeriodEnd && (
          <p>Your subscription will cancel at the end of the billing period.</p>
        )}
      </div>
      <ManageSubscriptionButton />
    </div>
  )
}
```

### 4.6 Unit Tests
- [ ] Test UpgradeButton redirects to Stripe Checkout
- [ ] Test ManageSubscriptionButton opens Customer Portal
- [ ] Test useSubscription hook fetches subscription data
- [ ] Test billing page displays correct subscription info

---

## Phase 5: NextAuth Integration

### 5.1 Update JWT Callback

**File**: `/lib/auth-options.ts`

```typescript
import { getUserSubscription } from '@/lib/stripe/stripe-utils'

// In authOptions callbacks:
callbacks: {
  async jwt({ token, user, trigger, session }) {
    // Existing logic...

    // Add subscription status to token
    if (token.sub) {
      const subscription = await getUserSubscription(token.sub)
      token.subscription = subscription ? {
        status: subscription.status,
        tier: subscription.tier,
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      } : null
    }

    return token
  },

  async session({ session, token }) {
    // Existing logic...

    // Add subscription to session
    if (token.subscription) {
      session.user.subscription = token.subscription
    }

    return session
  },
}
```

**Update TypeScript types**: `/types/next-auth.d.ts`

```typescript
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      subscription?: {
        status: string
        tier: string
        currentPeriodEnd: string
      } | null
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    subscription?: {
      status: string
      tier: string
      currentPeriodEnd: string
    } | null
  }
}
```

### 5.2 Unit Test
- [ ] Verify subscription status appears in session token
- [ ] Verify session.user.subscription is populated correctly

---

## Phase 6: Local Testing

### 6.1 Stripe CLI Setup

```bash
# Start webhook forwarding
stripe listen --forward-to http://localhost:3002/api/webhooks/stripe

# Copy the webhook signing secret (whsec_...) to .env.local as STRIPE_WEBHOOK_SECRET
```

### 6.2 Test Flows

**Test 1: New User Upgrade**
1. Create new account (sign up)
2. Go to /pricing
3. Click "Start Pro Trial"
4. Use test card: `4242 4242 4242 4242`, any future date, any CVC
5. Complete checkout
6. Verify redirect to /billing?success=true
7. Check database: User tier should be "pro"
8. Check Stripe Dashboard: Subscription should be active

**Test 2: Subscription Management**
1. As pro user, go to /billing
2. Click "Manage Subscription"
3. Verify Customer Portal opens
4. Try updating payment method
5. Try canceling subscription
6. Verify database updates (cancelAtPeriodEnd = true)

**Test 3: Payment Failure**
1. In Customer Portal, update card to test card: `4000 0000 0000 0341`
2. Wait for next billing attempt
3. Verify webhook received: invoice.payment_failed
4. Check database: Payment record with status "failed"

**Test 4: Cancellation**
1. Cancel subscription in portal
2. Verify webhook received: customer.subscription.deleted
3. Check database: User tier = "free", subscription status = "canceled"

### 6.3 Trigger Test Webhook Events

```bash
# Test checkout.session.completed
stripe trigger checkout.session.completed

# Test subscription.created
stripe trigger customer.subscription.created

# Test invoice.payment_succeeded
stripe trigger invoice.payment_succeeded
```

### 6.4 Integration Tests
- [ ] E2E test: Free user → Checkout → Pro user
- [ ] E2E test: Pro user → Cancel → Free user
- [ ] E2E test: Pro user → Payment fails → Still pro (grace period)

---

## Phase 7: Security Audit

### 7.1 Checklist
- [ ] Webhook signature verification implemented
- [ ] No `STRIPE_SECRET_KEY` exposed to client
- [ ] Price IDs validated server-side before checkout
- [ ] User authorization checks in all API routes
- [ ] HTTPS required for production webhooks
- [ ] Webhook endpoint uses raw body (bodyParser disabled)
- [ ] Environment variables documented in `.env.example`
- [ ] No hardcoded price IDs in client code

### 7.2 HTTPS Requirement
⚠️ Stripe webhooks require HTTPS in production. Ensure:
- Production deployment uses HTTPS (Vercel does this automatically)
- Webhook endpoint URL in Stripe Dashboard is `https://...`

---

## Phase 8: Production Deployment

### 8.1 Stripe Dashboard Configuration

**Step 1: Create Live Products**
1. Switch to "Live mode" in Stripe Dashboard
2. Recreate "Deckster Pro" products with live prices
3. Copy live price IDs

**Step 2: Get Live API Keys**
1. Go to Stripe Dashboard > Developers > API keys (Live mode)
2. Copy live publishable key
3. Copy live secret key

**Step 3: Configure Production Webhook**
1. Go to Stripe Dashboard > Developers > Webhooks (Live mode)
2. Add endpoint: `https://your-production-domain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy webhook signing secret

### 8.2 Vercel Environment Variables

Add to Vercel project settings:
```env
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_... (from production webhook)
STRIPE_PRO_MONTHLY_PRICE_ID=price_... (live)
STRIPE_PRO_YEARLY_PRICE_ID=price_... (live)
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

### 8.3 Initial Production Test

1. Create test account on production
2. Use real payment card (small amount like $1 test charge)
3. Upgrade to Pro
4. Verify subscription appears in Stripe Dashboard
5. Verify database updated correctly
6. Check webhook deliveries in Stripe Dashboard

### 8.4 Monitoring

- [ ] Set up Stripe webhook monitoring (Stripe Dashboard > Developers > Webhooks > View logs)
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Monitor failed payments and send user notifications
- [ ] Set up alerts for failed webhook deliveries

---

## Timeline

**Estimated: 7-10 days**

- Phase 1 (Setup): 1 day
- Phase 2 (Database): 1 day
- Phase 3 (Core API): 2-3 days
- Phase 4 (Frontend): 2 days
- Phase 5 (NextAuth): 1 day
- Phase 6 (Testing): 1-2 days
- Phase 7 (Security): 0.5 day
- Phase 8 (Deployment): 0.5 day

---

## Testing Strategy

### Unit Tests (Throughout Development)
- Stripe client initialization
- Utility functions (getOrCreateStripeCustomer, getUserSubscription)
- API route handlers
- Webhook signature verification
- Individual webhook event handlers
- Frontend components (button redirects)

### Integration Tests (Phase 6)
- E2E subscription creation flow
- E2E cancellation flow
- E2E payment failure handling

### Manual Testing (Phase 6 & 8)
- Local testing with Stripe CLI
- Test card payments
- Customer Portal flows
- Production smoke test with real payment

---

## Security Considerations

1. **Webhook Security**: ALWAYS verify webhook signatures
2. **Secret Keys**: NEVER expose `STRIPE_SECRET_KEY` to client
3. **Price Validation**: ALWAYS validate price IDs server-side
4. **HTTPS**: Production webhooks REQUIRE HTTPS
5. **User Authorization**: Verify user owns subscription before operations

---

## Rollback Plan

If issues arise in production:

1. **Immediate**: Disable webhook in Stripe Dashboard
2. **Database**: Prisma migration rollback: `npx prisma migrate resolve --rolled-back <migration_name>`
3. **Code**: Revert deployment in Vercel
4. **Users**: Existing subscriptions continue in Stripe (no data loss)
5. **Recovery**: Fix issues, re-enable webhook, sync subscription states manually

---

## Future Enhancements

- [ ] Add annual discount (10-20% off)
- [ ] Implement referral program
- [ ] Add usage-based billing (per presentation)
- [ ] Enterprise custom pricing quotes
- [ ] Email notifications for payment events
- [ ] In-app notification system for billing alerts
- [ ] Subscription analytics dashboard

---

## Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Next.js Integration Guide](https://stripe.com/docs/payments/checkout/how-checkout-works)
- [Stripe Webhooks Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)
