export interface Competitor {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  logo?: string;
  color: {
    primary: string;
    secondary: string;
    gradient: string;
  };
  category: 'presentation-ai' | 'presentation-tool' | 'traditional';
  website: string;
  pricing: {
    starting: string;
    model: string;
  };
}

export interface ComparisonFeature {
  id: string;
  feature: string;
  deckster: ComparisonValue;
  competitor: ComparisonValue;
  category: 'core' | 'ai' | 'collaboration' | 'export' | 'pricing';
}

export interface ComparisonValue {
  value: string | boolean;
  description?: string;
  highlight?: boolean;
}

export interface ComparisonPage {
  competitor: Competitor;
  summary: {
    headline: string;
    subheadline: string;
    description: string;
  };
  keyDifferentiators: KeyDifferentiator[];
  featureComparison: ComparisonFeature[];
  useCaseComparisons: UseCaseComparison[];
  verdict: {
    title: string;
    description: string;
    bestFor: string[];
    decksterBestFor: string[];
  };
}

export interface KeyDifferentiator {
  id: string;
  title: string;
  description: string;
  icon: string;
  advantage: 'deckster' | 'competitor' | 'neutral';
}

export interface UseCaseComparison {
  id: string;
  useCase: string;
  decksterApproach: string;
  competitorApproach: string;
  winner: 'deckster' | 'competitor' | 'tie';
}
