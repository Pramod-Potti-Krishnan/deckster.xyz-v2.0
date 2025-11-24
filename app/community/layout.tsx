import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Community | Deckster',
    description: 'Join the Deckster community. Connect with other creators, share templates, and get help.',
};

export default function CommunityLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
