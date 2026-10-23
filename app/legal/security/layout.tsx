import { Metadata } from 'next';

export const metadata: Metadata = {
    // PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS): the root layout's title template already adds " | Deckster"; the tab read "Security & Compliance | Deckster | Deckster".
    title: process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' ? 'Security & Compliance' : 'Security & Compliance | Deckster',
    // PASS2 Docs (same flag; ruling 2 lifted for this page, 23 Oct): the description names no certification the product does not have. Off: as before.
    description: process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' ? 'How Deckster protects your data: encryption in transit, where it runs, Google sign-in, and how to report a vulnerability.' : 'Learn about our commitment to security. SOC 2 Type II compliant, end-to-end encryption, and GDPR ready.',
};

export default function SecurityLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
