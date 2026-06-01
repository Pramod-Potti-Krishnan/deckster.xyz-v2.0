'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Brush,
  Check,
  FileDown,
  Layers,
  MessagesSquare,
  Plus,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';

import { Header, Footer } from '@/components/layout';
import { SnapDeck } from '@/components/marketing/SnapDeck/SnapDeck';
import { SlideNavArrows } from '@/components/marketing/SnapDeck/SlideNavArrows';
import { PricingTierCard } from '@/components/marketing/HomepageV2/PricingV2/PricingV2Section';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PRICING_COPY, PRICING_TIERS } from '@/lib/marketing/homepage-v2-pricing';

// Slides:
//   1. Hero + 3 tier cards   — money shot, uses the canonical PricingTierCard
//   2. What every plan includes — universal floor, 6 capability cards
//   3. What you get as you go up — per-tier deltas, replaces the legacy 50-row table
//   4. Credits + top-ups      — pay-as-you-grow framing
//   5. FAQ                    — 6 trimmed questions, accordion
//   6. CTA + footer           — dark gradient final slide with compact footer

const slideShellBase =
  'relative isolate flex min-h-[calc(100svh-3rem)] flex-col px-4 py-12 sm:px-6 lg:px-8';

const BASE_CAPABILITIES: ReadonlyArray<{
  icon: typeof Sparkles;
  title: string;
  body: string;
}> = [
  {
    icon: Workflow,
    title: 'Talk to the Director',
    body: 'Conversation-driven creation. Refine any slide by talking — never by hunting through menus.',
  },
  {
    icon: Layers,
    title: '9 element types',
    body: 'Text, metrics, tables, charts, images, icons, shapes, infographics, and diagrams — built per slide.',
  },
  {
    icon: BarChart3,
    title: 'Every chart + diagram',
    body: '18 chart types, 8 diagram subtypes, and unlimited infographic shapes — all theme-aware.',
  },
  {
    icon: Brush,
    title: 'Custom themes',
    body: 'The Theme Builder reads your brand and applies palette, type, and surfaces across every slide.',
  },
  {
    icon: FileDown,
    title: 'PPTX & PDF export',
    body: 'No watermark on any tier. Decks open in PowerPoint and Keynote with the same fidelity.',
  },
  {
    icon: MessagesSquare,
    title: 'Real-time refinement',
    body: 'Edit any element by asking — "make the chart a waterfall", "tighten this slide", "re-theme to dark".',
  },
];

const TIER_DELTAS: Record<
  'starter' | 'pro' | 'premium',
  { label: string; items: ReadonlyArray<string> }
> = {
  starter: {
    label: 'The foundation',
    items: [
      'Director, Content Generator, Visualizer, Slide Composer, Theme Builder',
      'All chart, diagram, and infographic types',
      'Custom themes',
      'PPTX & PDF export — no watermark',
      'Generous monthly credits for typical workloads',
    ],
  },
  pro: {
    label: 'Adds research depth',
    items: [
      'Researcher: pull live data from the open web',
      'Upload your files as source material (RAG over your corpus)',
      'Analyst: insight extraction from your numbers',
      'Higher monthly credit allowance',
    ],
  },
  premium: {
    label: 'Adds the knowledge layer',
    items: [
      'Knowledge Graph: agents learn your domain across decks',
      'Priority generation queue',
      'Highest monthly credit allowance',
    ],
  },
};

const FAQS: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'How do credits work?',
    a:
      'Each deck draws credits based on its length and visual richness — a short text-only deck uses fewer credits than a 30-slide deck with research, charts, and infographics. Every tier comes with a generous monthly allowance, and top-ups are available anytime if you need more.',
  },
  {
    q: 'Can I switch plans anytime?',
    a:
      "Yes. Upgrade or downgrade from your account settings at any time. When you upgrade you'll be charged a prorated amount for the rest of the billing cycle; when you downgrade we credit the difference against your next bill.",
  },
  {
    q: 'What if I run out of credits mid-month?',
    a:
      "Top up anytime. Top-up credits don't expire, there's no commitment, and they sit alongside your monthly allowance until used. You only pay for what you need.",
  },
  {
    q: 'Do you offer team or volume pricing?',
    a:
      'Yes. For teams of 10+ we offer custom pricing with consolidated billing, SSO, and a dedicated point of contact. Get in touch via the contact page for a tailored quote.',
  },
  {
    q: 'What payment methods do you accept?',
    a:
      'All major credit and debit cards via Stripe. Annual-billing customers can also pay by wire transfer or invoice on request.',
  },
  {
    q: 'Is there a refund policy?',
    a:
      "We offer a 14-day money-back guarantee on the first month of any paid plan. If you're not satisfied within that window, contact support for a full refund.",
  },
];

const COMPARE_LINKS: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: 'beautiful-ai', label: 'vs Beautiful.ai' },
  { slug: 'gamma', label: 'vs Gamma' },
  { slug: 'pitch', label: 'vs Pitch' },
  { slug: 'powerpoint', label: 'vs PowerPoint' },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <SnapDeck />
      <SlideNavArrows />
      <Header />
      <main>
        {/* ─────────────── Slide 1 — Hero + 3 tier cards ─────────────── */}
        <section
          id="pricing-tiers"
          data-snap="slide"
          className={`${slideShellBase} items-center justify-center overflow-hidden bg-gradient-to-br from-purple-50 via-background to-blue-50 dark:from-purple-950/30 dark:via-background dark:to-blue-950/30`}
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <Badge
                variant="secondary"
                className="mb-4 inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200"
              >
                <Sparkles className="h-3 w-3" />
                {PRICING_COPY.eyebrow}
              </Badge>
              <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
                A team of agents,{' '}
                <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 bg-clip-text text-transparent">
                  on tap.
                </span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                {PRICING_COPY.description}
              </p>
            </div>

            <div className="mx-auto mt-10 grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
              {PRICING_TIERS.map((tier) => (
                <PricingTierCard key={tier.id} tier={tier} />
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────── Slide 2 — What every plan includes ─────────────── */}
        <section
          id="pricing-included"
          data-snap="slide"
          className={`${slideShellBase} items-center justify-center`}
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide text-purple-600 dark:text-purple-300">
                <Check className="h-4 w-4" />
                Every plan includes
              </div>
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                The full creation engine
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
                Every tier ships with the agent team, every element type, and the export quality
                to walk into a meeting with — Starter to Max.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {BASE_CAPABILITIES.map((cap) => {
                const Icon = cap.icon;
                return (
                  <div
                    key={cap.title}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold">{cap.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{cap.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─────────────── Slide 3 — What you get as you go up ─────────────── */}
        <section
          id="pricing-deltas"
          data-snap="slide"
          className={`${slideShellBase} items-center justify-center bg-muted/30`}
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide text-blue-600 dark:text-blue-300">
                <ArrowRight className="h-4 w-4" />
                Level up
              </div>
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                What you get as you go up
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
                Each tier builds on the last — no rebuy, just more agents and more capacity.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              {(['starter', 'pro', 'premium'] as const).map((tierId) => {
                const tier = PRICING_TIERS.find((t) => t.id === tierId)!;
                const delta = TIER_DELTAS[tierId];
                const isHighlight = tierId === 'pro';
                return (
                  <div
                    key={tierId}
                    className={`relative flex flex-col gap-4 rounded-2xl border bg-card p-6 ${
                      isHighlight
                        ? 'border-primary/40 shadow-md ring-1 ring-primary/10'
                        : 'border-border'
                    }`}
                  >
                    {isHighlight && (
                      <span className="absolute right-5 top-5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Most popular
                      </span>
                    )}
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-lg font-semibold tracking-tight">{tier.name}</h3>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {tier.price}
                      </span>
                    </div>
                    <div className="text-xs font-medium uppercase tracking-wide text-purple-600 dark:text-purple-300">
                      {delta.label}
                    </div>
                    <ul className="space-y-2">
                      {delta.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-sm leading-snug text-foreground/85"
                        >
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─────────────── Slide 4 — Credits + top-ups ─────────────── */}
        <section
          id="pricing-credits"
          data-snap="slide"
          className={`${slideShellBase} items-center justify-center`}
        >
          <div className="mx-auto w-full max-w-5xl">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                <Plus className="h-4 w-4" />
                Pay-as-you-grow
              </div>
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Credits scale with how much you present
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
                Each deck draws from your monthly allowance. If you need more in a busy month,
                top up — no surprise bills.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-purple-600 dark:text-purple-300">
                  <Zap className="h-4 w-4" />
                  Monthly allowance
                </div>
                <h3 className="text-xl font-semibold">Generous credits with every plan</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-foreground/85">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>
                      <strong>Starter</strong> — fits typical monthly workloads.
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-foreground/85">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>
                      <strong>Pro</strong> — for research-heavy and frequent presenters.
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-foreground/85">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>
                      <strong>Max</strong> — for people whose core work is presentations.
                    </span>
                  </li>
                </ul>
                <p className="text-xs italic leading-snug text-muted-foreground">
                  Actual credit usage depends on slide count, visual richness, and research depth.
                </p>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-blue-600 dark:text-blue-300">
                  <Plus className="h-4 w-4" />
                  Top up anytime
                </div>
                <h3 className="text-xl font-semibold">{PRICING_COPY.topUpHeadline}</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-foreground/85">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>No commitment — buy what you need.</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-foreground/85">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>Top-up credits don&apos;t expire.</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-foreground/85">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>Available on every tier.</span>
                  </li>
                </ul>
                <Link
                  href="/builder"
                  className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  See top-up packs in the builder
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────── Slide 5 — FAQ ─────────────── */}
        <section
          id="pricing-faq"
          data-snap="slide"
          className={`${slideShellBase} items-center justify-center bg-muted/30`}
        >
          <div className="mx-auto w-full max-w-3xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Common questions
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
                The six we hear most. Need more? The help center has the rest.
              </p>
            </div>

            <Accordion type="single" collapsible className="mt-8 w-full">
              {FAQS.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-base font-medium">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link href="/help">Visit help center</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/contact">Contact support</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ─────────────── Slide 6 — CTA + footer ─────────────── */}
        <section
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col overflow-hidden bg-[hsl(240,10%,4%)]"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(280_90%_45%/0.45),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(200_95%_50%/0.35),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(320_85%_55%/0.30),transparent_55%)]" />
          </div>

          <div className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-3xl text-center">
              <h2 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl">
                Pick a plan.{' '}
                <span className="block bg-gradient-to-r from-[hsl(280,90%,75%)] via-[hsl(320,90%,75%)] to-[hsl(200,95%,75%)] bg-clip-text text-transparent">
                  Ship your first deck.
                </span>
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-white/70 sm:text-lg">
                Tell the Director what you want. Watch the team of agents build it.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/builder"
                  className="inline-flex h-12 items-center gap-2 rounded-md bg-gradient-to-r from-[hsl(280,90%,60%)] via-[hsl(320,90%,60%)] to-[hsl(200,95%,60%)] px-7 text-base font-semibold text-white shadow-lg shadow-purple-500/30 transition-transform hover:scale-[1.02]"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex h-12 items-center gap-2 rounded-md border border-white/20 bg-white/5 px-7 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
                >
                  Talk to sales
                </Link>
              </div>

              <div className="mt-10">
                <p className="mb-3 text-sm text-white/70">How does Deckster compare?</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {COMPARE_LINKS.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/compare/${c.slug}`}
                      className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
                    >
                      {c.label}
                    </Link>
                  ))}
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
