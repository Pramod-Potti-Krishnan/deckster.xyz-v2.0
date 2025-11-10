'use client';

import { Header, Footer } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  Users,
  Target,
  Zap,
  Heart,
  Lightbulb,
  TrendingUp,
  Shield,
  Award,
  Linkedin,
  Twitter,
  Github
} from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Hero Section */}
      <div className="border-b bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-pink-950/20">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <Heart className="h-3 w-3 mr-1" />
              Our Story
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Building the Future of Presentations
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              We believe presentations should be created by intelligent collaboration, not manual labor
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">

          {/* Mission Section */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Mission</h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                To democratize professional presentation design through transparent, collaborative AI
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="border-2">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center mb-4">
                    <Lightbulb className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>Innovation First</CardTitle>
                  <CardDescription>
                    We push the boundaries of what AI can do in presentation design with our multi-agent approach
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>Transparency</CardTitle>
                  <CardDescription>
                    Our Chain-of-Thought approach shows you how and why AI makes decisions
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-pink-600 to-rose-600 flex items-center justify-center mb-4">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>User-Centric</CardTitle>
                  <CardDescription>
                    Every feature we build starts with real user needs and workflows
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

          <Separator className="mb-20" />

          {/* The Story Section */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How Deckster Was Born</h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                From frustration to innovation
              </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-6 text-lg leading-relaxed">
              <p>
                Like many professionals, we spent countless hours creating presentations. The process was always the same:
                start with a blank slide, struggle with layouts, fight with formatting, and somehow never have enough time
                for what really matters—the content and story.
              </p>

              <p>
                When AI presentation tools emerged, we were excited. But something was missing. Single AI systems produced
                generic outputs. They lacked the nuanced understanding that comes from specialized expertise. A great
                presentation needs strategic thinking, compelling copy, beautiful design, and data clarity—all working together.
              </p>

              <p>
                That's when we had our "aha" moment: <strong>What if we could build a team of AI agents, each specialized
                in a different aspect of presentation creation?</strong> Just like how real creative teams work—with strategists,
                writers, designers, and analysts collaborating to produce exceptional work.
              </p>

              <p>
                After months of development and iteration, Deckster was born. Our multi-agent system combines the Director's
                strategic vision, the Scripter's storytelling prowess, the Graphic Artist's design expertise, and the Data
                Visualizer's analytical clarity. Together, they create presentations that truly stand out.
              </p>

              <p>
                But we didn't stop there. We believe AI should be transparent, not a black box. That's why we implemented
                Chain-of-Thought reasoning—so you can see exactly how our agents think, make decisions, and collaborate.
                You're in control, every step of the way.
              </p>
            </div>
          </div>

          <Separator className="mb-20" />

          {/* Values Section */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Values</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Target className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Quality Over Speed</h3>
                  <p className="text-muted-foreground">
                    While we're fast, we never sacrifice quality. Every presentation should be something you're proud to share.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Privacy First</h3>
                  <p className="text-muted-foreground">
                    Your data is yours. We never train our models on your content without explicit permission.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Continuous Innovation</h3>
                  <p className="text-muted-foreground">
                    AI is evolving rapidly, and so are we. Expect regular updates and new capabilities.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <Heart className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Customer Success</h3>
                  <p className="text-muted-foreground">
                    We measure our success by yours. Every feature is designed to help you create better presentations.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator className="mb-20" />

          {/* Why Now Section */}
          <div className="mb-20">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold mb-6 text-center">Why Now?</h2>
              <div className="space-y-4 text-lg leading-relaxed">
                <p>
                  The convergence of several breakthrough technologies makes this the perfect time for Deckster:
                </p>
                <ul className="space-y-3 ml-6">
                  <li className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-purple-600 flex-shrink-0 mt-1" />
                    <span><strong>Advanced LLMs:</strong> Modern language models can understand context, generate creative content,
                    and reason about complex problems</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-purple-600 flex-shrink-0 mt-1" />
                    <span><strong>Multi-Agent Systems:</strong> Specialized AI agents can now collaborate effectively,
                    combining their strengths</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-purple-600 flex-shrink-0 mt-1" />
                    <span><strong>Real-Time Processing:</strong> Cloud infrastructure enables instant generation and
                    editing at scale</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-purple-600 flex-shrink-0 mt-1" />
                    <span><strong>User Expectations:</strong> People increasingly expect AI assistance in their
                    creative workflows</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Trust & Security Section */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Built on Trust</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Security, privacy, and reliability are at our core
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Card className="text-center p-6">
                <Shield className="h-10 w-10 text-green-600 mx-auto mb-3" />
                <p className="font-semibold text-sm">SSL Encrypted</p>
                <p className="text-xs text-muted-foreground mt-1">Bank-level security</p>
              </Card>

              <Card className="text-center p-6">
                <Award className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                <p className="font-semibold text-sm">GDPR Compliant</p>
                <p className="text-xs text-muted-foreground mt-1">Privacy protected</p>
              </Card>

              <Card className="text-center p-6">
                <Shield className="h-10 w-10 text-orange-600 mx-auto mb-3" />
                <p className="font-semibold text-sm">99.9% Uptime</p>
                <p className="text-xs text-muted-foreground mt-1">Always available</p>
              </Card>

              <Card className="text-center p-6">
                <Heart className="h-10 w-10 text-purple-600 mx-auto mb-3" />
                <p className="font-semibold text-sm">Privacy First</p>
                <p className="text-xs text-muted-foreground mt-1">Your data is yours</p>
              </Card>
            </div>
          </div>

          {/* CTA Section */}
          <div className="py-16 px-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl text-white text-center">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              Join Us on This Journey
            </h3>
            <p className="text-lg mb-8 max-w-2xl mx-auto opacity-90">
              We're building the future of presentations, and we'd love to have you with us
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="secondary"
                asChild
                className="bg-white text-purple-600 hover:bg-gray-100"
              >
                <Link href="/builder">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Creating
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="bg-white/10 border-2 border-white/20 text-white hover:bg-white/20"
              >
                <Link href="/help">Contact Us</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
