import { getStripe } from './stripe'
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
  const customer = await getStripe().customers.create({
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
