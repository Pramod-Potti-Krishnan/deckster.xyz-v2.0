"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowRight, Sparkles, Users, Zap, Check } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Header, Footer } from "@/components/layout"
import { HowItWorks, AgentShowcase, FeatureComparison, StatsSection, ProductDemo } from "@/components/marketing/Homepage"

export default function LandingPage() {
  const router = useRouter()
  const [staySignedIn, setStaySignedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = () => {
    // Store the stay signed in preference
    if (typeof window !== 'undefined') {
      localStorage.setItem('staySignedIn', staySignedIn.toString())
      // Store mock user for development
      localStorage.setItem('mockUser', JSON.stringify({
        id: 'dev-user-' + Date.now(),
        email: 'dev@deckster.xyz',
        name: 'Dev User',
        tier: 'free'
      }))
    }
    // Navigate directly to builder
    router.push('/builder')
  }

  const features = [
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: "AI Agent Collaboration",
      description:
        "Watch specialized AI agents work together - The Director, Scripter, and Graphic Artist collaborate to create your perfect presentation.",
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Transparent Workflow",
      description:
        "See exactly what each agent is doing with our Chain of Thought visualizer. No black boxes, just clear collaboration.",
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Interactive Canvas",
      description:
        "Edit slides in real-time with our Living Canvas. Click, drag, and modify elements directly while chatting with AI.",
    },
  ]

  const tiers = [
    {
      name: "Free",
      price: "$0",
      description: "Perfect for trying out the platform",
      features: [
        "Basic AI agents (Director, Scripter, Layout Architect)",
        "Up to 3 presentations",
        "Descriptive placeholders for visuals",
        "Community support",
      ],
      cta: "Start Free",
      popular: false,
    },
    {
      name: "Pro",
      price: "$29",
      description: "For professionals and small teams",
      features: [
        "Advanced AI agents with full capabilities",
        "Unlimited presentations",
        "DALL-E 3 image generation",
        "Brand Kit customization",
        "Real-time web research",
        "Priority support",
      ],
      cta: "Start Pro Trial",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For large organizations",
      features: [
        "All Pro features",
        "Quality Analyst with iterative refinement",
        "Custom narrative frameworks",
        "Role-based access control",
        "Enhanced security protocols",
        "Dedicated support",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <Header />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="opacity-100 translate-y-0">
          <Badge className="mb-4 bg-purple-100 text-purple-700 hover:bg-purple-200">Powered by Multi-Agent AI</Badge>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Build Presentations with
            <br />
            AI Agent Collaboration
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            Watch specialized AI agents work together to create stunning presentations. The Director orchestrates, the
            Scripter writes, and the Graphic Artist designs - all while you guide the process through natural
            conversation.
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={handleSignIn}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Start Building"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Link href="/demo">
                <Button size="lg" variant="outline">
                  Watch Demo
                </Button>
              </Link>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <Checkbox 
                id="stay-signed-in" 
                checked={staySignedIn}
                onCheckedChange={(checked) => setStaySignedIn(checked as boolean)}
              />
              <label 
                htmlFor="stay-signed-in" 
                className="text-sm text-slate-600 cursor-pointer"
              >
                Stay signed in for 30 days
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">The Future of Presentation Creation</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Experience transparent AI collaboration with our innovative dual-pane interface
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <HowItWorks />

      {/* Agent Showcase Section */}
      <AgentShowcase />

      {/* Product Demo Section */}
      <ProductDemo />

      {/* Feature Comparison Section */}
      <FeatureComparison />

      {/* Stats Section */}
      <StatsSection />

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Start free and upgrade as your needs grow. Each tier unlocks more powerful AI capabilities.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tiers.map((tier, index) => (
            <Card
              key={index}
              className={`relative ${tier.popular ? "border-purple-200 shadow-xl scale-105" : "border-slate-200"}`}
            >
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <div className="text-3xl font-bold">
                  {tier.price}
                  {tier.price !== "Custom" && <span className="text-sm font-normal text-slate-500">/month</span>}
                </div>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start space-x-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${tier.popular ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" : ""}`}
                  variant={tier.popular ? "default" : "outline"}
                >
                  {tier.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  )
}
