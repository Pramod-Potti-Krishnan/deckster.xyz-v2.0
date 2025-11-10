import { Example, ExampleFilters } from '@/types/example';
import { examples } from '@/content/examples';

export function getAllExamples(): Example[] {
  return examples;
}

export function getExampleById(id: string): Example | undefined {
  return examples.find(e => e.id === id);
}

export function getFeaturedExamples(): Example[] {
  return examples.filter(e => e.featured);
}

export function getPopularExamples(): Example[] {
  return examples.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 6);
}

export function filterExamples(filters: ExampleFilters): Example[] {
  let filtered = [...examples];

  // Filter by industry
  if (filters.industry) {
    filtered = filtered.filter(e => e.industry === filters.industry);
  }

  // Filter by use case
  if (filters.useCase) {
    filtered = filtered.filter(e => e.useCase === filters.useCase);
  }

  // Filter by complexity
  if (filters.complexity) {
    filtered = filtered.filter(e => e.complexity === filters.complexity);
  }

  // Filter by search query
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(e =>
      e.title.toLowerCase().includes(searchLower) ||
      e.description.toLowerCase().includes(searchLower) ||
      e.story.toLowerCase().includes(searchLower) ||
      e.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }

  // Sort
  if (filters.sortBy) {
    switch (filters.sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'popular':
        filtered.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        break;
      case 'alphabetical':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
  }

  return filtered;
}

export function getExamplesByIndustry(industry: string): Example[] {
  return examples.filter(e => e.industry === industry);
}

export function searchExamples(query: string): Example[] {
  const searchLower = query.toLowerCase();
  return examples.filter(e =>
    e.title.toLowerCase().includes(searchLower) ||
    e.description.toLowerCase().includes(searchLower) ||
    e.story.toLowerCase().includes(searchLower) ||
    e.tags.some(tag => tag.toLowerCase().includes(searchLower))
  );
}
