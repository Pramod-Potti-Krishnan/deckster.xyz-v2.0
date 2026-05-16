'use client';

import { useState, useMemo } from 'react';
import { TemplateFilters as TFilters } from '@/types/template';
import { filterTemplates, getAllTemplates } from '@/lib/templates';
import { TemplateCard } from '@/components/marketing/TemplateGallery/TemplateCard';
import { TemplateFilters } from '@/components/marketing/TemplateGallery/TemplateFilters';
import { Header, Footer } from '@/components/layout';
import { SnapDeck } from '@/components/marketing/SnapDeck/SnapDeck';
import { SlideNavArrows } from '@/components/marketing/SnapDeck/SlideNavArrows';

export default function TemplatesPage() {
  const allTemplates = getAllTemplates();
  const [filters, setFilters] = useState<TFilters>({ sortBy: 'newest' });

  const filteredTemplates = useMemo(
    () => filterTemplates(filters),
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
          id="templates-hero"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-3xl text-center">
            <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              Presentation Templates
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
              Browse our collection of professionally designed templates. Each template is powered by our AI agents to help you create stunning presentations in minutes.
            </p>
          </div>
        </section>

        {/* Slide 2 — Filtered grid */}
        <section
          id="templates-gallery"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-7xl">
            {/* Filters */}
            <div className="mb-8">
              <TemplateFilters
                filters={filters}
                onFiltersChange={setFilters}
                totalCount={allTemplates.length}
              />
            </div>

            {/* Results Count */}
            <div className="mb-6">
              <p className="text-sm text-muted-foreground">
                Showing {filteredTemplates.length} {filteredTemplates.length === 1 ? 'template' : 'templates'}
              </p>
            </div>

            {/* Templates Grid */}
            {filteredTemplates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="max-w-md mx-auto">
                  <h3 className="text-lg font-semibold mb-2">No templates found</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your filters or search query
                  </p>
                  <button
                    onClick={() => setFilters({ sortBy: 'newest' })}
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
          id="templates-cta"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col"
        >
          <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-3xl py-12 px-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Start with a Template
              </h2>
              <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                Pick a template and let our AI agents shape it into your story — or start from scratch and build something entirely your own.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/builder"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 h-10 px-6"
                >
                  Start Building
                </a>
                <a
                  href="/examples"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-6"
                >
                  See Examples
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
