import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Contact Us | Deckster',
    description: 'Get in touch with the Deckster team. Support, sales, and general inquiries.',
};

export default function ContactLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
