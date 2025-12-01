"use client"

import { useState, useEffect, Fragment } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Header, Footer } from "@/components/layout"
import { PageHeader } from "@/components/marketing/PageHeader"
import { Section } from "@/components/marketing/Section"
import { Separator } from "@/components/ui/separator"
import {
  Check,
  X,
  Sparkles,
  Crown,
  Shield,
  Users,
  BarChart3,
  Palette,
  MessageSquare,
  HelpCircle,
  ArrowRight,
  CreditCard,
  Lock,
  FileCheck,
  Building2,
  GraduationCap,
  Briefcase,
  Zap
} from "lucide-react"
import Link from "next/link"
import { UpgradeButton } from "@/components/billing/UpgradeButton"

export default function PricingPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly")
  const [teamSize, setTeamSize] = useState([10])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const plans = [
    {
      id: "free",
      name: "Free",
      description: "Perfect for trying out Deckster",
      price: { monthly: 0, yearly: 0 },
      icon: Shield,
      color: "gray",
      bestFor: [
        "Students and educators",
        "Personal projects",
        "Trying out Deckster",
        "Occasional presentations"
      ],
      features: [
        { text: "3 presentations", included: true },
        { text: "2 AI agents (Director & Scripter)", included: true },
        { text: "Basic templates", included: true },
        { text: "Export to PDF", included: true },
        { text: "Community support", included: true },
        { text: "Custom branding", included: false },
        { text: "Advanced analytics", included: false },
        { text: "Team collaboration", included: false },
        { text: "Priority support", included: false },
        { text: "API access", included: false }
      ]
    },
    {
      id: "pro",
      name: "Pro",
      description: "For professionals and small teams",
      price: { monthly: 29, yearly: 290 },
      icon: Crown,
      color: "blue",
      popular: true,
      bestFor: [
        "Professionals and consultants",
        "Small businesses",
        "Freelancers and agencies",
        "Regular presentation creators"
      ],
      features: [
        { text: "Unlimited presentations", included: true },
        { text: "All 4 AI agents", included: true },
        { text: "Premium templates", included: true },
        { text: "Export to multiple formats", included: true },
        { text: "Custom branding", included: true },
        { text: "Advanced analytics", included: true },
        { text: "Version history", included: true },
        { text: "Email support", included: true },
        { text: "Team collaboration", included: false },
        { text: "API access", included: false }
      ]
    },
    {
      id: "enterprise",
      name: "Enterprise",
      description: "For large teams and organizations",
      price: { monthly: 99, yearly: 990 },
      icon: Sparkles,
      color: "purple",
      bestFor: [
        "Large teams and organizations",
        "Agencies with multiple clients",
        "Companies needing advanced security",
        "Teams requiring custom solutions"
      ],
      features: [
        { text: "Everything in Pro", included: true },
        { text: "Unlimited team members", included: true },
        { text: "Team collaboration", included: true },
        { text: "Advanced permissions", included: true },
        { text: "SSO authentication", included: true },
        { text: "API access", included: true },
        { text: "Custom AI training", included: true },
        { text: "Dedicated account manager", included: true },
        { text: "Priority support", included: true },
        { text: "SLA guarantee", included: true }
      ]
    }
  ]

  const detailedFeatures = [
    {
      category: "Core Features",
      features: [
        { name: "Presentations per month", free: "3", pro: "Unlimited", enterprise: "Unlimited" },
        { name: "AI Agents", free: "2 (Director, Scripter)", pro: "All 4 agents", enterprise: "All 4 agents + Custom" },
        { name: "Templates", free: "Basic (15)", pro: "Premium (50+)", enterprise: "All + Custom" },
        { name: "Slides per presentation", free: "Up to 20", pro: "Unlimited", enterprise: "Unlimited" },
        { name: "Storage", free: "100 MB", pro: "10 GB", enterprise: "Unlimited" },
      ]
    },
    {
      category: "AI Capabilities",
      features: [
        { name: "Director Agent", free: true, pro: true, enterprise: true },
        { name: "Scripter Agent", free: true, pro: true, enterprise: true },
        { name: "Graphic Artist Agent", free: false, pro: true, enterprise: true },
        { name: "Data Visualizer Agent", free: false, pro: true, enterprise: true },
        { name: "Chain-of-Thought transparency", free: true, pro: true, enterprise: true },
        { name: "Custom AI training", free: false, pro: false, enterprise: true },
        { name: "Advanced prompting", free: false, pro: true, enterprise: true },
      ]
    },
    {
      category: "Export & Sharing",
      features: [
        { name: "PDF export", free: true, pro: true, enterprise: true },
        { name: "PowerPoint (.pptx)", free: false, pro: true, enterprise: true },
        { name: "Google Slides", free: false, pro: true, enterprise: true },
        { name: "PNG/JPEG export", free: false, pro: true, enterprise: true },
        { name: "Web hosting", free: false, pro: true, enterprise: true },
        { name: "Custom domain", free: false, pro: false, enterprise: true },
        { name: "Embed code", free: false, pro: true, enterprise: true },
      ]
    },
    {
      category: "Collaboration",
      features: [
        { name: "Team members", free: "1", pro: "1", enterprise: "Unlimited" },
        { name: "Real-time collaboration", free: false, pro: false, enterprise: true },
        { name: "Comments & feedback", free: false, pro: false, enterprise: true },
        { name: "Role-based permissions", free: false, pro: false, enterprise: true },
        { name: "Shared workspaces", free: false, pro: false, enterprise: true },
      ]
    },
    {
      category: "Customization",
      features: [
        { name: "Custom branding", free: false, pro: true, enterprise: true },
        { name: "Brand colors & fonts", free: false, pro: true, enterprise: true },
        { name: "Logo placement", free: false, pro: true, enterprise: true },
        { name: "Custom templates", free: false, pro: "Limited", enterprise: "Unlimited" },
        { name: "Watermark removal", free: false, pro: true, enterprise: true },
      ]
    },
    {
      category: "Analytics & Insights",
      features: [
        { name: "Basic analytics", free: true, pro: true, enterprise: true },
        { name: "Advanced analytics", free: false, pro: true, enterprise: true },
        { name: "Usage tracking", free: false, pro: true, enterprise: true },
        { name: "Team performance metrics", free: false, pro: false, enterprise: true },
        { name: "Custom reports", free: false, pro: false, enterprise: true },
      ]
    },
    {
      category: "Support",
      features: [
        { name: "Community support", free: true, pro: true, enterprise: true },
        { name: "Email support", free: false, pro: "Business hours", enterprise: "24/7" },
        { name: "Priority support", free: false, pro: false, enterprise: true },
        { name: "Dedicated account manager", free: false, pro: false, enterprise: true },
        { name: "Onboarding & training", free: false, pro: false, enterprise: true },
        { name: "SLA guarantee", free: false, pro: false, enterprise: "99.9%" },
      ]
    },
    {
      category: "Security & Compliance",
      features: [
        { name: "SSL encryption", free: true, pro: true, enterprise: true },
        { name: "2FA authentication", free: true, pro: true, enterprise: true },
        { name: "SSO (SAML, OAuth)", free: false, pro: false, enterprise: true },
        { name: "SOC 2 compliance", free: false, pro: false, enterprise: true },
        { name: "GDPR compliant", free: true, pro: true, enterprise: true },
        { name: "Data residency options", free: false, pro: false, enterprise: true },
      ]
    },
    {
      category: "Developer & Integration",
      features: [
        { name: "API access", free: false, pro: false, enterprise: true },
        { name: "Webhooks", free: false, pro: false, enterprise: true },
        { name: "Custom integrations", free: false, pro: false, enterprise: true },
        { name: "Zapier integration", free: false, pro: true, enterprise: true },
      ]
    }
  ]

  const faqs = [
    {
      question: "How does the free trial work?",
      answer: "While we don't offer a traditional free trial, our Free plan lets you create up to 3 presentations with 2 AI agents (Director and Scripter). This gives you a real feel for the platform without any credit card required. You can upgrade anytime to unlock all features."
    },
    {
      question: "Can I cancel anytime?",
      answer: "Absolutely! There are no long-term contracts or cancellation fees. You can upgrade, downgrade, or cancel your subscription at any time from your account settings. If you cancel, you'll have access to your plan features until the end of your billing period."
    },
    {
      question: "What happens to my presentations if I downgrade?",
      answer: "Your presentations are always safe! If you downgrade from Pro to Free, you'll keep all your existing presentations but won't be able to create more than 3 total. You can export your presentations before downgrading or upgrade again anytime to regain full access."
    },
    {
      question: "Do you offer team/volume discounts?",
      answer: "Yes! For teams of 10+ users, we offer custom Enterprise pricing with volume discounts. Contact our sales team for a personalized quote. We also offer special pricing for educational institutions and non-profit organizations."
    },
    {
      question: "What's your refund policy?",
      answer: "We offer a 14-day money-back guarantee on all paid plans. If you're not satisfied for any reason within the first 14 days, contact our support team for a full refund. No questions asked."
    },
    {
      question: "How do AI credits work?",
      answer: "Unlike other AI tools, Deckster doesn't use a credit system! Your plan includes unlimited AI generations. Free users get 3 presentations with unlimited regeneration. Pro and Enterprise users get unlimited presentations with unlimited AI usage."
    },
    {
      question: "Can I upgrade or downgrade mid-cycle?",
      answer: "Yes! Changes take effect immediately. When upgrading, you'll be charged a prorated amount for the remainder of your billing period. When downgrading, we'll credit your account for the prorated difference, which will be applied to your next bill."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards (Visa, Mastercard, American Express, Discover), debit cards, and corporate purchasing cards. All payments are processed securely through Stripe. Enterprise customers can also pay via wire transfer or invoice."
    },
    {
      question: "Is there an education discount?",
      answer: "Yes! We offer 40% off Pro plans for students, teachers, and educational institutions. Non-profit organizations also qualify for special pricing. Contact our support team with proof of eligibility to claim your discount."
    },
    {
      question: "Do you offer annual billing?",
      answer: "Yes! Annual billing saves you 20% compared to monthly billing. You can switch to annual billing at any time from your account settings. Annual plans are billed once per year and renew automatically unless cancelled."
    }
  ]

  const handleSelectPlan = (planId: string) => {
    if (!user) {
      router.push("/auth/signin")
      return
    }

    if (planId === "free") {
      router.push("/dashboard")
      return
    }

    // TODO: Implement Stripe checkout
    console.log(`Selecting plan: ${planId}`)
    router.push("/dashboard")
  }

  const currentPlanId = user?.tier || "free"

  const calculateEnterprisePrice = () => {
    const basePrice = 99
    const size = teamSize[0]
    if (size <= 5) return basePrice
    return Math.floor(basePrice + (size - 5) * 15)
  }

  const getCtaText = (planId: string) => {
    // During SSR and initial render, always show "Get Started"
    if (!mounted) return "Get Started"
    if (!user) return "Get Started"
    if (currentPlanId === planId) return "Current Plan"
    if (planId === "free") return "Downgrade to Free"
    if (planId === "enterprise") return "Contact Sales"
    return `Upgrade to ${planId === "pro" ? "Pro" : "Enterprise"}`
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Main Content */}
      <PageHeader
        title="Choose Your Plan"
        subtitle="Unlock the full power of multi-agent AI for stunning presentations"
        badge={{
          text: "14-Day Money-Back Guarantee",
          icon: <Sparkles className="h-3 w-3" />
        }}
      />

      {/* Main Content */}
      <main>
        <Section>
          {/* Billing Toggle */}
          <div className="flex justify-center mb-12 relative z-20">
            <Tabs value={billingPeriod} onValueChange={(v) => setBillingPeriod(v as "monthly" | "yearly")}>
              <TabsList className="bg-muted h-12 p-1">
                <TabsTrigger value="monthly" className="h-10 px-6 rounded-md">Monthly</TabsTrigger>
                <TabsTrigger value="yearly" className="h-10 px-6 rounded-md">
                  Yearly
                  <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Save 20%</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {plans.map((plan) => {
              const Icon = plan.icon
              const isCurrentPlan = currentPlanId === plan.id
              const price = billingPeriod === "yearly" ? plan.price.yearly : plan.price.monthly
              const monthlyEquivalent = billingPeriod === "yearly" ? plan.price.yearly / 12 : price
              const isYearlyDiscount = billingPeriod === "yearly" && plan.id !== "free"

              return (
                <Card
                  key={plan.id}
                  className={`relative ${plan.popular ? "border-2 border-blue-500 shadow-xl scale-105" : "border-2"}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-1">
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-6">
                    <div className={`mx-auto p-4 rounded-xl mb-4 bg-gradient-to-br ${plan.color === "purple" ? "from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800" :
                      plan.color === "blue" ? "from-blue-100 to-cyan-200 dark:from-blue-900 dark:to-cyan-800" :
                        "from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700"
                      }`}>
                      <Icon className={`h-10 w-10 ${plan.color === "purple" ? "text-purple-700 dark:text-purple-300" :
                        plan.color === "blue" ? "text-blue-700 dark:text-blue-300" :
                          "text-gray-700 dark:text-gray-300"
                        }`} />
                    </div>
                    <CardTitle className="text-3xl font-bold">{plan.name}</CardTitle>
                    <CardDescription className="text-base mt-2">{plan.description}</CardDescription>
                    <div className="mt-6">
                      <div className="flex items-baseline justify-center">
                        <span className="text-5xl font-bold">${price}</span>
                        <span className="text-muted-foreground ml-2">
                          /{billingPeriod === "yearly" ? "year" : "month"}
                        </span>
                      </div>
                      {isYearlyDiscount && (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-muted-foreground">
                            ${monthlyEquivalent.toFixed(2)}/month when billed yearly
                          </p>
                          <p className="text-sm font-semibold text-green-600">
                            Save ${plan.price.monthly * 12 - plan.price.yearly}/year
                          </p>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {plan.id === 'pro' && user && currentPlanId !== 'pro' ? (
                      <UpgradeButton
                        priceId={billingPeriod === 'yearly'
                          ? process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID!
                          : process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID!}
                        billingCycle={billingPeriod}
                        label={getCtaText(plan.id)}
                        className={`w-full ${plan.popular ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700" : ""}`}
                      />
                    ) : (
                      <Button
                        className={`w-full ${plan.popular ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700" : ""}`}
                        variant={isCurrentPlan ? "outline" : plan.popular ? "default" : "outline"}
                        disabled={isCurrentPlan}
                        onClick={() => handleSelectPlan(plan.id)}
                        size="lg"
                      >
                        {getCtaText(plan.id)}
                        {!isCurrentPlan && <ArrowRight className="ml-2 h-4 w-4" />}
                      </Button>
                    )}

                    {/* Perfect For Section */}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm font-semibold mb-3">Perfect for:</p>
                      <ul className="space-y-2">
                        {plan.bestFor.map((use, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <span>{use}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Key features:</p>
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          {feature.included ? (
                            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <X className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          )}
                          <span className={`text-sm ${feature.included ? "" : "text-muted-foreground line-through"}`}>
                            {feature.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </Section>

        <Separator className="mb-16" />

        {/* Enterprise Pricing Calculator */}
        <Section background="muted">
          <Card className="border-2 border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-6 w-6 text-purple-600" />
                Enterprise Team Pricing Calculator
              </CardTitle>
              <CardDescription>
                Calculate pricing for your team size (starting at $99/mo for up to 5 users)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between mb-4">
                  <span className="text-sm font-medium">Team Size: {teamSize[0]} users</span>
                  <span className="text-sm text-muted-foreground">Adjust slider</span>
                </div>
                <Slider
                  value={teamSize}
                  onValueChange={setTeamSize}
                  min={5}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>5 users</span>
                  <span>100+ users</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Estimated monthly cost</p>
                <p className="text-4xl font-bold text-purple-600">${calculateEnterprisePrice()}</p>
                <p className="text-sm text-muted-foreground mt-2">${(calculateEnterprisePrice() / teamSize[0]).toFixed(2)} per user/month</p>
              </div>

              <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" size="lg">
                Contact Sales for Custom Quote
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Section>

        <Separator className="mb-16" />

        {/* Detailed Feature Comparison */}
        <Section>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Complete Feature Comparison</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See exactly what's included in each plan with our comprehensive feature breakdown
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg border-2 overflow-hidden max-w-6xl mx-auto">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[300px] font-bold">Feature</TableHead>
                    <TableHead className="text-center font-bold">Free</TableHead>
                    <TableHead className="text-center font-bold bg-blue-50 dark:bg-blue-900/20">Pro</TableHead>
                    <TableHead className="text-center font-bold">Enterprise</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailedFeatures.map((category, categoryIndex) => (
                    <Fragment key={`category-${categoryIndex}`}>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={4} className="font-bold text-base py-3">
                          {category.category}
                        </TableCell>
                      </TableRow>
                      {category.features.map((feature, featureIndex) => (
                        <TableRow key={`${categoryIndex}-${featureIndex}`}>
                          <TableCell className="font-medium">{feature.name}</TableCell>
                          <TableCell className="text-center">
                            {typeof feature.free === 'boolean' ? (
                              feature.free ? (
                                <Check className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-gray-400 mx-auto" />
                              )
                            ) : (
                              <span className="text-sm">{feature.free}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center bg-blue-50/50 dark:bg-blue-900/10">
                            {typeof feature.pro === 'boolean' ? (
                              feature.pro ? (
                                <Check className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-gray-400 mx-auto" />
                              )
                            ) : (
                              <span className="text-sm font-medium">{feature.pro}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {typeof feature.enterprise === 'boolean' ? (
                              feature.enterprise ? (
                                <Check className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-gray-400 mx-auto" />
                              )
                            ) : (
                              <span className="text-sm font-medium">{feature.enterprise}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </Section>

        <Separator className="mb-16" />

        {/* Trust Signals */}
        <Section background="muted">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold mb-4">Secure & Trusted</h3>
            <p className="text-muted-foreground">Your data and payments are safe with us</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="text-center p-6">
              <Lock className="h-10 w-10 text-green-600 mx-auto mb-3" />
              <p className="font-semibold text-sm">SSL Encrypted</p>
              <p className="text-xs text-muted-foreground mt-1">Bank-level security</p>
            </Card>

            <Card className="text-center p-6">
              <CreditCard className="h-10 w-10 text-blue-600 mx-auto mb-3" />
              <p className="font-semibold text-sm">Stripe Payments</p>
              <p className="text-xs text-muted-foreground mt-1">Secure processing</p>
            </Card>

            <Card className="text-center p-6">
              <FileCheck className="h-10 w-10 text-purple-600 mx-auto mb-3" />
              <p className="font-semibold text-sm">GDPR Compliant</p>
              <p className="text-xs text-muted-foreground mt-1">Privacy protected</p>
            </Card>

            <Card className="text-center p-6">
              <Shield className="h-10 w-10 text-orange-600 mx-auto mb-3" />
              <p className="font-semibold text-sm">99.9% Uptime</p>
              <p className="text-xs text-muted-foreground mt-1">Always available</p>
            </Card>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">We accept</p>
            <div className="flex justify-center items-center gap-6 flex-wrap">
              <Badge variant="outline" className="text-sm px-4 py-2">Visa</Badge>
              <Badge variant="outline" className="text-sm px-4 py-2">Mastercard</Badge>
              <Badge variant="outline" className="text-sm px-4 py-2">American Express</Badge>
              <Badge variant="outline" className="text-sm px-4 py-2">Discover</Badge>
              <Badge variant="outline" className="text-sm px-4 py-2">Corporate Cards</Badge>
            </div>
          </div>
        </Section>

        <Separator className="mb-16" />

        {/* FAQ Section */}
        <Section>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
              <p className="text-lg text-muted-foreground">
                Everything you need to know about pricing and plans
              </p>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    <span className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
                      {faq.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground mb-4">Still have questions?</p>
              <div className="flex gap-4 justify-center">
                <Button variant="outline" asChild>
                  <Link href="/help">Visit Help Center</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/help">Contact Support</Link>
                </Button>
              </div>
            </div>
          </div>
        </Section>

        <Separator className="mb-16" />

        {/* Comparison CTA */}
        <Section background="muted">
          <div className="mb-16">
            <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-2">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">How does Deckster compare?</CardTitle>
                <CardDescription className="text-base">
                  See how we stack up against other presentation tools
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="flex flex-wrap gap-4 justify-center">
                  <Button variant="outline" asChild>
                    <Link href="/compare/beautiful-ai">vs Beautiful.ai</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/compare/gamma">vs Gamma</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/compare/pitch">vs Pitch</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/compare/powerpoint">vs PowerPoint</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Final CTA */}
          <div className="text-center py-16 px-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl text-white">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to create amazing presentations?
            </h3>
            <p className="text-lg mb-8 max-w-2xl mx-auto opacity-90">
              Join thousands of professionals using Deckster's multi-agent AI to build better presentations faster
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="secondary"
                onClick={() => handleSelectPlan("free")}
                className="bg-white text-purple-600 hover:bg-gray-100"
              >
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                onClick={() => handleSelectPlan("pro")}
                className="bg-white/10 border-2 border-white/20 text-white hover:bg-white/20"
              >
                Go Pro
                <Zap className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm mt-6 opacity-75">No credit card required • 14-day money-back guarantee</p>
          </div>
        </Section>
      </main>

      <Footer />
    </div >
  )
}
