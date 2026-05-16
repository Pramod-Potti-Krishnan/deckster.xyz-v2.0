import type { Metadata } from 'next';

const TITLE = 'Learn to use Deckster';
const DESCRIPTION =
  'Examples, articles, guides, and an entry point to docs and the help center — everything you need to ship decks fast with Deckster.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/learn' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://deckster.xyz/learn',
    siteName: 'Deckster',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    creator: '@deckster',
  },
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
