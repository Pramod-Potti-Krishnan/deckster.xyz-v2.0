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

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS): the data keeps its old ids (scripter, graphic-artist, data-visualizer); with the flag on the card reads them as the current agents (lib/studio-p2-docs.ts, studioAgentId), whose ids are the three that follow.
export type AgentType = 'director' | 'scripter' | 'graphic-artist' | 'data-visualizer' | 'content-generator' | 'slide-composer' | 'visualizer';

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
