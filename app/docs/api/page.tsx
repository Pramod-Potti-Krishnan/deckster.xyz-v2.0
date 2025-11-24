'use client';

import { Header, Footer } from '@/components/layout';
import { PageHeader } from "@/components/marketing/PageHeader"
import { Section } from "@/components/marketing/Section"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Code, Key, Lock, Zap } from "lucide-react"

export default function ApiDocsPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <PageHeader
                title="Deckster API"
                subtitle="Build powerful presentation workflows with our API"
                badge={{ text: "v1.0 Beta", icon: <Zap className="h-3 w-3" /> }}
            />

            <Section>
                <div className="max-w-4xl mx-auto space-y-12">
                    {/* Authentication */}
                    <div>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Key className="h-6 w-6 text-yellow-500" />
                            Authentication
                        </h2>
                        <p className="text-muted-foreground mb-4">
                            Authenticate your requests using Bearer tokens. You can generate an API key in your dashboard settings.
                        </p>
                        <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                            Authorization: Bearer YOUR_API_KEY
                        </div>
                    </div>

                    {/* Endpoints */}
                    <div>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <Code className="h-6 w-6 text-blue-500" />
                            Core Endpoints
                        </h2>

                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <Badge>POST</Badge>
                                        <code className="text-sm font-bold">/v1/presentations/generate</code>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground mb-2">Generate a new presentation from a prompt.</p>
                                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                                        {`{
  "topic": "Q4 Marketing Strategy",
  "slides": 10,
  "style": "professional"
}`}
                                    </pre>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="secondary">GET</Badge>
                                        <code className="text-sm font-bold">/v1/presentations/{`{id}`}</code>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">Retrieve details of a specific presentation.</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Rate Limits */}
                    <div>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Lock className="h-6 w-6 text-red-500" />
                            Rate Limits
                        </h2>
                        <p className="text-muted-foreground">
                            The API is currently rate limited to 100 requests per minute for Pro plans and 1000 requests per minute for Enterprise plans.
                        </p>
                    </div>
                </div>
            </Section>
            <Footer />
        </div>
    )
}
