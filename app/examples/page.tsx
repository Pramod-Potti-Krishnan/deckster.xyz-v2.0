'use client';

import { useState, useMemo } from 'react';
import { ExampleFilters as EFilters } from '@/types/example';
import { filterExamples, getAllExamples } from '@/lib/examples';
import { ExampleCard } from '@/components/marketing/ExampleShowcase/ExampleCard';
import { ExampleFilters } from '@/components/marketing/ExampleShowcase/ExampleFilters';
import { Header, Footer } from '@/components/layout';
import { SnapDeck } from '@/components/marketing/SnapDeck/SnapDeck';
import { SlideNavArrows } from '@/components/marketing/SnapDeck/SlideNavArrows';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

export default function ExamplesPage() {
  const allExamples = getAllExamples();
  const [filters, setFilters] = useState<EFilters>({ sortBy: 'popular' });

  const filteredExamples = useMemo(
    () => filterExamples(filters),
    [filters]
  );

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <SnapDeck />
      <SlideNavArrows />
      <Header />
      <main>
        {/* Slide 1 — Hero */}
        <section
          id="examples-hero"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4 inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Built by eight AI agents
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              See what you could make
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
              Real decks built with Deckster, across different industries and use cases. Talk to the Director in chat and your eight AI agents turn out a first draft in minutes.
            </p>
          </div>
        </section>

        {/* Slide 2 — Filtered gallery */}
        <section
          id="examples-gallery"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-7xl">
            {/* Filters */}
            <div className="mb-8">
              <ExampleFilters
                filters={filters}
                onFiltersChange={setFilters}
                totalCount={allExamples.length}
              />
            </div>

            {/* Results Count */}
            <div className="mb-6">
              <p className="text-sm text-muted-foreground">
                Showing {filteredExamples.length} {filteredExamples.length === 1 ? 'example' : 'examples'}
              </p>
            </div>

            {/* Examples Grid */}
            {filteredExamples.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredExamples.map((example) => (
                  <ExampleCard
                    key={example.id}
                    example={example}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="max-w-md mx-auto">
                  <h3 className="text-lg font-semibold mb-2">No examples found</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your filters or search query
                  </p>
                  <button
                    onClick={() => setFilters({ sortBy: 'popular' })}
                    className="text-primary hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Slide 3 — CTA + compact footer */}
        <section
          id="examples-cta"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col"
        >
          <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-3xl py-12 px-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Ready to create your own?
              </h2>
              <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                Start building professional presentations with AI in minutes. Choose from templates or create from scratch.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/builder"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 h-10 px-6"
                >
                  Start Building
                </a>
                <a
                  href="/templates"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-6"
                >
                  Browse Templates
                </a>
              </div>
            </div>
          </div>
          <Footer compact />
        </section>
      </main>
    </div>
  );
}
