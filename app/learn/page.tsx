'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, FileText, LifeBuoy, Sparkles, Wand2 } from 'lucide-react';

import { Header, Footer } from '@/components/layout';
import { SnapDeck } from '@/components/marketing/SnapDeck/SnapDeck';
import { SlideNavArrows } from '@/components/marketing/SnapDeck/SlideNavArrows';
import { ArticleCard } from '@/components/marketing/Resources/ArticleCard';
import { Badge } from '@/components/ui/badge';
import { getAllArticles, getArticleCategories, getFeaturedArticles } from '@/lib/articles';
import { getFeaturedExamples } from '@/lib/examples';

// Slides:
//   1. Hero               — "Learn to Use Deckster" intro
//   2. Featured examples  — 3 example teasers, link to /examples gallery
//   3. Featured reads     — 3 hand-picked articles
//   4. Browse by topic    — 3 category cards (with sample articles + counts)
//   5. Docs + Help        — two big nav cards
//   6. CTA + footer       — dark gradient "Start building" CTA

const slideShellBase =
  'relative isolate flex min-h-[calc(100svh-3rem)] flex-col px-4 py-12 sm:px-6 lg:px-8';

export default function LearnPage() {
  const allArticles = getAllArticles();
  const featuredArticles = getFeaturedArticles().slice(0, 3);
  const articleCategories = getArticleCategories();
  const featuredExamples = getFeaturedExamples().slice(0, 3);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <SnapDeck />
      <SlideNavArrows />
      <Header />
      <main>
        {/* ─────────────────────────── Slide 1 — Hero ─────────────────────────── */}
        <section
          id="learn-hero"
          data-snap="slide"
          className={`${slideShellBase} items-center justify-center overflow-hidden bg-gradient-to-br from-purple-50 via-background to-blue-50 dark:from-purple-950/30 dark:via-background dark:to-blue-950/30`}
        >
          <div className="mx-auto w-full max-w-4xl text-center">
            <Badge
              variant="secondary"
              className="mb-6 inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200"
            >
              <Sparkles className="h-3 w-3" />
              The Learn hub
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Learn to use{' '}
              <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 bg-clip-text text-transparent">
                Deckster
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
              Examples, articles, guides — everything you need to get shipping decks fast with a
              team of specialist AI agents.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="#learn-examples"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-gradient-to-r from-purple-600 to-blue-600 px-6 text-sm font-medium text-white transition-all hover:from-purple-700 hover:to-blue-700"
              >
                Browse examples
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#learn-articles"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-input bg-background px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Read articles
              </Link>
            </div>
          </div>
        </section>

        {/* ────────────────────── Slide 2 — Featured Examples ────────────────────── */}
        <section
          id="learn-examples"
          data-snap="slide"
          className={`${slideShellBase} justify-center`}
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-purple-600 dark:text-purple-300">
                  <Wand2 className="h-4 w-4" />
                  Featured examples
                </div>
                <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                  See what other teams have shipped
                </h2>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  Real decks built by talking to the Director — no templates, no pixel-pushing.
                </p>
              </div>
              <Link
                href="/examples"
                className="inline-flex items-center gap-2 self-start rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                View full gallery
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {featuredExamples.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featuredExamples.map((example) => (
                  <Link
                    key={example.id}
                    href={`/examples/${example.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-purple-100 to-blue-100 text-5xl dark:from-purple-900/30 dark:to-blue-900/30">
                      📊
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200"
                        >
                          {example.industry}
                        </Badge>
                        <Badge variant="outline">{example.useCase}</Badge>
                      </div>
                      <h3 className="text-lg font-semibold leading-snug transition-colors group-hover:text-purple-600 dark:group-hover:text-purple-300">
                        {example.title}
                      </h3>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {example.description}
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
                        <span>{example.slideCount} slides</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
                Examples coming soon — check back shortly.
              </div>
            )}
          </div>
        </section>

        {/* ────────────────────── Slide 3 — Featured Reads ────────────────────── */}
        <section
          id="learn-articles"
          data-snap="slide"
          className={`${slideShellBase} justify-center`}
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-blue-600 dark:text-blue-300">
                  <BookOpen className="h-4 w-4" />
                  Featured reads
                </div>
                <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                  Hand-picked starting points
                </h2>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  A few deep dives on getting the most out of Deckster&apos;s multi-agent system.
                </p>
              </div>
              <Link
                href="#learn-topics"
                className="inline-flex items-center gap-2 self-start rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Browse by topic
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {featuredArticles.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featuredArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
                New articles coming soon.
              </div>
            )}
          </div>
        </section>

        {/* ─────────────────────── Slide 4 — Browse by Topic ─────────────────────── */}
        <section
          id="learn-topics"
          data-snap="slide"
          className={`${slideShellBase} items-center justify-center bg-muted/30`}
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-10 text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wide text-purple-600 dark:text-purple-300">
                <Sparkles className="h-4 w-4" />
                Browse by topic
              </div>
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Pick a topic, go deeper
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
                {allArticles.length} articles across {articleCategories.length} categories.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {articleCategories.map((category) => {
                const samples = allArticles
                  .filter((a) => a.category === category.value)
                  .slice(0, 3);
                return (
                  <div
                    key={category.value}
                    className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-lg font-semibold tracking-tight">{category.label}</h3>
                      <Badge variant="secondary">{category.count}</Badge>
                    </div>
                    <ul className="flex-1 space-y-2.5">
                      {samples.map((article) => (
                        <li key={article.id}>
                          <Link
                            href={`/learn/${article.id}`}
                            className="group flex items-start gap-2 text-sm leading-snug text-foreground/85 transition-colors hover:text-primary"
                          >
                            <ArrowRight className="mt-1 h-3 w-3 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                            <span className="line-clamp-2 group-hover:underline">
                              {article.title}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ───────────────────── Slide 5 — Docs + Help entry ────────────────────── */}
        <section
          id="learn-docs-help"
          data-snap="slide"
          className={`${slideShellBase} items-center justify-center`}
        >
          <div className="mx-auto w-full max-w-5xl">
            <div className="mb-10 text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Need answers? Go deeper.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Reference docs for the full surface area, or the help center if you&apos;re stuck.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Link
                href="/docs"
                className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-purple-50 via-background to-purple-50 p-8 transition-all hover:-translate-y-1 hover:shadow-xl dark:from-purple-950/30 dark:to-purple-950/20"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-600/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight">Documentation</h3>
                  <p className="mt-2 text-muted-foreground">
                    The full reference — agents, elements, the API, and how everything fits
                    together.
                  </p>
                </div>
                <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-purple-600 transition-transform group-hover:translate-x-1 dark:text-purple-300">
                  Open the docs
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>

              <Link
                href="/help"
                className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-blue-50 via-background to-blue-50 p-8 transition-all hover:-translate-y-1 hover:shadow-xl dark:from-blue-950/30 dark:to-blue-950/20"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                  <LifeBuoy className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight">Help center</h3>
                  <p className="mt-2 text-muted-foreground">
                    Searchable answers, troubleshooting, and how to get a human when you need one.
                  </p>
                </div>
                <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-transform group-hover:translate-x-1 dark:text-blue-300">
                  Get help
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* ──────────────────── Slide 6 — CTA + compact footer ──────────────────── */}
        <section
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col overflow-hidden bg-[hsl(240,10%,4%)]"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(280_90%_45%/0.45),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(200_95%_50%/0.35),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(320_85%_55%/0.30),transparent_55%)]" />
          </div>

          <div className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
            <div className="mx-auto w-full max-w-3xl text-center">
              <h2 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl">
                Enough reading.{' '}
                <span className="block bg-gradient-to-r from-[hsl(280,90%,75%)] via-[hsl(320,90%,75%)] to-[hsl(200,95%,75%)] bg-clip-text text-transparent">
                  Start building.
                </span>
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-white/70 sm:text-lg">
                Open the builder, tell the Director what you want, and watch the team of agents
                turn it into a deck.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/builder"
                  className="inline-flex h-12 items-center gap-2 rounded-md bg-gradient-to-r from-[hsl(280,90%,60%)] via-[hsl(320,90%,60%)] to-[hsl(200,95%,60%)] px-7 text-base font-semibold text-white shadow-lg shadow-purple-500/30 transition-transform hover:scale-[1.02]"
                >
                  Start building
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex h-12 items-center gap-2 rounded-md border border-white/20 bg-white/5 px-7 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
                >
                  Talk to the team
                </Link>
              </div>
            </div>
          </div>

          <Footer compact />
        </section>
      </main>
    </div>
  );
}
