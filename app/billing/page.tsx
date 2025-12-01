"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useSubscription } from "@/hooks/use-subscription"
import { ManageSubscriptionButton } from "@/components/billing/ManageSubscriptionButton"
import { UpgradeButton } from "@/components/billing/UpgradeButton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  ArrowLeft,
  CreditCard,
  Download,
  Calendar,
  Crown,
  Sparkles,
  Shield,
  Check,
  X,
  AlertCircle
} from "lucide-react"
import Link from "next/link"

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

interface Invoice {
  id: string
  date: string
  amount: number
  status: "paid" | "pending" | "failed"
  downloadUrl?: string
}

export default function BillingPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { subscription, isLoading: isLoadingSubscription, isActive, isPro } = useSubscription()

  if (isLoading || isLoadingSubscription) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
          <p className="text-slate-600">Manage your subscription and billing information</p>
        </div>

        <div className="grid gap-6">
          {/* Current Plan Card */}
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your subscription details and usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-lg ${
                    user.tier === "enterprise" ? "bg-purple-100" : 
                    user.tier === "pro" ? "bg-blue-100" : 
                    "bg-gray-100"
                  }`}>
                    {user.tier === "enterprise" ? (
                      <Sparkles className="h-6 w-6 text-purple-700" />
                    ) : user.tier === "pro" ? (
                      <Crown className="h-6 w-6 text-blue-700" />
                    ) : (
                      <Shield className="h-6 w-6 text-gray-700" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {user.tier === "enterprise" ? "Enterprise Plan" : 
                       user.tier === "pro" ? "Pro Plan" : 
                       "Free Plan"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {subscription ?
                        (subscription.billingCycle === 'yearly' ? '$290/year' : '$29/month') :
                        user.tier !== "free" ? "$29/month" : "No charge"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {isPro && subscription ? (
                    <>
                      <Badge variant="outline" className={subscription.status === 'active' ? "text-green-700" : "text-orange-700"}>
                        {subscription.status === 'active' ? 'Active' : subscription.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {subscription.cancelAtPeriodEnd ?
                          `Cancels ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}` :
                          `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
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
                <h4 className="font-medium text-sm">Included in your plan:</h4>
                <div className="grid gap-2">
                  {user.tier === "enterprise" ? (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Unlimited presentations</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>All 4 AI agents</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Custom branding</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Team collaboration</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Priority support</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Advanced analytics</span>
                      </div>
                    </>
                  ) : user.tier === "pro" ? (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Unlimited presentations</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>All 4 AI agents</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Custom branding</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Advanced analytics</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <X className="h-4 w-4" />
                        <span>Team collaboration (upgrade to Enterprise)</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>3 presentations</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>2 AI agents</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <X className="h-4 w-4" />
                        <span>Custom branding (upgrade to Pro)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <X className="h-4 w-4" />
                        <span>Advanced features (upgrade to Pro)</span>
                      </div>
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
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">•••• •••• •••• 4242</p>
                      <p className="text-sm text-muted-foreground">Expires 12/25</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Update
                  </Button>
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
                <div className="space-y-2">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(invoice.date).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ${invoice.amount}.00
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-green-700 text-xs">
                          {invoice.status}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Usage Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
              <CardDescription>Track your usage this billing period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Presentations</span>
                    <span className="font-medium">
                      {user.tier === "free" ? "2 / 3" : "12 / Unlimited"}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full" 
                      style={{ width: user.tier === "free" ? "66%" : "12%" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>AI Agent Interactions</span>
                    <span className="font-medium">47 this month</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Storage Used</span>
                    <span className="font-medium">1.2 GB</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upgrade CTA for Free Users */}
          {user.tier === "free" && (
            <Alert className="border-purple-200 bg-purple-50">
              <AlertCircle className="h-4 w-4 text-purple-600" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-purple-900">Unlock all features</p>
                  <p className="text-sm text-purple-700 mt-1">
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
    </div>
  )
}