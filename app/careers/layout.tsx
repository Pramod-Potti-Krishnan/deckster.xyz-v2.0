import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Careers | Deckster',
    description: 'Join our mission to democratize creativity with AI. View open positions and learn about our culture.',
};

export default function CareersLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
