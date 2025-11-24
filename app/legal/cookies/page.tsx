'use client';

import { Header, Footer } from '@/components/layout';
import { PageHeader } from "@/components/marketing/PageHeader"
import { Section } from "@/components/marketing/Section"

export default function CookiesPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <PageHeader
                title="Cookie Policy"
                subtitle="How we use cookies and similar technologies"
            />
            <Section>
                <div className="prose dark:prose-invert max-w-3xl mx-auto">
                    <p>Last updated: November 24, 2025</p>

                    <h3>1. What are cookies?</h3>
                    <p>
                        Cookies are small text files that are placed on your computer or mobile device when you visit a website.
                        They are widely used to make websites work more efficiently and provide information to the owners of the site.
                    </p>

                    <h3>2. How we use cookies</h3>
                    <p>
                        We use cookies to:
                    </p>
                    <ul>
                        <li>Keep you signed in</li>
                        <li>Remember your preferences</li>
                        <li>Analyze how our website is used</li>
                        <li>Personalize content and ads</li>
                    </ul>

                    <h3>3. Types of cookies we use</h3>
                    <p>
                        <strong>Essential Cookies:</strong> These are necessary for the website to function and cannot be switched off.
                    </p>
                    <p>
                        <strong>Performance Cookies:</strong> These allow us to count visits and traffic sources so we can measure and improve the performance of our site.
                    </p>
                    <p>
                        <strong>Functional Cookies:</strong> These enable the website to provide enhanced functionality and personalization.
                    </p>

                    <h3>4. Managing cookies</h3>
                    <p>
                        You can set your browser to refuse all or some browser cookies, or to alert you when websites set or access cookies.
                        If you disable or refuse cookies, please note that some parts of this website may become inaccessible or not function properly.
                    </p>
                </div>
            </Section>
            <Footer />
        </div>
    )
}
