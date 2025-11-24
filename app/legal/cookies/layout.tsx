import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Cookie Policy | Deckster',
    description: 'Learn how Deckster uses cookies to improve your experience.',
};

export default function CookiesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
