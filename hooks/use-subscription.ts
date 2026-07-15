import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'

interface Subscription {
  status: string
  tier: string
  billingCycle: string
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
}

export function useSubscription() {
  const { data: session, status: sessionStatus } = useSession()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [resolvedAccountKey, setResolvedAccountKey] = useState<string | null>(null)
  const requestGenerationRef = useRef(0)

  const accountKey = useMemo(() => {
    if (sessionStatus !== 'authenticated') return `auth:${sessionStatus}`
    const identity = session?.user?.id || session?.user?.email
    return identity ? `user:${identity}` : 'user:missing-identity'
  }, [session?.user?.email, session?.user?.id, sessionStatus])

  const currentAccountKeyRef = useRef(accountKey)
  currentAccountKeyRef.current = accountKey
  const hasAuthenticatedUser = sessionStatus === 'authenticated' && Boolean(session?.user)

  useEffect(() => {
    const generation = ++requestGenerationRef.current
    const controller = new AbortController()
    const isCurrent = () =>
      !controller.signal.aborted &&
      requestGenerationRef.current === generation &&
      currentAccountKeyRef.current === accountKey

    // The public return value is account-keyed below, so the prior account's
    // subscription is hidden immediately, before this effect gets a chance to
    // clear the backing state.
    setSubscription(null)
    setResolvedAccountKey(null)

    if (sessionStatus === 'loading') {
      setIsLoading(true)
      return () => controller.abort()
    }

    if (!hasAuthenticatedUser) {
      setIsLoading(false)
      setResolvedAccountKey(accountKey)
      return () => controller.abort()
    }

    setIsLoading(true)

    async function fetchSubscription() {
      try {
        const response = await fetch('/api/subscription', { signal: controller.signal })
        if (response.ok) {
          const data = await response.json()
          if (isCurrent()) setSubscription(data.subscription ?? null)
        } else if (isCurrent()) {
          setSubscription(null)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Error fetching subscription:', error)
          if (isCurrent()) setSubscription(null)
        }
      } finally {
        if (isCurrent()) {
          setIsLoading(false)
          setResolvedAccountKey(accountKey)
        }
      }
    }

    void fetchSubscription()
    return () => controller.abort()
  }, [accountKey, hasAuthenticatedUser, sessionStatus])

  const accountResolved = resolvedAccountKey === accountKey
  const currentSubscription = accountResolved ? subscription : null

  return {
    subscription: currentSubscription,
    isLoading: sessionStatus === 'loading' || isLoading || !accountResolved,
    isActive: currentSubscription?.status === 'active' || currentSubscription?.status === 'trialing',
    isPro: currentSubscription?.tier === 'pro',
    accountKey,
    resolvedAccountKey,
  }
}
