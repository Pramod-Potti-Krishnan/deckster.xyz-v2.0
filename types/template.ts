export type TemplateCategory =
  | 'business'
  | 'sales'
  | 'marketing'
  | 'startup'
  | 'education'
  | 'creative';

export type ComplexityLevel = 'basic' | 'intermediate' | 'advanced';

export type AgentType = 'director' | 'scripter' | 'graphic-artist' | 'data-visualizer';

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
