import { Integration, IntegrationCategory, IntegrationStatus } from '@/types/integration';
import { integrations } from '@/content/integrations';

export function getAllIntegrations(): Integration[] {
  return integrations;
}

export function getIntegrationById(id: string): Integration | undefined {
  return integrations.find(i => i.id === id);
}

export function getIntegrationsByCategory(category: IntegrationCategory): Integration[] {
  return integrations.filter(i => i.category === category);
}

export function getIntegrationsByStatus(status: IntegrationStatus): Integration[] {
  return integrations.filter(i => i.status === status);
}

export function getAvailableIntegrations(): Integration[] {
  return integrations.filter(i => i.status === 'available');
}

export function getPopularIntegrations(): Integration[] {
  return integrations.filter(i => i.popular);
}

export function searchIntegrations(query: string): Integration[] {
  const searchLower = query.toLowerCase();
  return integrations.filter(i =>
    i.name.toLowerCase().includes(searchLower) ||
    i.description.toLowerCase().includes(searchLower) ||
    i.features.some(f => f.toLowerCase().includes(searchLower))
  );
}
