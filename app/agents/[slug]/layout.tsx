import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getAgentBySlug } from '@/lib/agents';

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): the tab names the agent ("Director | Deckster"; it showed the site's default title). Off: no metadata here, as before.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (process.env.NEXT_PUBLIC_STUDIO_P2_DOCS !== 'true') return {};
  const { slug } = await params;
  const agent = getAgentBySlug(slug);
  return { title: agent ? agent.name : 'Agent not found' };
}

export default function AgentLayout({ children }: { children: ReactNode }) {
  return children;
}
