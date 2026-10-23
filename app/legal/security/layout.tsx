import { Metadata } from 'next';

export const metadata: Metadata = {
    // PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS): the root layout's title template already adds " | Deckster"; the tab read "Security & Compliance | Deckster | Deckster".
    title: process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' ? 'Security & Compliance' : 'Security & Compliance | Deckster',
    description: 'Learn about our commitment to security. SOC 2 Type II compliant, end-to-end encryption, and GDPR ready.',
};

export default function SecurityLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
