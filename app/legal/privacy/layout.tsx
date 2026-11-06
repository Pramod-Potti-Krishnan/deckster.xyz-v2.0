import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): the tab names the page ("Privacy Policy | Deckster"; it showed the site's default title). Off: no metadata here, as before.
export const metadata: Metadata = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' ? { title: 'Privacy Policy' } : {};

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children;
}
