import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Enterprise | Deckster',
    description: 'Secure, scalable AI presentation platform for large organizations. SOC 2 compliant, SSO, and dedicated support.',
};

export default function EnterpriseLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
