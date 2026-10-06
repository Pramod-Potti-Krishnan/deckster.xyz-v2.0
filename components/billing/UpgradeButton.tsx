'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface UpgradeButtonProps {
  priceId: string
  billingCycle: 'monthly' | 'yearly'
  label?: string
  className?: string
}

function safeRedirectUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !/^https:\/\/[^/?#\\\s]+/i.test(value) || /[\\\u0000-\u0020\u007f]/.test(value)) return null
  try {
    const authority = value.slice(value.indexOf('://') + 3).split(/[/?#]/, 1)[0]
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && parsed.hostname && !authority.includes('@') && !parsed.username && !parsed.password ? value : null
  } catch { return null }
}

export function UpgradeButton({ priceId, billingCycle, label = 'Upgrade to Pro', className = '' }: UpgradeButtonProps) {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const ownerId = !authLoading && isAuthenticated && user?.id ? user.id : null
  const lifetimeRef = useRef({ ownerId, mounted: false, generation: 0 })
  if (lifetimeRef.current.ownerId !== ownerId) {
    lifetimeRef.current = { ownerId, mounted: lifetimeRef.current.mounted, generation: 0 }
  }
  const lifetime = lifetimeRef.current
  const [busy, setBusy] = useState<typeof lifetime | null>(null)
  const [failure, setFailure] = useState<{ lifetime: typeof lifetime; message: string } | null>(null)
  const operationRef = useRef<{ lifetime: typeof lifetime; generation: number } | null>(null)

  useLayoutEffect(() => {
    lifetimeRef.current.mounted = true
    lifetimeRef.current.generation++
    return () => {
      lifetimeRef.current.mounted = false
      lifetimeRef.current.generation++
    }
  }, [])

  const isCurrent = (operation: NonNullable<typeof operationRef.current>) =>
    operationRef.current === operation && lifetimeRef.current === operation.lifetime &&
    operation.lifetime.mounted && Boolean(operation.lifetime.ownerId) &&
    operation.lifetime.generation === operation.generation

  const handleAction = async () => {
    // The captured opaque lifetime also refuses an observed A→B→A callback.
    if (!lifetime.ownerId || lifetimeRef.current !== lifetime || !lifetime.mounted ||
      (operationRef.current && isCurrent(operationRef.current))) return
    const operation = { lifetime, generation: lifetime.generation }
    operationRef.current = operation
    setBusy(lifetime)
    setFailure(null)
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, billingCycle }),
      })
      if (!isCurrent(operation)) return
      if (!response.ok) throw new Error('Request unavailable')
      const data = await response.json()
      if (!isCurrent(operation)) return
      const url = safeRedirectUrl(data?.url)
      if (data?.error || !url) throw new Error('Redirect unavailable')
      // URL shape is checked; only the server establishes payment provenance.
      if (isCurrent(operation)) window.location.href = url
    } catch {
      if (isCurrent(operation)) {
        operationRef.current = null
        setFailure({ lifetime, message: 'Failed to start checkout. Please try again.' })
        setBusy(null)
      }
    }
  }
  const isLoading = busy === lifetime
  const currentError = failure?.lifetime === lifetime ? failure.message : null
  return (
    <div className="min-w-0 space-y-2">
      <Button onClick={handleAction} disabled={!ownerId || isLoading} aria-busy={isLoading} className={className}>
        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</> : label}
      </Button>
      {currentError && <p role="alert" className="max-w-xs text-sm text-destructive dark:text-red-300">{currentError}</p>}
    </div>
  )
}
