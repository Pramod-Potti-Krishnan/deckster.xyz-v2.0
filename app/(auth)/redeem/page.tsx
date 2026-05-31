'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Ticket, LogOut, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function RedeemPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ creditedCents: number } | null>(null)

  useEffect(() => {
    if (session?.user?.approved) {
      router.push('/builder')
    }
  }, [session, router])

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

      setSuccess({ creditedCents: data.creditedCents })
      await update({ approved: true, walletBalanceCents: data.balanceCents })
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-pink-950/20 flex flex-col">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2 group w-fit">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 transition-transform group-hover:scale-105">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              deckster
            </span>
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
              <CardTitle className="text-2xl mb-2">Enter your access coupon</CardTitle>
              <CardDescription>
                Enter the coupon code you received to activate your account and get started with credits.
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
                  ${(success.creditedCents / 100).toFixed(2)} in credits added to your account.
                </p>
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
