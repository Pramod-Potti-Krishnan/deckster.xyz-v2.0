import type { ReactNode } from 'react';
import { StudioDocsFrame } from '@/components/studio-docs/studio-p2-docs-frame';

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): the agent pages (/agents/<agent>; /agents itself redirects to /experts) take the Studio shell's tokens inside one marker element. Off: this layout hands the pages through untouched.
export default function AgentsLayout({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true') return <StudioDocsFrame area="agents">{children}</StudioDocsFrame>;
  return children;
}
