import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Blog | Deckster',
    description: 'Insights, updates, and guides on presentation design, AI technology, and Deckster product news.',
};

export default function BlogLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
