"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useSubscription } from "@/hooks/use-subscription"
import { ManageSubscriptionButton } from "@/components/billing/ManageSubscriptionButton"
import { UpgradeButton } from "@/components/billing/UpgradeButton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CreditCard, Calendar, Crown, Sparkles, Shield, Check, X, AlertCircle, Download } from "lucide-react"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

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
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { subscription, isLoading: isLoadingSubscription, isActive, isPro } = useSubscription()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)

  // Real usage (deck count + storage) for every signed-in user.
  useEffect(() => {
    let cancelled = false
    fetch("/api/account/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setUsage(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Real invoice history (from Payment rows) for paying users only.
  useEffect(() => {
    if (!user || user.tier === "free") return
    let cancelled = false
    fetch("/api/billing/invoices")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.invoices) setInvoices(d.invoices)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user])

  if (isLoading || isLoadingSubscription) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
    )
  }

  if (!user) {
    router.push("/auth/signin")
    return null
  }

  const handleUpgrade = () => {
    router.push("/pricing")
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and billing information</p>
      </div>

      <div className="grid gap-6">
        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>Your subscription details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
              <div className="flex items-center space-x-4">
                <div
                  className={`rounded-lg p-3 ${
                    user.tier === "enterprise"
                      ? "bg-purple-100 dark:bg-purple-900/30"
                      : user.tier === "pro"
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  {user.tier === "enterprise" ? (
                    <Sparkles className="h-6 w-6 text-purple-700 dark:text-purple-400" />
                  ) : user.tier === "pro" ? (
                    <Crown className="h-6 w-6 text-blue-700 dark:text-blue-400" />
                  ) : (
                    <Shield className="h-6 w-6 text-gray-700 dark:text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {user.tier === "enterprise"
                      ? "Enterprise Plan"
                      : user.tier === "pro"
                        ? "Pro Plan"
                        : "Free Plan"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {subscription
                      ? subscription.billingCycle === "yearly"
                        ? "$290/year"
                        : "$29/month"
                      : user.tier !== "free"
                        ? "$29/month"
                        : "No charge"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {isPro && subscription ? (
                  <>
                    <Badge
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
              <div className="grid gap-2">
                {user.tier === "enterprise" ? (
                  <>
                    <Feature included text="Unlimited presentations" />
                    <Feature included text="All 4 AI agents" />
                    <Feature included text="Custom branding" />
                    <Feature included text="Team collaboration" />
                    <Feature included text="Priority support" />
                    <Feature included text="Advanced analytics" />
                  </>
                ) : user.tier === "pro" ? (
                  <>
                    <Feature included text="Unlimited presentations" />
                    <Feature included text="All 4 AI agents" />
                    <Feature included text="Custom branding" />
                    <Feature included text="Advanced analytics" />
                    <Feature text="Team collaboration (upgrade to Enterprise)" />
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
              <div className="flex gap-2 pt-2">
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

        {/* Payment Method Card */}
        {user.tier !== "free" && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>Manage your payment information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border p-4">
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
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
              <CardDescription>Download your past invoices</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
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
                <div className="space-y-2">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-900"
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
                        <Badge variant="outline" className="text-xs text-green-700">
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
              )}
            </CardContent>
          </Card>
        )}

        {/* Usage Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>Your usage this billing period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>Presentations</span>
                  <span className="font-medium">
                    {usage
                      ? user.tier === "free"
                        ? `${usage.presentationCount} / 3`
                        : `${usage.presentationCount} / Unlimited`
                      : "…"}
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
                  {usage ? formatBytes(usage.storageBytes) : "…"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upgrade CTA for Free Users */}
        {user.tier === "free" && (
          <Alert className="border-purple-200 bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/30">
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
