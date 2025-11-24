"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Sparkles, Users, Zap, Check, PlayCircle, Layout, Wand2, BarChart, Star, Shield, Globe, Laptop, MessageSquare } from "lucide-react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn, useSession } from "next-auth/react"
import { Header, Footer } from "@/components/layout"
import { HowItWorks, AgentShowcase, FeatureComparison, StatsSection, ProductDemo } from "@/components/marketing/Homepage"

export default function LandingPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  // Debug: Log session changes
  useEffect(() => {
    console.log('Session status changed:', status)
    if (session?.user) {
      console.log('Logged in user:', session.user.email)
    }
  }, [status, session])

  const handleStartBuilding = () => {
    console.log('Start Building clicked. Session status:', status, 'User:', session?.user)

    // If user is already authenticated, navigate directly to builder
    if (status === 'authenticated' && session?.user) {
      console.log('User is authenticated, navigating to /builder')
      setIsLoading(true)
      router.push('/builder')
      return
    }

    // If not authenticated, start OAuth flow
    console.log('User not authenticated, initiating OAuth flow')
    setIsLoading(true)
    signIn('google', {
      callbackUrl: '/builder'
    }).catch((error) => {
      console.error('Sign-in error:', error)
      setIsLoading(false)
    })
  }

  const features = [
    {
      icon: <Sparkles className="h-8 w-8 text-purple-500" />,
      title: "AI Agent Collaboration",
      description:
        "Watch specialized AI agents work together - The Director, Scripter, and Graphic Artist collaborate to create your perfect presentation.",
      color: "bg-purple-500/10",
      lineColor: "bg-purple-500",
    },
    {
      icon: <Users className="h-8 w-8 text-blue-500" />,
      title: "Transparent Workflow",
      description:
        "See exactly what each agent is doing with our Chain of Thought visualizer. No black boxes, just clear collaboration.",
      color: "bg-blue-500/10",
      lineColor: "bg-blue-500",
    },
    {
      icon: <Zap className="h-8 w-8 text-cyan-500" />,
      title: "Interactive Canvas",
      description:
        "Edit slides in real-time with our Living Canvas. Click, drag, and modify elements directly while chatting with AI.",
      color: "bg-cyan-500/10",
      lineColor: "bg-cyan-500",
    },
    {
      icon: <Layout className="h-8 w-8 text-pink-500" />,
      title: "Smart Layouts",
      description:
        "Intelligent layout engine that automatically adjusts content to look professional and balanced on every slide.",
      color: "bg-pink-500/10",
      lineColor: "bg-pink-500",
    },
    {
      icon: <Wand2 className="h-8 w-8 text-indigo-500" />,
      title: "Brand Magic",
      description:
        "Instantly apply your brand guidelines, colors, and fonts across the entire presentation with a single click.",
      color: "bg-indigo-500/10",
      lineColor: "bg-indigo-500",
    },
    {
      icon: <PlayCircle className="h-8 w-8 text-green-500" />,
      title: "Live Preview",
      description:
        "Preview your presentation in real-time as it's being built. Make adjustments on the fly without breaking the flow.",
      color: "bg-green-500/10",
      lineColor: "bg-green-500",
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
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden min-h-[600px]">
        {/* Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          {/* Hero Background Image with enhanced overlay */}
          <div className="absolute inset-0">
            <img
              src="/hero-background.png"
              alt="Background"
              className="w-full h-full object-cover opacity-30 blur-[2px]"
            />
            {/* Multi-layer gradient for text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/85 to-white/90" />
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50/40 via-transparent to-blue-50/40" />
            {/* Center vignette for maximum text clarity */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-white/20 to-white/60" />
          </div>
          {/* Subtle accent gradients */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-purple-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-blue-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <Badge className="mb-6 bg-white/90 backdrop-blur-md text-primary border-primary/20 hover:bg-white px-4 py-1.5 text-sm shadow-lg">
              <Sparkles className="w-3 h-3 mr-2 inline-block" />
              Powered by Multi-Agent AI
            </Badge>
            <h1 className="text-6xl md:text-7xl font-bold mb-8 tracking-tight leading-tight drop-shadow-sm">
              Build Presentations with
              <br />
              <span className="text-gradient drop-shadow-md">AI Agent Collaboration</span>
            </h1>
            <p className="text-xl text-foreground/90 mb-10 max-w-3xl mx-auto leading-relaxed drop-shadow-sm font-medium">
              Watch specialized AI agents work together to create stunning presentations. The Director orchestrates, the
              Scripter writes, and the Graphic Artist designs - all while you guide the process.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="h-14 px-8 text-lg rounded-full bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/30 transition-all hover:scale-105 hover:shadow-primary/40"
                onClick={handleStartBuilding}
                disabled={isLoading || status === 'loading'}
              >
                {isLoading ? "Loading..." : status === 'loading' ? "Loading..." : "Start Building Free"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-2 bg-white/90 hover:bg-white backdrop-blur-md shadow-lg hover:shadow-xl transition-all">
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Watch Demo
                </Button>
              </Link>
            </div>
          </div>

          {/* Builder Interface Demo Preview */}
          <div className="mt-20 relative mx-auto max-w-5xl animate-in fade-in zoom-in duration-1000 delay-200">
            <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-purple-200/50 bg-gradient-to-br from-slate-50 to-slate-100 backdrop-blur-xl group">
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 to-blue-500/5 group-hover:opacity-75 transition-opacity z-10" />

              {/* Placeholder for Builder Interface Demo */}
              <div className="w-full h-full flex items-center justify-center relative">
                {/* Simulated Interface */}
                <div className="w-full h-full p-8 flex gap-4">
                  {/* Left Panel - Chat */}
                  <div className="w-1/3 bg-white rounded-xl shadow-lg border border-gray-200 p-4 flex flex-col gap-3">
                    <div className="h-8 bg-purple-100 rounded-lg animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-16 bg-gray-100 rounded-lg" />
                      <div className="h-12 bg-blue-100 rounded-lg ml-auto w-4/5" />
                      <div className="h-20 bg-gray-100 rounded-lg" />
                    </div>
                    <div className="h-12 bg-gray-200 rounded-lg" />
                  </div>

                  {/* Right Panel - Presentation */}
                  <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 p-6 flex items-center justify-center">
                    <div className="w-full aspect-video bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-dashed border-purple-200 flex items-center justify-center">
                      <div className="text-center space-y-4 px-8">
                        <div className="w-20 h-20 mx-auto bg-purple-100 rounded-full flex items-center justify-center">
                          <Sparkles className="w-10 h-10 text-purple-600" />
                        </div>
                        <p className="text-lg font-semibold text-gray-700">Interactive Builder Interface</p>
                        <p className="text-sm text-gray-500">Click "Start Building Free" to see the AI agents in action</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Decorative elements around demo */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-400/30 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/30 rounded-full blur-2xl" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-32 relative">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-6">The Future of Presentation Creation</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience transparent AI collaboration with our innovative dual-pane interface
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white/50 backdrop-blur-sm border-white/20 overflow-hidden group">
              <div className={`h-2 w-full ${feature.lineColor}`} />
              <CardHeader>
                <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
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
      <section className="container mx-auto px-4 py-32 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-slate-50/50 skew-y-3 transform origin-top-left" />

        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-6">Choose Your Plan</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade as your needs grow. Each tier unlocks more powerful AI capabilities.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">
          {tiers.map((tier, index) => (
            <Card
              key={index}
              className={`relative transition-all duration-300 ${tier.popular
                ? "border-primary/50 shadow-2xl scale-105 z-10 bg-white"
                : "border-border shadow-lg hover:shadow-xl bg-white/60 backdrop-blur-sm"
                }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-primary to-purple-600 text-white border-0 px-4 py-1 text-sm font-medium shadow-lg">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pt-10">
                <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
                <div className="text-4xl font-bold mt-4 mb-2">
                  {tier.price}
                  {tier.price !== "Custom" && <span className="text-lg font-normal text-muted-foreground">/mo</span>}
                </div>
                <CardDescription className="text-base">{tier.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mb-8">
                  {tier.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start space-x-3">
                      <div className="mt-1 bg-green-100 rounded-full p-0.5">
                        <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                      </div>
                      <span className="text-sm text-slate-600">{feature}</span>
                    </div>
                  ))}
                </div>
                <Button
                  className={`w-full h-12 text-lg rounded-xl ${tier.popular
                    ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                    : "bg-secondary hover:bg-secondary/80 text-foreground"
                    }`}
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
