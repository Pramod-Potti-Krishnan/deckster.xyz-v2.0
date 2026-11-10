'use client';

import { Header, Footer } from '@/components/layout';
import { PageHeader } from "@/components/marketing/PageHeader"
import { Section } from "@/components/marketing/Section"
import { Lock } from "lucide-react"

// UX honesty (no flag, FRONTEND-1 UX review): there is no public Deckster API yet (no key screen, no /v1 endpoint), so this page says so and lists no endpoints, no auth scheme and no rate limits.
export default function ApiDocsPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <PageHeader
                title="Deckster API"
                subtitle="API access is not open yet."
            />

            <Section>
                <div className="max-w-4xl mx-auto space-y-4" data-studio-api-not-open="true">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Lock className="h-6 w-6 text-muted-foreground" />
                        API access is not open yet
                    </h2>
                    <p className="text-muted-foreground">
                        There is no public API today: no API keys and no endpoints to call. Build and edit decks in the builder, and export them to PowerPoint or PDF.
                    </p>
                    <p className="text-muted-foreground">
                        If you need programmatic access, tell us what you would use it for at{" "}
                        <a href="mailto:support@deckster.xyz" className="underline underline-offset-2">support@deckster.xyz</a>.
                    </p>
                </div>
            </Section>
            <Footer />
        </div>
    )
}
