'use client';

import { Header, Footer } from '@/components/layout';
import { PageHeader } from "@/components/marketing/PageHeader"
import { Section } from "@/components/marketing/Section"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquare, Github, Twitter, Users } from "lucide-react"
import Link from "next/link"

export default function CommunityPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <PageHeader
                title="Join the Community"
                subtitle="Connect with thousands of presentation creators"
            />

            <Section>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-6 w-6 text-purple-600" />
                                Discord Server
                            </CardTitle>
                            <CardDescription>
                                Chat with other users, share your work, and get real-time help from the team.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button className="w-full" asChild>
                                <Link href="https://discord.gg/deckster" target="_blank">Join Discord</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Github className="h-6 w-6 text-gray-900 dark:text-white" />
                                GitHub
                            </CardTitle>
                            <CardDescription>
                                Report bugs, request features, and contribute to our open-source components.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" className="w-full" asChild>
                                <Link href="https://github.com/deckster" target="_blank">View on GitHub</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Twitter className="h-6 w-6 text-blue-400" />
                                Twitter / X
                            </CardTitle>
                            <CardDescription>
                                Follow us for the latest updates, tips, and design inspiration.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" className="w-full" asChild>
                                <Link href="https://twitter.com/deckster" target="_blank">Follow @deckster</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-6 w-6 text-green-600" />
                                Template Gallery
                            </CardTitle>
                            <CardDescription>
                                Browse and remix presentations created by the community.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" className="w-full" asChild>
                                <Link href="/templates">Explore Templates</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </Section>
            <Footer />
        </div>
    )
}
