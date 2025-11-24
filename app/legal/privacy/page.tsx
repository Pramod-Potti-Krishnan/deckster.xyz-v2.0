'use client';

import { Header, Footer } from '@/components/layout';
import { PageHeader } from '@/components/marketing/PageHeader';
import { Section } from '@/components/marketing/Section';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <PageHeader title="Privacy Policy" subtitle="Last updated: November 2024" />
            <Section>
                <div className="prose dark:prose-invert max-w-3xl mx-auto">
                    <p className="lead">
                        At Deckster ("we", "our", or "us"), we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website deckster.xyz or use our application.
                    </p>

                    <h3>1. Information We Collect</h3>
                    <p>We collect information that you provide directly to us:</p>
                    <ul>
                        <li><strong>Account Information:</strong> When you register, we collect your name, email address, and password.</li>
                        <li><strong>Payment Information:</strong> If you purchase a subscription, our payment processor collects your payment details. We do not store full credit card numbers.</li>
                        <li><strong>User Content:</strong> We collect the presentations, text, images, and other content you create or upload to the Service.</li>
                        <li><strong>Communications:</strong> If you contact us, we collect the content of your messages.</li>
                    </ul>

                    <h3>2. How We Use Your Information</h3>
                    <p>We use the information we collect to:</p>
                    <ul>
                        <li>Provide, maintain, and improve our Service.</li>
                        <li>Process transactions and send related information, including confirmations and invoices.</li>
                        <li>Send you technical notices, updates, security alerts, and support messages.</li>
                        <li>Respond to your comments, questions, and requests.</li>
                        <li>Analyze trends, usage, and activities in connection with our Service.</li>
                    </ul>

                    <h3>3. Data Sharing and Disclosure</h3>
                    <p>We may share your information in the following circumstances:</p>
                    <ul>
                        <li><strong>With Service Providers:</strong> We share information with third-party vendors who provide services on our behalf (e.g., hosting, payment processing, customer support).</li>
                        <li><strong>Legal Requirements:</strong> We may disclose information if we believe it is required by law or to protect the rights and safety of Deckster or others.</li>
                        <li><strong>Business Transfers:</strong> If we are involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</li>
                    </ul>

                    <h3>4. Data Security</h3>
                    <p>
                        We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction. We use industry-standard encryption for data in transit and at rest.
                    </p>

                    <h3>5. Your Rights</h3>
                    <p>
                        Depending on your location, you may have certain rights regarding your personal information, such as the right to access, correct, or delete your data. You can manage your account settings within the application or contact us at privacy@deckster.xyz to exercise these rights.
                    </p>

                    <h3>6. Changes to this Policy</h3>
                    <p>
                        We may change this Privacy Policy from time to time. If we make changes, we will notify you by revising the date at the top of the policy and, in some cases, we may provide you with additional notice.
                    </p>

                    <h3>7. Contact Us</h3>
                    <p>
                        If you have any questions about this Privacy Policy, please contact us at privacy@deckster.xyz.
                    </p>
                </div>
            </Section>
            <Footer />
        </div>
    );
}
