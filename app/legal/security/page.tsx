'use client';

import { Header, Footer } from '@/components/layout';
import { PageHeader } from '@/components/marketing/PageHeader';
import { Section } from '@/components/marketing/Section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, FileCheck, Server, Eye, Key } from 'lucide-react';
import { Metadata } from 'next';
import { motion } from 'framer-motion';
import { STUDIO_SECURITY_FACTS } from '@/content/studio-p2-docs-security';

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off; PROGRAM-1 lifted ruling 2 for this page on 23 Oct): with the flag on the page says only what is true today (content/studio-p2-docs-security.ts, the wording `uat` already carries): no SOC 2, GDPR, AWS, audit, MFA or security@ claim. Off: every word as before.
const STUDIO_P2_DOCS = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true';
const FACT_ICONS = { lock: Lock, filecheck: FileCheck, server: Server, key: Key };

export default function SecurityPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />

            <PageHeader
                title="Security & Compliance"
                subtitle={STUDIO_P2_DOCS ? STUDIO_SECURITY_FACTS.subtitle : "We maintain the highest standards of security to protect your data and privacy."}
                badge={{
                    text: "Trust Center",
                    icon: <Shield className="h-3 w-3" />
                }}
            />

            <Section>
                <div className={`grid grid-cols-1 md:grid-cols-2 ${STUDIO_P2_DOCS ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-8 mb-16`}>
                    {(STUDIO_P2_DOCS ? STUDIO_SECURITY_FACTS.cards.map((card) => ({ ...card, icon: FACT_ICONS[card.icon] })) : [
                        { icon: Shield, title: "SOC 2 Type II", desc: "We are SOC 2 Type II compliant, verifying that our security controls are effective and strictly followed.", color: "text-purple-600" },
                        { icon: Lock, title: "End-to-End Encryption", desc: "All data is encrypted in transit using TLS 1.2+ and at rest using AES-256 encryption standards.", color: "text-blue-600" },
                        { icon: FileCheck, title: "GDPR Compliant", desc: "We are fully compliant with GDPR regulations and provide tools to help you manage your data privacy.", color: "text-green-600" },
                        { icon: Server, title: "Secure Infrastructure", desc: "Hosted on AWS with multiple availability zones, automated backups, and 24/7 monitoring.", color: "text-orange-600" },
                        { icon: Eye, title: "Regular Audits", desc: "We conduct regular third-party penetration testing and security audits to identify vulnerabilities.", color: "text-pink-600" },
                        { icon: Key, title: "Access Controls", desc: "Strict role-based access controls (RBAC) and multi-factor authentication (MFA) for all internal access.", color: "text-indigo-600" }
                    ]).map((item, i) => (
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
                        {STUDIO_P2_DOCS ? STUDIO_SECURITY_FACTS.dataProtection : "Your data belongs to you. We do not use your private presentation content to train our general AI models without your explicit permission. Enterprise customers have the option for private, isolated model instances."}
                    </p>

                    <h2>Vulnerability Disclosure</h2>
                    <p>
                        {STUDIO_P2_DOCS ? STUDIO_SECURITY_FACTS.vulnerability : "We value the security community's help in keeping our platform safe. If you believe you've found a security vulnerability, please report it to security@deckster.xyz. We respond to all reports within 24 hours."}
                    </p>

                    <h2>{STUDIO_P2_DOCS ? STUDIO_SECURITY_FACTS.questionsHeading : "Compliance Certifications"}</h2>
                    <p>
                        {STUDIO_P2_DOCS ? STUDIO_SECURITY_FACTS.questions : "We maintain compliance with major industry standards to ensure your data is handled with the utmost care. You can request our latest compliance reports by contacting our sales team."}
                    </p>
                </motion.div>
            </Section>

            <Footer />
        </div>
    );
}
