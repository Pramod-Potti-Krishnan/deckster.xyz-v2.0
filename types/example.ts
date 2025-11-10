export type ExampleIndustry =
  | 'technology'
  | 'marketing'
  | 'sales'
  | 'education'
  | 'analytics'
  | 'creative'
  | 'non-profit';

export type ExampleUseCase =
  | 'startup-pitch'
  | 'business-reporting'
  | 'strategy'
  | 'training'
  | 'academic'
  | 'portfolio'
  | 'data-reporting'
  | 'fundraising';

export type ExampleComplexity = 'basic' | 'intermediate' | 'advanced';

export type AgentType = 'director' | 'scripter' | 'graphic-artist' | 'data-visualizer';

export interface Example {
  id: string;
  title: string;
  description: string;
  story: string;
  industry: ExampleIndustry;
  useCase: ExampleUseCase;
  complexity: ExampleComplexity;
  slideCount: number;
  thumbnail: string;
  agents: AgentType[];
  featured?: boolean;
  tags: string[];
  createdAt: string;
  viewCount?: number;
}

export interface ExampleFilters {
  industry?: ExampleIndustry;
  useCase?: ExampleUseCase;
  complexity?: ExampleComplexity;
  search?: string;
  sortBy?: 'newest' | 'popular' | 'alphabetical';
}
