'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { PAYMENTS_OPEN_SOON_LINE, STUDIO_PAYMENTS_OPEN_SOON_ENABLED } from '@/lib/studio-payments-open-soon'

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

  // NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON (default off): no checkout can start; the button is disabled and says so. Off: the button below, as before.
  if (STUDIO_PAYMENTS_OPEN_SOON_ENABLED) {
    return (
      <Button disabled aria-disabled="true" title={PAYMENTS_OPEN_SOON_LINE} className={className}>
        {PAYMENTS_OPEN_SOON_LINE}
      </Button>
    )
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
