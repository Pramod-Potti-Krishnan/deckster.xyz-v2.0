import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Security & Compliance',
    description: 'How Deckster protects your data: encryption in transit, where it runs, Google sign-in, and how to report a vulnerability.',
};

export default function SecurityLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
