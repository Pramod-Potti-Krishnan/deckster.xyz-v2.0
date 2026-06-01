'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Ticket, LogOut, Loader2 } from 'lucide-react'
import Link from 'next/link'

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  premium: 'Max',
}

function sanitizePlan(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.toLowerCase()
  return v in PLAN_LABELS ? v : null
}

function RedeemContent() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState('')
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ creditedCents: number; tier: string } | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  // Resolve the plan the user picked on the pricing page: query param first,
  // then localStorage fallback (in case the OAuth round-trip dropped the query).
  useEffect(() => {
    const fromQuery = sanitizePlan(searchParams.get('plan'))
    if (fromQuery) {
      setSelectedPlan(fromQuery)
      return
    }
    try {
      setSelectedPlan(sanitizePlan(localStorage.getItem('selectedPlan')))
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, [searchParams])

  useEffect(() => {
    // Only auto-redirect when there's nothing to acknowledge on this screen.
    if (session?.user?.approved && !success) {
      router.push('/builder')
    }
  }, [session, router, success])

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || isRedeeming) return

    setIsRedeeming(true)
    setError(null)

    try {
      const res = await fetch('/api/coupons/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to redeem coupon')
        return
      }

      setSuccess({ creditedCents: data.creditedCents, tier: data.tier })
      try {
        localStorage.removeItem('selectedPlan')
      } catch {
        /* ignore */
      }
      await update({
        approved: true,
        walletBalanceCents: data.balanceCents,
        tier: data.tier,
      })
      // Give the session a beat to refresh, then head into the builder.
      setTimeout(() => router.push('/builder'), 1200)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsRedeeming(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    router.push('/')
    return null
  }

  const planLabel = selectedPlan ? PLAN_LABELS[selectedPlan] : null
  // Coupon is authoritative: warn if the redeemed tier differs from the picked plan.
  const tierMismatch =
    success && selectedPlan && success.tier !== selectedPlan
      ? PLAN_LABELS[success.tier] ?? success.tier
      : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-pink-950/20 flex flex-col">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-0.5 group w-fit">
            <img src="/logo-icon.png" alt="" aria-hidden className="h-10 w-auto transition-transform group-hover:scale-105" />
            <img src="/logo-wordmark.png" alt="Deckster" className="h-8 w-auto transition-transform group-hover:scale-105" />
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center">
              <Ticket className="h-10 w-10 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-2xl mb-2">
                {planLabel ? `Activate your ${planLabel} plan` : 'Enter your access coupon'}
              </CardTitle>
              <CardDescription>
                {planLabel
                  ? `Enter the coupon code you received to unlock the ${planLabel} plan and get started with credits.`
                  : 'Enter the coupon code you received to activate your account and get started with credits.'}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {success ? (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center space-y-2">
                <p className="font-semibold text-green-900 dark:text-green-100">
                  Coupon redeemed!
                </p>
                <p className="text-sm text-green-700 dark:text-green-200">
                  {PLAN_LABELS[success.tier] ?? success.tier} plan activated · $
                  {(success.creditedCents / 100).toFixed(2)} in credits added.
                </p>
                {tierMismatch && (
                  <p className="text-xs text-green-700 dark:text-green-200">
                    Your code activated the <strong>{tierMismatch}</strong> plan.
                  </p>
                )}
                <p className="text-sm text-green-700 dark:text-green-200">
                  Redirecting to the builder...
                </p>
              </div>
            ) : (
              <form onSubmit={handleRedeem} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase())
                      setError(null)
                    }}
                    placeholder="e.g. WELCOME50"
                    className="text-center text-lg tracking-widest font-mono uppercase"
                    autoFocus
                    disabled={isRedeeming}
                  />
                  {error && (
                    <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={!code.trim() || isRedeeming}
                  className="w-full"
                >
                  {isRedeeming ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Redeeming...
                    </>
                  ) : (
                    'Redeem Coupon'
                  )}
                </Button>
              </form>
            )}

            <div className="flex items-center justify-between pt-4 border-t text-sm text-muted-foreground">
              <span>Signed in as {session.user?.email}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function RedeemPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <RedeemContent />
    </Suspense>
  )
}
