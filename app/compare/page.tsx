'use client';

import { Header, Footer } from '@/components/layout';
import { SnapDeck } from '@/components/marketing/SnapDeck/SnapDeck';
import { SlideNavArrows } from '@/components/marketing/SnapDeck/SlideNavArrows';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, Sparkles, Users, Zap, Award } from 'lucide-react';
import Link from 'next/link';

// Real, specific differentiators per competitor — drawn from how Deckster's
// 8-agent system actually compares to each one. Used by ComparisonCard below.
type Differentiator = { title: string; body: string };
type CompetitorCard = {
  slug: string;
  name: string;
  tagline: string;
  intro: string;
  differentiators: Differentiator[];
};

const POWERPOINT: CompetitorCard = {
  slug: 'powerpoint',
  name: 'PowerPoint',
  tagline: 'Microsoft presentation software',
  intro:
    "PowerPoint gives you total manual control over every pixel. Deckster gives you a team of eight AI specialists that compose the deck for you.",
  differentiators: [
    {
      title: 'You direct, the team builds',
      body:
        "Talk to the Director and eight specialists collaborate on research, copy, charts, theme, and layout. PowerPoint expects you to place every element by hand.",
    },
    {
      title: 'Content writes itself',
      body:
        "The Content Generator drafts headlines, body copy, and speaker notes from your brief. PowerPoint hands you a blank slide and a cursor.",
    },
    {
      title: 'Theme everything in one move',
      body:
        "The Theme Builder pushes a brand palette and type system through every slide and chart. PowerPoint requires manual styling slide-by-slide.",
    },
  ],
};

const PITCH: CompetitorCard = {
  slug: 'pitch',
  name: 'Pitch',
  tagline: 'Collaborative presentation software',
  intro:
    "Pitch is built for teams editing slides together in real time. Deckster is built for AI agents creating slides for you, with one person directing.",
  differentiators: [
    {
      title: 'Solo director, AI team',
      body:
        "Deckster's eight specialists handle the work a design or copy team would normally split. Pitch is built around humans co-editing.",
    },
    {
      title: 'Generated, not co-typed',
      body:
        "The Content Generator drafts copy, the Visualizer builds charts, the Slide Composer balances layout. Pitch users still write and place every element themselves.",
    },
    {
      title: 'Conversation-driven refinement',
      body:
        "Refine any slide by talking to the Director — “tighten this”, “make the chart a waterfall”, “re-theme to dark”. Pitch users edit cells directly.",
    },
  ],
};

const BEAUTIFUL_AI: CompetitorCard = {
  slug: 'beautiful-ai',
  name: 'Beautiful.ai',
  tagline: 'Design AI presentation tool',
  intro:
    "Beautiful.ai is design intelligence — it auto-arranges your content into clean layouts. Deckster is a full creation team — it writes the content and designs the layout.",
  differentiators: [
    {
      title: 'You bring the words to Beautiful.ai',
      body:
        "Beautiful.ai accelerates the design step once you've written the deck. Deckster's Content Generator drafts the copy from your brief before any layout work begins.",
    },
    {
      title: 'Composed layouts, not template variations',
      body:
        "Beautiful.ai picks from a library of smart templates. Deckster's Slide Composer composes each slide for the specific content it carries.",
    },
    {
      title: 'Design assist vs full creation loop',
      body:
        "Beautiful.ai owns the polish step. Deckster owns research, copy, data viz, theme, layout, and refinement — the whole loop.",
    },
  ],
};

const GAMMA: CompetitorCard = {
  slug: 'gamma',
  name: 'Gamma',
  tagline: 'AI-powered presentation generator',
  intro:
    "Gamma is fast single-AI generation in a document-style format. Deckster is a multi-agent team building traditional slide decks for board rooms and pitches.",
  differentiators: [
    {
      title: 'One AI vs eight specialists',
      body:
        "Gamma uses a single general AI. Deckster has eight specialists — refine just the chart, just the copy, just the theme, or just the layout without rebuilding the slide.",
    },
    {
      title: 'Cards vs traditional slides',
      body:
        "Gamma optimizes for scrollable document-style cards. Deckster builds traditional 16:9 slide layouts that present cleanly in board rooms and investor decks.",
    },
    {
      title: 'First-draft speed vs presentation polish',
      body:
        "Gamma is fastest for an AI first draft. Deckster's refinement loops produce decks ready to walk into a meeting with.",
    },
  ],
};

export default function ComparePage() {
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
              An honest look at where Deckster wins, where the others do, and
              which one fits how you work.
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

        {/* Slide 3: vs PowerPoint — single rich comparison card */}
        <section
          id="compare-powerpoint"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12"
        >
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-8 text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                vs PowerPoint
              </h2>
              <p className="mt-3 text-balance text-base text-muted-foreground sm:text-lg">
                Manual creation vs AI-native creation.
              </p>
            </div>
            <ComparisonCard card={POWERPOINT} accent="from-orange-600 to-red-600" />
          </div>
        </section>

        {/* Slide 4: vs Pitch — single rich comparison card */}
        <section
          id="compare-pitch"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12"
        >
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-8 text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                vs Pitch
              </h2>
              <p className="mt-3 text-balance text-base text-muted-foreground sm:text-lg">
                Real-time team co-editing vs AI-assisted creation.
              </p>
            </div>
            <ComparisonCard card={PITCH} accent="from-pink-600 to-rose-600" />
          </div>
        </section>

        {/* Slide 5: vs other AI presentation tools — Beautiful.ai + Gamma side-by-side */}
        <section
          id="compare-ai-tools"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12"
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-8 text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                vs other AI presentation tools
              </h2>
              <p className="mt-3 text-balance text-base text-muted-foreground sm:text-lg">
                Multi-agent specialization vs single-AI generation.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ComparisonCard card={BEAUTIFUL_AI} accent="from-blue-600 to-cyan-600" />
              <ComparisonCard card={GAMMA} accent="from-purple-600 to-pink-600" />
            </div>
          </div>
        </section>

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

function ComparisonCard({ card, accent }: { card: CompetitorCard; accent: string }) {
  return (
    <Card className="group flex h-full flex-col border-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader className="pb-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-balance text-2xl">
              Deckster vs {card.name}
            </CardTitle>
            <Badge variant="secondary" className="mt-2">
              {card.tagline}
            </Badge>
          </div>
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${accent}`}
            aria-hidden
          >
            <Sparkles className="h-5 w-5 text-white" />
          </div>
        </div>
        <CardDescription className="text-balance text-base leading-relaxed text-foreground/80">
          {card.intro}
        </CardDescription>
      </CardHeader>
      <div className="flex-1 px-6 pb-6">
        <ul className="space-y-4">
          {card.differentiators.map((d) => (
            <li key={d.title} className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
              <div>
                <div className="text-sm font-semibold leading-tight">{d.title}</div>
                <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {d.body}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Link
          href={`/compare/${card.slug}`}
          className="mt-6 inline-flex items-center text-sm font-medium text-primary hover:underline"
        >
          See full comparison
          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </Card>
  );
}
