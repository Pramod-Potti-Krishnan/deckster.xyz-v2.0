export type TemplateCategory =
  | 'business'
  | 'sales'
  | 'marketing'
  | 'startup'
  | 'education'
  | 'creative';

export type ComplexityLevel = 'basic' | 'intermediate' | 'advanced';

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS): the data keeps its old ids (scripter, graphic-artist, data-visualizer); with the flag on the card reads them as the current agents (lib/studio-p2-docs.ts, studioAgentId), whose ids are the three that follow.
export type AgentType = 'director' | 'scripter' | 'graphic-artist' | 'data-visualizer' | 'content-generator' | 'slide-composer' | 'visualizer';

export interface Template {
  id: string;
  title: string;
  description: string;
  category: TemplateCategory;
  complexity: ComplexityLevel;
  slideCount: number;
  thumbnail: string;
  agents: AgentType[];
  featured?: boolean;
  popular?: boolean;
  new?: boolean;
  tags: string[];
  createdAt: string;
}

export interface TemplateFilters {
  category?: TemplateCategory;
  complexity?: ComplexityLevel;
  search?: string;
  sortBy?: 'newest' | 'popular' | 'alphabetical';
}
