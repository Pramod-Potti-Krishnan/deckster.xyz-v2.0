'use client';

import { useState, useMemo } from 'react';
import { ExampleFilters as EFilters } from '@/types/example';
import { filterExamples, getAllExamples } from '@/lib/examples';
import { ExampleCard } from '@/components/marketing/ExampleShowcase/ExampleCard';
import { ExampleFilters } from '@/components/marketing/ExampleShowcase/ExampleFilters';
import { Header, Footer } from '@/components/layout';
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
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Header */}
      <div className="border-b bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <Sparkles className="h-3 w-3 mr-1" />
              Powered by Multi-Agent AI
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Example Presentations
            </h1>
            <p className="text-lg text-muted-foreground">
              Explore real presentations created with deckster. See what's possible with our multi-agent AI system across different industries and use cases.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 py-8">
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

        {/* CTA Section */}
        <div className="mt-16 py-12 px-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Create Your Own?
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

      <Footer />
    </div>
  );
}
