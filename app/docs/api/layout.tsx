import { Metadata } from 'next';

export const metadata: Metadata = {
    // PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS): the root layout's title template already adds " | Deckster"; the tab read "API Documentation | Deckster | Deckster".
    title: process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' ? 'API Documentation' : 'API Documentation | Deckster',
    description: 'Integrate Deckster into your applications with our REST API.',
};

export default function ApiDocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
