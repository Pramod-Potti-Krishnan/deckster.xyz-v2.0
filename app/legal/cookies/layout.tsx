import { Metadata } from 'next';

export const metadata: Metadata = {
    // PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS): the root layout's title template already adds " | Deckster"; the tab read "Cookie Policy | Deckster | Deckster".
    title: process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true' ? 'Cookie Policy' : 'Cookie Policy | Deckster',
    description: 'Learn how Deckster uses cookies to improve your experience.',
};

export default function CookiesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
