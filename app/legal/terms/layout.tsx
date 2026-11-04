import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): the tab names the page ("Terms of Service | Deckster"; it showed the site's default title). Off: no metadata here, as before.
export const metadata: Metadata = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' ? { title: 'Terms of Service' } : {};

export default function TermsLayout({ children }: { children: ReactNode }) {
  return children;
}
