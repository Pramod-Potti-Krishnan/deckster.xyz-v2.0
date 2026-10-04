import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'API Documentation',
    description: 'Integrate Deckster into your applications with our REST API.',
};

export default function ApiDocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
