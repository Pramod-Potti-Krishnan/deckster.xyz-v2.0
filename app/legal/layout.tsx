import type { ReactNode } from 'react';
import { StudioDocsFrame } from '@/components/studio-docs/studio-p2-docs-frame';

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): the four legal pages take the Studio shell's tokens inside one marker element; their words are not touched. Off: this layout hands the pages through untouched.
export default function LegalLayout({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true') return <StudioDocsFrame area="legal">{children}</StudioDocsFrame>;
  return children;
}
