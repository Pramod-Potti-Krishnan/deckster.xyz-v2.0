import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Security & Compliance | Deckster',
    description: 'Learn about our commitment to security. SOC 2 Type II compliant, end-to-end encryption, and GDPR ready.',
};

export default function SecurityLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
