'use client';

import { getAllCompetitors } from '@/lib/comparisons';
import { Header, Footer } from '@/components/layout';
import { SnapDeck } from '@/components/marketing/SnapDeck/SnapDeck';
import { SlideNavArrows } from '@/components/marketing/SnapDeck/SlideNavArrows';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, Sparkles, Users, Zap, Award } from 'lucide-react';
import Link from 'next/link';
import type { Competitor } from '@/types/comparison';

export default function ComparePage() {
  const competitors = getAllCompetitors();

  const aiCompetitors = competitors.filter(c => c.category === 'presentation-ai');
  const toolCompetitors = competitors.filter(c => c.category === 'presentation-tool');
  const traditionalCompetitors = competitors.filter(c => c.category === 'traditional');

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <SnapDeck />
      <SlideNavArrows />
      <Header />

      <main>
        {/* Slide 1: Hero — light, just the headline + CTAs */}
        <section
          id="compare-hero"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-purple-50 via-background to-blue-50 px-4 py-12 dark:from-purple-950/20 dark:via-background dark:to-blue-950/20"
        >
          <div className="mx-auto max-w-4xl text-center">
            <Badge className="mb-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <Award className="mr-1 h-3 w-3" />
              Honest Comparisons
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              How Deckster{' '}
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                Compares
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl">
              How our multi-agent AI system stacks up against the rest of the
              presentation landscape.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Link href="/builder">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Get Started
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/agents">Meet the Team</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Slide 2: What makes Deckster different — the 3 differentiators */}
        <section
          id="compare-differentiators"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12"
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                What makes Deckster different
              </h2>
              <p className="mt-3 text-balance text-base text-muted-foreground sm:text-lg">
                Three things you won&apos;t find in other tools.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              <Card className="border-2">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>Specialized AI Agents</CardTitle>
                  <CardDescription>
                    Eight AI specialists — Director, Researcher, Analyst, Content Generator,
                    Visualizer, Theme Builder, Slide Composer, Element Generator — work
                    together. Not one general AI doing everything.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>True Content Creation</CardTitle>
                  <CardDescription>
                    AI actually writes your content — headlines, body, speaker notes — not
                    just nudges your design or suggests templates.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-pink-600 to-rose-600">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>Minutes, Not Hours</CardTitle>
                  <CardDescription>
                    Complete decks from scratch in minutes. The agents handle the heavy
                    lifting so you stay in the conversation, not in the tool.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Slide 2: vs Traditional Software (PowerPoint / Keynote) */}
        {traditionalCompetitors.length > 0 && (
          <CompareCategorySlide
            id="compare-traditional"
            title="vs. Traditional Software"
            subtitle="Next generation AI vs. proven standards"
            description="How AI-native tools are changing presentation creation."
            checklistLabel="Honest comparison of both approaches"
            competitors={traditionalCompetitors}
          />
        )}

        {/* Slide 3: vs Collaboration Platforms (Canva / Beautiful.ai) */}
        {toolCompetitors.length > 0 && (
          <CompareCategorySlide
            id="compare-collaboration"
            title="vs. Collaboration Platforms"
            subtitle="AI-first creation vs. team collaboration"
            description="Different philosophies: AI creation vs. collaborative editing."
            checklistLabel="When to choose each platform"
            competitors={toolCompetitors}
          />
        )}

        {/* Slide 4: vs AI-Powered Tools */}
        {aiCompetitors.length > 0 && (
          <CompareCategorySlide
            id="compare-ai"
            title="vs. AI-Powered Tools"
            subtitle="How we compare to other AI presentation tools"
            description={(name) => `See how our multi-agent AI system compares to ${name}'s approach.`}
            checklistLabel="Detailed feature comparison"
            competitors={aiCompetitors}
          />
        )}

        {/* Slide 5: CTA + compact footer */}
        <section
          id="compare-cta"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col"
        >
          <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 px-4 py-12 dark:from-purple-950/20 dark:to-blue-950/20">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-5xl">
                Try the Difference Yourself
              </h2>
              <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
                See how a multi-agent team builds a deck end-to-end.
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  <Link href="/builder">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Get Started
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/examples">View Example Decks</Link>
                </Button>
              </div>
            </div>
          </div>
          <Footer compact />
        </section>
      </main>
    </div>
  );
}

interface CompareCategorySlideProps {
  id: string;
  title: string;
  subtitle: string;
  description: string | ((competitorName: string) => string);
  checklistLabel: string;
  competitors: Competitor[];
}

function CompareCategorySlide({
  id,
  title,
  subtitle,
  description,
  checklistLabel,
  competitors,
}: CompareCategorySlideProps) {
  return (
    <section
      id={id}
      data-snap="slide"
      className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-3xl font-bold md:text-5xl">{title}</h2>
          <p className="text-lg text-muted-foreground">{subtitle}</p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {competitors.map((competitor) => (
            <Link
              key={competitor.id}
              href={`/compare/${competitor.slug}`}
              className="group"
            >
              <Card className="h-full border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <CardHeader>
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <CardTitle className="mb-2 text-2xl">
                        Deckster vs {competitor.name}
                      </CardTitle>
                      <Badge variant="secondary" className="mb-3">
                        {competitor.tagline}
                      </Badge>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-purple-600" />
                  </div>
                  <CardDescription className="text-base">
                    {typeof description === 'function'
                      ? description(competitor.name)
                      : description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>{checklistLabel}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
