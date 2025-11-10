export type IntegrationCategory =
  | 'export'
  | 'storage'
  | 'communication'
  | 'content'
  | 'productivity';

export type IntegrationStatus = 'available' | 'coming-soon' | 'beta';

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  logo: string;
  features: string[];
  setupDifficulty: 'easy' | 'moderate' | 'advanced';
  documentation?: string;
  popular?: boolean;
}
