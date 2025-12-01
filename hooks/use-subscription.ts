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
