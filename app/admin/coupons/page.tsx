'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sparkles, Shield, RefreshCw, Plus, ToggleLeft, ToggleRight,
  AlertCircle, Ticket, Copy, Check,
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

interface Coupon {
  id: string
  code: string
  valueCents: number
  currency: string
  tier: string
  maxRedemptions: number | null
  timesRedeemed: number
  perUserLimit: number
  expiresAt: string | null
  active: boolean
  note: string | null
  createdBy: string | null
  createdAt: string
  _count: { redemptions: number }
}

export default function AdminCouponsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  const [newCode, setNewCode] = useState('')
  const [newValueDollars, setNewValueDollars] = useState('')
  const [newTier, setNewTier] = useState('starter')
  const [newMaxRedemptions, setNewMaxRedemptions] = useState('')
  const [newExpiresAt, setNewExpiresAt] = useState('')
  const [newNote, setNewNote] = useState('')

  const fetchCoupons = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/coupons')
      if (res.ok) {
        const data = await res.json()
        setCoupons(data.coupons || [])
        setIsAdmin(true)
      } else if (res.status === 403) {
        setIsAdmin(false)
      }
    } catch {
      setIsAdmin(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/admin/coupons')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin === null) {
      fetchCoupons()
    }
  }, [status, isAdmin])

  useEffect(() => {
    if (isAdmin === false) router.push('/builder')
  }, [isAdmin, router])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setCreateError(null)

    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode,
          valueCents: Math.round(parseFloat(newValueDollars) * 100),
          tier: newTier,
          maxRedemptions: newMaxRedemptions ? parseInt(newMaxRedemptions) : null,
          expiresAt: newExpiresAt || null,
          note: newNote || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error)
        return
      }

      setNewCode('')
      setNewValueDollars('')
      setNewTier('starter')
      setNewMaxRedemptions('')
      setNewExpiresAt('')
      setNewNote('')
      setShowCreate(false)
      await fetchCoupons()
    } catch {
      setCreateError('Failed to create coupon')
    } finally {
      setIsCreating(false)
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    setTogglingId(id)
    try {
      await fetch(`/api/admin/coupons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !active }),
      })
      await fetchCoupons()
    } finally {
      setTogglingId(null)
    }
  }

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (status === 'loading' || isLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/builder')} className="w-full">Go to Builder</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeCoupons = coupons.filter(c => c.active)
  const totalRedemptions = coupons.reduce((sum, c) => sum + c.timesRedeemed, 0)
  const totalCreditedCents = coupons.reduce((sum, c) => sum + c.timesRedeemed * c.valueCents, 0)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-0.5 group">
              <img src="/logo-icon.png" alt="" aria-hidden className="h-10 w-auto transition-transform group-hover:scale-105" />
              <img src="/logo-wordmark.png" alt="Deckster" className="h-8 w-auto transition-transform group-hover:scale-105" />
            </Link>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="gap-2">
                <Shield className="h-3 w-3" />
                Admin Panel
              </Badge>
              <Link href="/admin/users">
                <Button variant="outline" size="sm">Users</Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => router.push('/builder')}>
                Builder
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Coupon Management</h1>
              <p className="text-muted-foreground">Create and manage access coupons</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={fetchCoupons} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={() => setShowCreate(!showCreate)}>
                <Plus className="h-4 w-4 mr-2" />
                New Coupon
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{coupons.length}</div>
                <p className="text-sm text-muted-foreground">Total Coupons</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{activeCoupons.length}</div>
                <p className="text-sm text-muted-foreground">Active</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{totalRedemptions}</div>
                <p className="text-sm text-muted-foreground">
                  Total Redemptions (${(totalCreditedCents / 100).toFixed(2)} credited)
                </p>
              </CardContent>
            </Card>
          </div>

          {showCreate && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Coupon</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      placeholder="e.g. WELCOME50"
                      className="font-mono uppercase"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="value">Value (USD)</Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={newValueDollars}
                      onChange={(e) => setNewValueDollars(e.target.value)}
                      placeholder="e.g. 50.00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tier">Plan tier</Label>
                    <select
                      id="tier"
                      value={newTier}
                      onChange={(e) => setNewTier(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="premium">Max</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxRedemptions">Max Redemptions (blank = unlimited)</Label>
                    <Input
                      id="maxRedemptions"
                      type="number"
                      min="1"
                      value={newMaxRedemptions}
                      onChange={(e) => setNewMaxRedemptions(e.target.value)}
                      placeholder="e.g. 100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiresAt">Expires At (optional)</Label>
                    <Input
                      id="expiresAt"
                      type="datetime-local"
                      value={newExpiresAt}
                      onChange={(e) => setNewExpiresAt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="note">Note (internal)</Label>
                    <Input
                      id="note"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="e.g. For beta testers batch 1"
                    />
                  </div>
                  {createError && (
                    <p className="text-sm text-red-600 md:col-span-2">{createError}</p>
                  )}
                  <div className="md:col-span-2 flex gap-2">
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Ticket className="h-4 w-4 mr-2" />}
                      Create Coupon
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {coupons.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No coupons yet. Create one to get started.
                  </div>
                ) : (
                  coupons.map((coupon) => (
                    <div
                      key={coupon.id}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-lg ${
                        !coupon.active ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            className="font-mono text-lg font-bold tracking-wider flex items-center gap-1 hover:text-purple-600 transition-colors"
                            onClick={() => copyCode(coupon.code, coupon.id)}
                            title="Click to copy"
                          >
                            {coupon.code}
                            {copiedId === coupon.id ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                          <Badge variant={coupon.active ? 'default' : 'secondary'}>
                            {coupon.active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline">
                            ${(coupon.valueCents / 100).toFixed(2)}
                          </Badge>
                          <Badge variant="secondary">
                            {coupon.tier === "premium" ? "Max" : coupon.tier.charAt(0).toUpperCase() + coupon.tier.slice(1)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-x-3">
                          <span>
                            Redeemed: {coupon.timesRedeemed}
                            {coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : ''}
                          </span>
                          {coupon.expiresAt && (
                            <span>
                              Expires: {format(new Date(coupon.expiresAt), 'MMM d, yyyy')}
                            </span>
                          )}
                          <span>Created: {format(new Date(coupon.createdAt), 'MMM d, yyyy')}</span>
                        </div>
                        {coupon.note && (
                          <p className="text-xs text-muted-foreground italic">{coupon.note}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle(coupon.id, coupon.active)}
                        disabled={togglingId === coupon.id}
                      >
                        {togglingId === coupon.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : coupon.active ? (
                          <>
                            <ToggleRight className="h-4 w-4 mr-1" />
                            Disable
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-4 w-4 mr-1" />
                            Enable
                          </>
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
