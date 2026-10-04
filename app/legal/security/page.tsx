'use client';

import { Header, Footer } from '@/components/layout';
import { PageHeader } from '@/components/marketing/PageHeader';
import { Section } from '@/components/marketing/Section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, FileCheck, Server, Key } from 'lucide-react';
import { Metadata } from 'next';
import { motion } from 'framer-motion';

export default function SecurityPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />

            <PageHeader
                title="Security & Compliance"
                subtitle="How Deckster looks after your data today, and what is still planned."
                badge={{
                    text: "Trust Center",
                    icon: <Shield className="h-3 w-3" />
                }}
            />

            <Section>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
                    {[
                        { icon: Lock, title: "Encryption", desc: "Every connection, from your browser to Deckster and from Deckster to its services, uses HTTPS (TLS).", color: "text-blue-600" },
                        { icon: FileCheck, title: "Data Privacy", desc: "Your presentations are yours. Our Privacy Policy explains what we collect, how it is used, and how to contact us about your data.", color: "text-green-600" },
                        { icon: Server, title: "Where it runs", desc: "The web app runs on Vercel and the backend services on Railway.", color: "text-orange-600" },
                        { icon: Key, title: "Sign-in", desc: "You sign in with your Google account, so Deckster never sees or stores your password. Planned: multi-factor login for all internal team access.", color: "text-indigo-600" }
                    ].map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            viewport={{ once: true }}
                        >
                            <Card className="h-full">
                                <CardHeader>
                                    <item.icon className={`h-8 w-8 ${item.color} mb-2`} />
                                    <CardTitle>{item.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="text-muted-foreground">
                                    {item.desc}
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    className="max-w-3xl mx-auto prose dark:prose-invert"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    viewport={{ once: true }}
                >
                    <h2>Data Protection</h2>
                    <p>
                        Your data belongs to you. Files you upload are stored in your account and read by the AI models that build your deck (Google and OpenRouter-hosted models). They are never shown to your audience by name. You can delete your knowledge graph with one button; deleting a file removes it from your list.
                    </p>

                    <h2>Vulnerability Disclosure</h2>
                    <p>
                        We value the security community's help in keeping our platform safe. If you believe you've found a security vulnerability, please report it to security@deckster.xyz and we will get back to you.
                    </p>

                    <h2>Security Questions</h2>
                    <p>
                        Need to know how we handle your data, or have a question for a vendor review? Email security@deckster.xyz and we will get back to you.
                    </p>
                </motion.div>
            </Section>

            <Footer />
        </div>
    );
}
