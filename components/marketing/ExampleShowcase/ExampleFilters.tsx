'use client';

import { ExampleIndustry, ExampleComplexity, ExampleFilters as EFilters } from '@/types/example';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { exampleIndustries } from '@/content/examples';

interface ExampleFiltersProps {
  filters: EFilters;
  onFiltersChange: (filters: EFilters) => void;
  totalCount: number;
}

export function ExampleFilters({ filters, onFiltersChange, totalCount }: ExampleFiltersProps) {
  const handleIndustryChange = (industry: string) => {
    onFiltersChange({
      ...filters,
      industry: industry === 'all' ? undefined : (industry as ExampleIndustry),
    });
  };

  const handleSearchChange = (search: string) => {
    onFiltersChange({
      ...filters,
      search: search || undefined,
    });
  };

  const handleComplexityChange = (complexity: string) => {
    onFiltersChange({
      ...filters,
      complexity: complexity === 'all' ? undefined : (complexity as ExampleComplexity),
    });
  };

  const handleSortChange = (sortBy: string) => {
    onFiltersChange({
      ...filters,
      sortBy: sortBy as EFilters['sortBy'],
    });
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search examples..."
          value={filters.search || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Industry Tabs */}
      <div>
        <Tabs
          value={filters.industry || 'all'}
          onValueChange={handleIndustryChange}
          className="w-full"
        >
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="all" className="flex-shrink-0">
              All Examples ({totalCount})
            </TabsTrigger>
            {exampleIndustries.map((industry) => (
              <TabsTrigger
                key={industry.value}
                value={industry.value}
                className="flex-shrink-0"
              >
                {industry.label} ({industry.count})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Complexity Filter */}
        <Select
          value={filters.complexity || 'all'}
          onValueChange={handleComplexityChange}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Complexity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort Filter */}
        <Select
          value={filters.sortBy || 'popular'}
          onValueChange={handleSortChange}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">Most Popular</SelectItem>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="alphabetical">Alphabetical</SelectItem>
          </SelectContent>
        </Select>

        {/* Active Filters Count */}
        {(filters.industry || filters.complexity || filters.search) && (
          <div className="flex items-center text-sm text-muted-foreground">
            <button
              onClick={() => onFiltersChange({ sortBy: 'popular' })}
              className="hover:text-foreground transition-colors underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
