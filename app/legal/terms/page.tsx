'use client';

import { Header, Footer } from '@/components/layout';
import { PageHeader } from '@/components/marketing/PageHeader';
import { Section } from '@/components/marketing/Section';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <PageHeader title="Terms of Service" subtitle="Last updated: November 2024" />
            <Section>
                <div className="prose dark:prose-invert max-w-3xl mx-auto">
                    <p className="lead">
                        Please read these Terms of Service ("Terms") carefully before using the Deckster website and application operated by Deckster Inc.
                    </p>

                    <h3>1. Acceptance of Terms</h3>
                    <p>
                        By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.
                    </p>

                    <h3>2. Accounts</h3>
                    <p>
                        When you create an account with us, you must provide us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
                    </p>
                    <p>
                        You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password.
                    </p>

                    <h3>3. Intellectual Property</h3>
                    <p>
                        The Service and its original content (excluding Content provided by users), features, and functionality are and will remain the exclusive property of Deckster Inc. and its licensors. The Service is protected by copyright, trademark, and other laws.
                    </p>
                    <p>
                        You retain all rights to the presentations and content you create using Deckster. By using the Service, you grant us a license to host, store, and display your content solely as required to provide the Service to you.
                    </p>

                    <h3>4. Acceptable Use</h3>
                    <p>You agree not to use the Service to:</p>
                    <ul>
                        <li>Violate any laws or regulations.</li>
                        <li>Infringe upon the rights of others.</li>
                        <li>Distribute malware or viruses.</li>
                        <li>Interfere with or disrupt the integrity or performance of the Service.</li>
                    </ul>

                    <h3>5. Termination</h3>
                    <p>
                        We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                    </p>

                    <h3>6. Limitation of Liability</h3>
                    <p>
                        In no event shall Deckster Inc., nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
                    </p>

                    <h3>7. Governing Law</h3>
                    <p>
                        These Terms shall be governed and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
                    </p>

                    <h3>8. Changes</h3>
                    <p>
                        We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days notice prior to any new terms taking effect.
                    </p>

                    <h3>9. Contact Us</h3>
                    <p>
                        If you have any questions about these Terms, please contact us at support@deckster.xyz.
                    </p>
                </div>
            </Section>
            <Footer />
        </div>
    );
}
