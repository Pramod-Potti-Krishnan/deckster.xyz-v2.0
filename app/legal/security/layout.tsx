import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Security & Compliance',
    description: 'Learn about our commitment to security: encryption in transit and at rest, access controls, and how to report a vulnerability.',
};

export default function SecurityLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
