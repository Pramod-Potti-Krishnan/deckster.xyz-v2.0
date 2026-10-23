import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StudioDocsFrame } from '@/components/studio-docs/studio-p2-docs-frame';

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): /docs, /docs/api and the articles take the Studio shell's tokens inside one marker element. Off: this layout hands the pages through untouched.
// The index's tab ("Documentation | Deckster"; it showed the site's default title). The template is repeated so the articles and the API page below keep the site's " | Deckster" suffix (a plain string title here would drop it). Off: no metadata here, as before.
export const metadata: Metadata = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' ? { title: { default: 'Documentation | Deckster', template: '%s | Deckster' }, description: 'Guides and answers for turning your ideas into finished slides' } : {};

export default function DocsLayout({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true') return <StudioDocsFrame area="docs">{children}</StudioDocsFrame>;
  return children;
}
