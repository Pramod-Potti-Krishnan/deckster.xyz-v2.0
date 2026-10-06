"use client"

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useSubscription } from "@/hooks/use-subscription"
import { ManageSubscriptionButton } from "@/components/billing/ManageSubscriptionButton"
import { UpgradeButton } from "@/components/billing/UpgradeButton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CreditCard, Calendar, Crown, Sparkles, Shield, Check, X, AlertCircle, Download, Wallet, Plus, Loader2 } from "lucide-react"
import { useWallet } from "@/hooks/use-wallet"
import { features } from "@/lib/config"
import "@/components/billing/studio-billing.css"

interface Invoice {
  id: string
  date: string
  amount: number
  status: string
  downloadUrl?: string | null
}

interface Usage {
  presentationCount: number
  storageBytes: number
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground" data-studio-billing-loading={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true" ? "true" : undefined}>Loading…</div>}>
      <BillingAccountBoundary />
    </Suspense>
  )
}

type BillingLifetime = { ownerId: string | null; mounted: boolean; generation: number }
type ReadState<T> = { lifetime: BillingLifetime; data: T | null; status: "loading" | "ready" | "error" }

function safeRedirectUrl(value: unknown): string | null {
  if (typeof value !== "string" || !/^https:\/\/[^/?#\\\s]+/i.test(value) || /[\\\u0000-\u0020\u007f]/.test(value)) return null
  try {
    const authority = value.slice(value.indexOf("://") + 3).split(/[/?#]/, 1)[0]
    const parsed = new URL(value)
    return parsed.protocol === "https:" && parsed.hostname && !authority.includes("@") && !parsed.username && !parsed.password ? value : null
  } catch { return null }
}

function parseUsage(value: unknown): Usage {
  const data = value as Partial<Usage> | null
  if (!data || !Number.isSafeInteger(data.presentationCount) || !Number.isSafeInteger(data.storageBytes) ||
    Number(data.presentationCount) < 0 || Number(data.storageBytes) < 0) throw new Error("Usage unavailable")
  return { presentationCount: data.presentationCount!, storageBytes: data.storageBytes! }
}

function parseInvoices(value: unknown): Invoice[] {
  const data = value as { invoices?: unknown } | null
  if (!data || !Array.isArray(data.invoices)) throw new Error("Invoices unavailable")
  return data.invoices.map((item: unknown) => {
    const invoice = item as Partial<Invoice> | null
    if (!invoice || typeof invoice.id !== "string" || !invoice.id || typeof invoice.date !== "string" ||
      !Number.isFinite(Date.parse(invoice.date)) || typeof invoice.amount !== "number" || !Number.isFinite(invoice.amount) ||
      typeof invoice.status !== "string" || (invoice.downloadUrl != null && typeof invoice.downloadUrl !== "string")) throw new Error("Invoices unavailable")
    return { id: invoice.id, date: invoice.date, amount: invoice.amount, status: invoice.status, downloadUrl: invoice.downloadUrl }
  })
}

function BillingAccountBoundary() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/auth/signin")
  }, [isLoading, isAuthenticated, router])
  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground" data-studio-billing-loading={studioShell ? "true" : undefined}>Loading…</div>
  if (!isAuthenticated) return null
  if (!user?.id) return <p role="status" className="py-12 text-center text-sm text-muted-foreground">Billing is unavailable until your account is verified.</p>
  // Isolate unchanged child hooks: a detached old wallet instance may settle,
  // but it cannot publish private rows into the next account's page.
  return <BillingPageContent key={JSON.stringify([user.id, user.tier])} />
}

function BillingPageContent() {
  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { subscription, isLoading: isLoadingSubscription, isPro } = useSubscription()
  const wallet = useWallet()
  const ownerId = !isLoading && !isLoadingSubscription && isAuthenticated && user?.id ? user.id : null
  const lifetimeRef = useRef<BillingLifetime>({ ownerId, mounted: false, generation: 0 })
  if (lifetimeRef.current.ownerId !== ownerId) {
    lifetimeRef.current = { ownerId, mounted: lifetimeRef.current.mounted, generation: 0 }
  }
  const lifetime = lifetimeRef.current
  const [usageRead, setUsageRead] = useState<ReadState<Usage> | null>(null)
  const [invoiceRead, setInvoiceRead] = useState<ReadState<Invoice[]> | null>(null)
  const [usageAttempt, setUsageAttempt] = useState(0)
  const [invoiceAttempt, setInvoiceAttempt] = useState(0)
  const usageGeneration = useRef(0)
  const invoiceGeneration = useRef(0)
  const [topUpBusy, setTopUpBusy] = useState<{ lifetime: BillingLifetime; packId: string } | null>(null)
  const [topUpFailure, setTopUpFailure] = useState<{ lifetime: BillingLifetime; message: string } | null>(null)
  const topUpOperation = useRef<{ lifetime: BillingLifetime; generation: number } | null>(null)
  const [walletBusy, setWalletBusy] = useState<BillingLifetime | null>(null)
  const [walletFailure, setWalletFailure] = useState<{ lifetime: BillingLifetime; message: string } | null>(null)
  const walletOperation = useRef<{ lifetime: BillingLifetime; generation: number } | null>(null)
  const [confirmedWallet, setConfirmedWallet] = useState<{ lifetime: BillingLifetime; balanceCents: number; transactions: typeof wallet.transactions } | null>(null)

  useLayoutEffect(() => {
    lifetimeRef.current.mounted = true
    lifetimeRef.current.generation++
    return () => { lifetimeRef.current.mounted = false; lifetimeRef.current.generation++ }
  }, [])
  const capture = () => lifetime.ownerId && lifetimeRef.current === lifetime && lifetime.mounted
    ? { lifetime, generation: lifetime.generation } : null
  const isCurrent = (operation: { lifetime: BillingLifetime; generation: number }) =>
    lifetimeRef.current === operation.lifetime && operation.lifetime.mounted && Boolean(operation.lifetime.ownerId) &&
    operation.lifetime.generation === operation.generation

  useEffect(() => {
    const operation = capture()
    if (!operation) return
    const generation = ++usageGeneration.current
    const controller = new AbortController()
    const current = () => isCurrent(operation) && generation === usageGeneration.current && !controller.signal.aborted
    setUsageRead(previous => ({ lifetime, data: previous?.lifetime === lifetime ? previous.data : null, status: "loading" }))
    void (async () => {
      try {
        const response = await fetch("/api/account/usage", { signal: controller.signal })
        if (!current()) return
        if (!response.ok) throw new Error("Usage unavailable")
        const body = await response.json()
        if (!current()) return
        const data = parseUsage(body)
        if (current()) setUsageRead({ lifetime, data, status: "ready" })
      } catch {
        if (current()) setUsageRead(previous => ({ lifetime, data: previous?.lifetime === lifetime ? previous.data : null, status: "error" }))
      }
    })()
    return () => controller.abort()
  }, [lifetime, usageAttempt])

  useEffect(() => {
    const operation = capture()
    if (!operation || !user || user.tier === "free") return
    const generation = ++invoiceGeneration.current
    const controller = new AbortController()
    const current = () => isCurrent(operation) && generation === invoiceGeneration.current && !controller.signal.aborted
    setInvoiceRead(previous => ({ lifetime, data: previous?.lifetime === lifetime ? previous.data : null, status: "loading" }))
    void (async () => {
      try {
        const response = await fetch("/api/billing/invoices", { signal: controller.signal })
        if (!current()) return
        if (!response.ok) throw new Error("Invoices unavailable")
        const body = await response.json()
        if (!current()) return
        const data = parseInvoices(body)
        if (current()) setInvoiceRead({ lifetime, data, status: "ready" })
      } catch {
        if (current()) setInvoiceRead(previous => ({ lifetime, data: previous?.lifetime === lifetime ? previous.data : null, status: "error" }))
      }
    })()
    return () => controller.abort()
  }, [lifetime, invoiceAttempt, user?.tier])

  const walletRefreshing = walletBusy === lifetime
  const walletValid = Number.isFinite(wallet.balanceCents) && Array.isArray(wallet.transactions)
  useEffect(() => {
    const operation = capture()
    if (operation && !walletRefreshing && !wallet.isLoading && !wallet.error && walletValid && isCurrent(operation)) {
      setConfirmedWallet({ lifetime, balanceCents: wallet.balanceCents, transactions: wallet.transactions })
    }
  }, [lifetime, walletRefreshing, wallet.isLoading, wallet.error, wallet.balanceCents, wallet.transactions, walletValid])

  if (isLoading || isLoadingSubscription || !ownerId || !user) {
    return <div className="py-12 text-center text-sm text-muted-foreground" data-studio-billing-loading={studioShell ? "true" : undefined}>Loading…</div>
  }
  const usageState = usageRead?.lifetime === lifetime ? usageRead : null
  const invoiceState = invoiceRead?.lifetime === lifetime ? invoiceRead : null
  const usage = usageState?.data ?? null
  const invoices = invoiceState?.data ?? null
  const topUpLoading = topUpBusy?.lifetime === lifetime ? topUpBusy.packId : null
  const topUpError = topUpFailure?.lifetime === lifetime ? topUpFailure.message : null
  const walletError = wallet.error || (walletFailure?.lifetime === lifetime ? walletFailure.message : null) || (!wallet.isLoading && !walletValid ? "Wallet balance is unavailable." : null)
  const priorWallet = confirmedWallet?.lifetime === lifetime ? confirmedWallet : null
  const walletData = !wallet.isLoading && !walletError && walletValid ? wallet : priorWallet
  const handleUpgrade = () => { if (capture()) router.push("/pricing") }

  const handleWalletRefresh = async () => {
    const operation = capture()
    if (!operation || (walletOperation.current && isCurrent(walletOperation.current))) return
    walletOperation.current = operation
    setWalletBusy(lifetime)
    setWalletFailure(null)
    try { await wallet.refetch() }
    catch {
      if (isCurrent(operation) && walletOperation.current === operation) setWalletFailure({ lifetime, message: "Failed to refresh wallet. Please try again." })
    } finally {
      if (isCurrent(operation) && walletOperation.current === operation) { walletOperation.current = null; setWalletBusy(null) }
    }
  }

  const handleTopUp = async (packId: string) => {
    const operation = capture()
    if (!operation || (topUpOperation.current && isCurrent(topUpOperation.current))) return
    topUpOperation.current = operation
    setTopUpBusy({ lifetime, packId })
    setTopUpFailure(null)
    const current = () => isCurrent(operation) && topUpOperation.current === operation
    try {
      const response = await fetch("/api/stripe/create-topup-session", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId }),
      })
      if (!current()) return
      if (!response.ok) throw new Error("Checkout unavailable")
      const data = await response.json()
      if (!current()) return
      const url = safeRedirectUrl(data?.url)
      if (data?.error || !url) throw new Error("Redirect unavailable")
      if (current()) window.location.href = url
    } catch {
      if (current()) setTopUpFailure({ lifetime, message: "Failed to start credit checkout. Please try again." })
    } finally {
      if (current()) { topUpOperation.current = null; setTopUpBusy(null) }
    }
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8" data-studio-billing={studioShell ? "true" : undefined}>
      <div className="mb-8" data-studio-billing-heading={studioShell ? "true" : undefined}>
        <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and billing information</p>
      </div>

      <div className="grid gap-6" data-studio-billing-grid={studioShell ? "true" : undefined}>
        {/* Current Plan Card */}
        <Card data-studio-billing-card={studioShell ? "plan" : undefined}>
          <CardHeader data-studio-billing-header={studioShell ? "true" : undefined}>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>Your subscription details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4" data-studio-billing-body={studioShell ? "true" : undefined}>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4 dark:bg-slate-900" data-studio-billing-plan-summary={studioShell ? "true" : undefined}>
              <div className="flex items-center space-x-4">
                <div
                  data-studio-billing-plan-icon={studioShell ? "true" : undefined}
                  className={`rounded-lg p-3 ${
                    user.tier === "premium"
                      ? "bg-purple-100 dark:bg-purple-900/30"
                      : user.tier === "pro"
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  {user.tier === "premium" ? (
                    <Sparkles className="h-6 w-6 text-purple-700 dark:text-purple-400" />
                  ) : user.tier === "pro" ? (
                    <Crown className="h-6 w-6 text-blue-700 dark:text-blue-400" />
                  ) : (
                    <Shield className="h-6 w-6 text-gray-700 dark:text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {user.tier === "premium"
                      ? "Max Plan"
                      : user.tier && user.tier !== "free"
                        ? `${user.tier.charAt(0).toUpperCase() + user.tier.slice(1)} Plan`
                        : "Free Plan"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {subscription
                      ? subscription.billingCycle === "yearly"
                        ? "$290/year"
                        : "$29/month"
                      : user.tier === "premium"
                        ? "$100/month"
                        : user.tier === "pro"
                          ? "$50/month"
                          : user.tier === "starter"
                            ? "$20/month"
                            : "No charge"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {isPro && subscription ? (
                  <>
                    <Badge
                      data-studio-billing-plan-status={studioShell ? subscription.status : undefined}
                      variant="outline"
                      className={
                        subscription.status === "active"
                          ? "text-green-700"
                          : "text-orange-700"
                      }
                    >
                      {subscription.status === "active" ? "Active" : subscription.status}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {subscription.cancelAtPeriodEnd
                        ? `Cancels ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                        : `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                    </p>
                  </>
                ) : user.tier === "free" ? (
                  <UpgradeButton
                    priceId={process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID!}
                    billingCycle="monthly"
                    label="Upgrade Now"
                  />
                ) : null}
              </div>
            </div>

            {/* Plan Features */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Included in your plan:</h4>
              <div className="grid gap-2" data-studio-billing-features={studioShell ? "true" : undefined}>
                {user.tier === "premium" ? (
                  <>
                    <Feature included text="Unlimited presentations" />
                    <Feature included text="All 4 AI agents" />
                    <Feature included text="Custom branding" />
                    <Feature included text="Knowledge Graph" />
                    <Feature included text="Priority generation queue" />
                    <Feature included text="Advanced analytics" />
                  </>
                ) : user.tier === "pro" ? (
                  <>
                    <Feature included text="Unlimited presentations" />
                    <Feature included text="All 4 AI agents" />
                    <Feature included text="Custom branding" />
                    <Feature included text="Advanced analytics" />
                    <Feature text="Knowledge Graph (upgrade to Max)" />
                  </>
                ) : (
                  <>
                    <Feature included text="3 presentations" />
                    <Feature included text="2 AI agents" />
                    <Feature text="Custom branding (upgrade to Pro)" />
                    <Feature text="Advanced features (upgrade to Pro)" />
                  </>
                )}
              </div>
            </div>

            {isPro && subscription && (
              <div className="flex gap-2 pt-2" data-studio-billing-plan-actions={studioShell ? "true" : undefined}>
                <ManageSubscriptionButton />
                {user.tier === "pro" && (
                  <Button variant="outline" onClick={handleUpgrade}>
                    Upgrade to Enterprise
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credit Balance Card */}
        {features.couponAuthEnabled && (
          <Card data-studio-billing-card={studioShell ? "wallet" : undefined}>
            <CardHeader data-studio-billing-header={studioShell ? "true" : undefined}>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Credit Balance
              </CardTitle>
              <CardDescription>Your available credits for AI generation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4" data-studio-billing-body={studioShell ? "true" : undefined}>
              {searchParams?.get("topup") === "success" && (
                <Alert role="status">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Returned from credit checkout. This return does not confirm that credits were applied. Refresh your balance to check the latest account balance.</AlertDescription>
                </Alert>
              )}
              {searchParams?.get("topup") === "canceled" && <p role="status" className="text-sm text-muted-foreground">Returned from checkout cancellation. No credit update is confirmed here.</p>}

              <div className="flex items-center justify-between rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 p-4" data-studio-billing-balance={studioShell ? "true" : undefined}>
                <div>
                  <p className="text-sm text-muted-foreground">Available Balance</p>
                  <p className="text-3xl font-bold">
                    {walletData ? `$${(walletData.balanceCents / 100).toFixed(2)}` : wallet.isLoading ? "Loading…" : "Unavailable"}
                  </p>
                </div>
              </div>

              {walletRefreshing && <p role="status" className="text-sm text-muted-foreground">Refreshing balance{walletData ? "; showing the last confirmed balance for this account" : ""}…</p>}
              {walletError && <p role="alert" className="text-sm text-destructive dark:text-red-300">{walletError}{walletData ? " Showing the last confirmed balance and transactions for this account; they may be outdated." : " No balance or transactions have been confirmed for this account."}</p>}
              <Button variant="outline" onClick={handleWalletRefresh} disabled={wallet.isLoading || walletRefreshing}>{walletRefreshing ? "Refreshing…" : "Refresh balance"}</Button>
              {topUpError && <p role="alert" className="text-sm text-destructive dark:text-red-300">{topUpError}</p>}
              <div>
                <h4 className="text-sm font-medium mb-2">Add Credits</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-studio-billing-packs={studioShell ? "true" : undefined}>
                  {[
                    { id: "pack_10", label: "$10" },
                    { id: "pack_25", label: "$25" },
                    { id: "pack_50", label: "$50" },
                    { id: "pack_100", label: "$100" },
                  ].map((pack) => (
                    <Button
                      key={pack.id}
                      variant="outline"
                      className="h-auto py-3 flex flex-col gap-1"
                      onClick={() => handleTopUp(pack.id)}
                      disabled={topUpLoading !== null}
                    >
                      {topUpLoading === pack.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          <span className="font-semibold">{pack.label}</span>
                        </>
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {walletData && walletData.transactions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Recent Transactions</h4>
                  <div className="space-y-2" data-studio-billing-transactions={studioShell ? "true" : undefined}>
                    {walletData.transactions.slice(0, 5).map((txn) => (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
                      >
                        <div>
                          <span className="capitalize">
                            {txn.reason.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {new Date(txn.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <span
                          className={
                            txn.type === "credit"
                              ? "text-green-600 font-medium"
                              : "text-red-600 font-medium"
                          }
                        >
                          {txn.type === "credit" ? "+" : "-"}${(txn.amountCents / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment Method Card */}
        {user.tier !== "free" && (
          <Card data-studio-billing-card={studioShell ? "payment" : undefined}>
            <CardHeader data-studio-billing-header={studioShell ? "true" : undefined}>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>Manage your payment information</CardDescription>
            </CardHeader>
            <CardContent data-studio-billing-body={studioShell ? "true" : undefined}>
              <div className="flex items-center justify-between rounded-lg border p-4" data-studio-billing-payment-row={studioShell ? "true" : undefined}>
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Managed via Stripe</p>
                    <p className="text-sm text-muted-foreground">
                      View and update your payment method in the customer portal
                    </p>
                  </div>
                </div>
                <ManageSubscriptionButton />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice History */}
        {user.tier !== "free" && (
          <Card data-studio-billing-card={studioShell ? "invoices" : undefined}>
            <CardHeader data-studio-billing-header={studioShell ? "true" : undefined}>
              <CardTitle id={studioShell ? "billing-invoice-heading" : undefined}>Invoice History</CardTitle>
              <CardDescription>Download your past invoices</CardDescription>
            </CardHeader>
            <CardContent data-studio-billing-body={studioShell ? "true" : undefined}>
              {(!invoiceState || invoiceState.status === "loading") && <p role="status" className="text-sm text-muted-foreground">{invoices ? "Refreshing invoices; showing the last confirmed history for this account…" : "Loading invoices…"}</p>}
              {invoiceState?.status === "error" && <p role="alert" className="text-sm text-destructive dark:text-red-300">{invoices ? "Invoice refresh failed. Showing the last confirmed history for this account; it may be outdated." : "Invoice history is unavailable. No invoice history has been confirmed for this account."}</p>}
              <Button variant="outline" size="sm" onClick={() => { if (capture()) setInvoiceAttempt(value => value + 1) }} disabled={!invoiceState || invoiceState.status === "loading"}>Retry invoices</Button>
              {invoices && (invoices.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center" data-studio-billing-invoice-empty={studioShell ? "true" : undefined}>
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No invoices yet. Your invoices will appear here after your first
                    billing cycle.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You can also view invoices in the Stripe customer portal.
                  </p>
                </div>
              ) : (
                <div className="space-y-2" data-studio-billing-invoices={studioShell ? "true" : undefined} role={studioShell ? "list" : undefined} aria-labelledby={studioShell ? "billing-invoice-heading" : undefined}>
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-900"
                      data-studio-billing-invoice={studioShell ? "true" : undefined}
                      role={studioShell ? "listitem" : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(invoice.date).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ${invoice.amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs text-green-700" data-studio-billing-invoice-status={studioShell ? "true" : undefined}>
                          {invoice.status}
                        </Badge>
                        {invoice.downloadUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={invoice.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Download invoice"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Usage Statistics */}
        <Card data-studio-billing-card={studioShell ? "usage" : undefined}>
          <CardHeader data-studio-billing-header={studioShell ? "true" : undefined}>
            <CardTitle>Usage</CardTitle>
            <CardDescription>All-time presentation sessions and uploaded-file storage</CardDescription>
          </CardHeader>
          <CardContent data-studio-billing-body={studioShell ? "true" : undefined}>
            {(!usageState || usageState.status === "loading") && <p role="status" className="text-sm text-muted-foreground">{usage ? "Refreshing usage; showing the last confirmed values for this account…" : "Loading usage…"}</p>}
            {usageState?.status === "error" && <p role="alert" className="text-sm text-destructive dark:text-red-300">{usage ? "Usage refresh failed. Showing the last confirmed values for this account; they may be outdated." : "Usage is unavailable. No usage values have been confirmed for this account."}</p>}
            <Button variant="outline" size="sm" onClick={() => { if (capture()) setUsageAttempt(value => value + 1) }} disabled={!usageState || usageState.status === "loading"}>Retry usage</Button>
            <div className="space-y-4" data-studio-billing-usage={studioShell ? "true" : undefined}>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>Presentation sessions</span>
                  <span className="font-medium">
                    {usage
                      ? user.tier === "free"
                        ? `${usage.presentationCount} / 3`
                        : `${usage.presentationCount} / Unlimited`
                      : usageState?.status === "error" ? "Unavailable" : "Loading…"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  View your presentations on the{" "}
                  <a href="/dashboard" className="underline underline-offset-2">
                    Dashboard
                  </a>
                </p>
              </div>

              <div className="flex justify-between text-sm">
                <span>AI Agent Interactions</span>
                <Badge variant="outline" className="text-muted-foreground text-xs">
                  Planned
                </Badge>
              </div>

              <div className="flex justify-between text-sm">
                <span>Storage Used</span>
                <span className="font-medium">
                  {usage ? formatBytes(usage.storageBytes) : usageState?.status === "error" ? "Unavailable" : "Loading…"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upgrade CTA for Free Users */}
        {user.tier === "free" && (
          <Alert className="border-purple-200 bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/30" data-studio-billing-upgrade={studioShell ? "true" : undefined}>
            <AlertCircle className="h-4 w-4 text-purple-600" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <p className="font-medium text-purple-900 dark:text-purple-300">
                  Unlock all features
                </p>
                <p className="mt-1 text-sm text-purple-700 dark:text-purple-400">
                  Upgrade to Pro for unlimited presentations and advanced features
                </p>
              </div>
              <Button className="ml-4" onClick={handleUpgrade}>
                View Plans
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </main>
  )
}

function Feature({ included, text }: { included?: boolean; text: string }) {
  return (
    <div
      className={`flex items-center gap-2 text-sm ${!included ? "text-muted-foreground" : ""}`}
    >
      {included ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <X className="h-4 w-4" />
      )}
      <span>{text}</span>
    </div>
  )
}
