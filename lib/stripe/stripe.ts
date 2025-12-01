import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

/**
 * Get the Stripe client instance (lazy initialization)
 * Only throws when actually called, not at import time
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia',
      typescript: true,
    })
  }
  return stripeInstance
}
