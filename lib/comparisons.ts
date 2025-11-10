import { competitors, comparisonPages, competitorsNavigation } from '@/content/comparisons';
import { Competitor, ComparisonPage } from '@/types/comparison';

export function getAllCompetitors(): Competitor[] {
  return competitors;
}

export function getCompetitorBySlug(slug: string): Competitor | undefined {
  return competitors.find(comp => comp.slug === slug);
}

export function getComparisonBySlug(slug: string): ComparisonPage | undefined {
  return comparisonPages.find(page => page.competitor.slug === slug);
}

export function getCompetitorsNavigation() {
  return competitorsNavigation;
}

export function getRelatedCompetitors(currentSlug: string, limit: number = 3): Competitor[] {
  return competitors
    .filter(comp => comp.slug !== currentSlug)
    .slice(0, limit);
}
