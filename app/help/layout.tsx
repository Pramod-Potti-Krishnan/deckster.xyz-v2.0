import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Help Center | Deckster',
    description: 'Get help with Deckster. Browse guides, FAQs, and contact our support team.',
};

export default function HelpLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
