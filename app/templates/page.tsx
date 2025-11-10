'use client';

import { useState, useMemo } from 'react';
import { TemplateFilters as TFilters } from '@/types/template';
import { filterTemplates, getAllTemplates } from '@/lib/templates';
import { TemplateCard } from '@/components/marketing/TemplateGallery/TemplateCard';
import { TemplateFilters } from '@/components/marketing/TemplateGallery/TemplateFilters';
import { Header, Footer } from '@/components/layout';

export default function TemplatesPage() {
  const allTemplates = getAllTemplates();
  const [filters, setFilters] = useState<TFilters>({ sortBy: 'newest' });

  const filteredTemplates = useMemo(
    () => filterTemplates(filters),
    [filters]
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      {/* Header */}
      <div className="border-b bg-muted/40">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Presentation Templates
            </h1>
            <p className="text-lg text-muted-foreground">
              Browse our collection of professionally designed templates. Each template is powered by
              our AI agents to help you create stunning presentations in minutes.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 py-8">
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

      <Footer />
    </div>
  );
}
