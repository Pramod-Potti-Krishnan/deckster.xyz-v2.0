import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getDocBySlug } from '@/lib/docs';

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): the tab names the article ("Quick Start Guide | Deckster"; it showed the site's default title). Off: no metadata here, as before.
export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  if (process.env.NEXT_PUBLIC_STUDIO_P2_DOCS !== 'true') return {};
  const { category, slug } = await params;
  const doc = getDocBySlug(category, slug);
  return { title: doc ? doc.title : 'Article not found' };
}

export default function DocArticleLayout({ children }: { children: ReactNode }) {
  return children;
}
