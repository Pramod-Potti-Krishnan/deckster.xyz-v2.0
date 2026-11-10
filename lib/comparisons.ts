import { competitors, comparisonPages as baseComparisonPages, competitorsNavigation } from '@/content/comparisons';
import { STUDIO_COMPARISON_RULES } from '@/content/studio-p2-comparisons';
import { studioReword } from '@/lib/studio-p2-docs';
import { Competitor, ComparisonPage } from '@/types/comparison';

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): with the flag on the comparison pages name the current agents (content/studio-p2-comparisons.ts). Off: the content as it was, the same array.
const STUDIO_P2_DOCS = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true';
const comparisonPages: ComparisonPage[] = STUDIO_P2_DOCS ? studioReword(baseComparisonPages, STUDIO_COMPARISON_RULES) : baseComparisonPages;

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
