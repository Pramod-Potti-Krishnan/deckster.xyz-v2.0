import { agents, agentsNavigation } from '@/content/agents';
import { Agent } from '@/types/agents';

export function getAllAgents(): Agent[] {
  return agents;
}

export function getAgentBySlug(slug: string): Agent | undefined {
  return agents.find(agent => agent.slug === slug);
}

export function getAgentsNavigation() {
  return agentsNavigation;
}

export function getRelatedAgents(currentAgent: Agent, limit: number = 3): Agent[] {
  return agents
    .filter(agent => agent.id !== currentAgent.id)
    .slice(0, limit);
}
