import { Template, TemplateFilters, AgentType } from '@/types/template';
import { templates as baseTemplates } from '@/content/templates';
import { studioAgentId } from '@/lib/studio-p2-docs';

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): with the flag on the templates name the current agents (content-generator, slide-composer, visualizer) in place of scripter, graphic-artist and data-visualizer. Off: the content as it was, the same array.
const STUDIO_P2_DOCS = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true';
const templates: Template[] = STUDIO_P2_DOCS ? baseTemplates.map((template) => ({ ...template, agents: template.agents.map((agent) => studioAgentId(agent) as AgentType) })) : baseTemplates;

export function getAllTemplates(): Template[] {
  return templates;
}

export function getTemplateById(id: string): Template | undefined {
  return templates.find(t => t.id === id);
}

export function getFeaturedTemplates(): Template[] {
  return templates.filter(t => t.featured);
}

export function getPopularTemplates(): Template[] {
  return templates.filter(t => t.popular);
}

export function getNewTemplates(): Template[] {
  return templates.filter(t => t.new);
}

export function filterTemplates(filters: TemplateFilters): Template[] {
  let filtered = [...templates];

  // Filter by category
  if (filters.category) {
    filtered = filtered.filter(t => t.category === filters.category);
  }

  // Filter by complexity
  if (filters.complexity) {
    filtered = filtered.filter(t => t.complexity === filters.complexity);
  }

  // Filter by search query
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(t =>
      t.title.toLowerCase().includes(searchLower) ||
      t.description.toLowerCase().includes(searchLower) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }

  // Sort
  if (filters.sortBy) {
    switch (filters.sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'popular':
        filtered.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
        break;
      case 'alphabetical':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
  }

  return filtered;
}

export function getTemplatesByCategory(category: string): Template[] {
  return templates.filter(t => t.category === category);
}

export function searchTemplates(query: string): Template[] {
  const searchLower = query.toLowerCase();
  return templates.filter(t =>
    t.title.toLowerCase().includes(searchLower) ||
    t.description.toLowerCase().includes(searchLower) ||
    t.tags.some(tag => tag.toLowerCase().includes(searchLower))
  );
}
