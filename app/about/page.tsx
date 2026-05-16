'use client';

import { Header, Footer } from '@/components/layout';
import { SnapDeck } from '@/components/marketing/SnapDeck/SnapDeck';
import { SlideNavArrows } from '@/components/marketing/SnapDeck/SlideNavArrows';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Users,
  Target,
  Heart,
  Lightbulb,
  TrendingUp,
  Shield,
} from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <SnapDeck />
      <SlideNavArrows />
      <Header />
      <main>
        {/* Slide 1: Hero / Mission */}
        <section
          id="about-hero"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-4xl text-center">
            <Badge variant="secondary" className="mb-6 inline-flex items-center gap-1.5">
              <Heart className="h-3 w-3" />
              Our Story
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              Building the Future of Presentations
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl">
              We believe presentations should be created by intelligent collaboration, not manual labor.
            </p>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              <Card className="border-2 text-left">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600">
                    <Lightbulb className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>Innovation First</CardTitle>
                  <CardDescription>
                    We push the boundaries of what AI can do in presentation design with our multi-agent approach.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2 text-left">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>Transparency</CardTitle>
                  <CardDescription>
                    Our Chain-of-Thought approach shows you how and why AI makes decisions.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2 text-left">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-pink-600 to-rose-600">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>User-Centric</CardTitle>
                  <CardDescription>
                    Every feature we build starts with real user needs and workflows.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Slide 2: Values */}
        <section
          id="about-values"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-5xl">
            <div className="mb-12 text-center">
              <h2 className="text-balance text-3xl font-bold sm:text-4xl md:text-5xl">Our Values</h2>
              <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-muted-foreground">
                The principles that guide every decision we make.
              </p>
            </div>

            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <Target className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-semibold">Quality Over Speed</h3>
                  <p className="text-muted-foreground">
                    While we&apos;re fast, we never sacrifice quality. Every presentation should be something you&apos;re proud to share.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-semibold">Privacy First</h3>
                  <p className="text-muted-foreground">
                    Your data is yours. We never train our models on your content without explicit permission.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-semibold">Continuous Innovation</h3>
                  <p className="text-muted-foreground">
                    AI is evolving rapidly, and so are we. Expect regular updates and new capabilities.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <Heart className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-semibold">Customer Success</h3>
                  <p className="text-muted-foreground">
                    We measure our success by yours. Every feature is designed to help you create better presentations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Slide 3: How Deckster Was Born / Team Story */}
        <section
          id="about-story"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-10 text-center">
              <h2 className="text-balance text-3xl font-bold sm:text-4xl md:text-5xl">How Deckster Was Born</h2>
              <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-muted-foreground">
                From frustration to innovation.
              </p>
            </div>

            <div className="space-y-5 text-base leading-relaxed sm:text-lg">
              <p>
                Like many professionals, we spent countless hours creating presentations. The process was always the same:
                start with a blank slide, struggle with layouts, fight with formatting, and somehow never have enough time
                for what really matters&mdash;the content and story.
              </p>

              <p>
                When AI presentation tools emerged, we were excited. But something was missing. Single AI systems produced
                generic outputs. They lacked the nuanced understanding that comes from specialized expertise.
              </p>

              <p>
                That&apos;s when we had our &ldquo;aha&rdquo; moment: <strong>What if we could build a team of AI agents,
                each specialized in a different aspect of presentation creation?</strong> Just like real creative teams&mdash;with
                strategists, writers, designers, and analysts collaborating to produce exceptional work.
              </p>

              <p>
                After months of development, Deckster was born. Our multi-agent system combines the Director&apos;s
                strategic vision, the Scripter&apos;s storytelling prowess, the Graphic Artist&apos;s design expertise, and the Data
                Visualizer&apos;s analytical clarity&mdash;all transparent through Chain-of-Thought reasoning.
              </p>
            </div>
          </div>
        </section>

        {/* Slide 4: CTA + compact footer */}
        <section
          id="about-cta"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col"
        >
          <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-3xl">
              <div className="rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-16 text-center text-white sm:px-12">
                <h2 className="text-balance text-3xl font-bold sm:text-4xl md:text-5xl">
                  Join Us on This Journey
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed opacity-90 sm:text-lg">
                  We&apos;re building the future of presentations, and we&apos;d love to have you with us.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
                  <Button
                    size="lg"
                    variant="secondary"
                    asChild
                    className="bg-white text-purple-600 hover:bg-gray-100"
                  >
                    <Link href="/builder">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Start Creating
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="border-2 border-white/20 bg-white/10 text-white hover:bg-white/20"
                  >
                    <Link href="/help">Contact Us</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Footer compact />
        </section>
      </main>
    </div>
  );
}
