'use client';

import { useState } from 'react';
import { IntegrationCategory, IntegrationStatus } from '@/types/integration';
import { getAllIntegrations, getIntegrationsByCategory, getIntegrationsByStatus } from '@/lib/integrations';
import { IntegrationCard } from '@/components/marketing/Integrations/IntegrationCard';
import { Header, Footer } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plug2 } from 'lucide-react';
import { integrationCategories } from '@/content/integrations';

export default function IntegrationsPage() {
  const allIntegrations = getAllIntegrations();
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<IntegrationStatus | 'all'>('all');

  const filteredIntegrations = allIntegrations.filter(integration => {
    const categoryMatch = selectedCategory === 'all' || integration.category === selectedCategory;
    const statusMatch = selectedStatus === 'all' || integration.status === selectedStatus;
    return categoryMatch && statusMatch;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Header */}
      <div className="border-b bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <Plug2 className="h-3 w-3 mr-1" />
              Integrations & Exports
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Integrations & Export Options
            </h1>
            <p className="text-lg text-muted-foreground">
              Connect deckster with your favorite tools and export in multiple formats.
              Seamlessly integrate into your existing workflow.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 py-8">
        {/* Category Filter */}
        <div className="mb-8">
          <Tabs
            value={selectedCategory}
            onValueChange={(value) => setSelectedCategory(value as IntegrationCategory | 'all')}
            className="w-full"
          >
            <TabsList className="w-full justify-start flex-wrap h-auto">
              <TabsTrigger value="all" className="flex-shrink-0">
                All Integrations ({allIntegrations.length})
              </TabsTrigger>
              {integrationCategories.map((category) => (
                <TabsTrigger
                  key={category.value}
                  value={category.value}
                  className="flex-shrink-0"
                >
                  {category.label} ({category.count})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Status Filter */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Filter by status:</span>
            <div className="flex gap-2">
              <Badge
                variant={selectedStatus === 'all' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedStatus('all')}
              >
                All
              </Badge>
              <Badge
                variant={selectedStatus === 'available' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedStatus('available')}
              >
                Available Now
              </Badge>
              <Badge
                variant={selectedStatus === 'beta' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedStatus('beta')}
              >
                Beta
              </Badge>
              <Badge
                variant={selectedStatus === 'coming-soon' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedStatus('coming-soon')}
              >
                Coming Soon
              </Badge>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Showing {filteredIntegrations.length} {filteredIntegrations.length === 1 ? 'integration' : 'integrations'}
          </p>
        </div>

        {/* Integrations Grid */}
        {filteredIntegrations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-semibold mb-2">No integrations found</h3>
              <p className="text-muted-foreground mb-4">
                Try selecting a different category or status filter
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedStatus('all');
                }}
                className="text-primary hover:underline"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}

        {/* Request Integration Section */}
        <div className="mt-16 py-12 px-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Don't See Your Integration?
          </h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            We're constantly adding new integrations based on user feedback. Let us know what tools you'd like to connect with deckster.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/help"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 h-10 px-6"
            >
              Request Integration
            </a>
            <a
              href="/docs"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-6"
            >
              View API Docs
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
