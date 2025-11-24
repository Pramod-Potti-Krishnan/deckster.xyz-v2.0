'use client';

import { Header, Footer } from '@/components/layout';
import { PageHeader } from '@/components/marketing/PageHeader';
import { Section } from '@/components/marketing/Section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, Users, Zap, Building2, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';
import { motion } from 'framer-motion';

export default function EnterprisePage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />

            <PageHeader
                title="Enterprise-Grade AI Presentation Platform"
                subtitle="Secure, scalable, and collaborative. Empower your entire organization with the next generation of presentation tools."
                badge={{
                    text: "Enterprise Ready",
                    icon: <Building2 className="h-3 w-3" />
                }}
                cta={{
                    text: "Contact Sales",
                    href: "/contact",
                    variant: "default"
                }}
                secondaryCta={{
                    text: "View Security Docs",
                    href: "/legal/security",
                    variant: "outline"
                }}
            />

            <Section>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
                    {[
                        { icon: Shield, title: "Bank-Grade Security", desc: "SOC 2 Type II compliant, GDPR ready, and end-to-end encryption for all your data.", color: "text-purple-600" },
                        { icon: Lock, title: "Advanced Control", desc: "SSO (SAML/OIDC), granular role-based access control, and audit logs.", color: "text-blue-600" },
                        { icon: Users, title: "Scalable Collaboration", desc: "Unlimited workspaces, shared asset libraries, and team-wide templates.", color: "text-pink-600" }
                    ].map((feature, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            viewport={{ once: true }}
                        >
                            <Card className="border-2 h-full">
                                <CardHeader>
                                    <feature.icon className={`h-10 w-10 ${feature.color} mb-4`} />
                                    <CardTitle>{feature.title}</CardTitle>
                                    <CardDescription>{feature.desc}</CardDescription>
                                </CardHeader>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-6">
                            Why Global Teams Choose Deckster
                        </h2>
                        <p className="text-lg text-muted-foreground mb-8">
                            We understand the unique challenges of large organizations. That's why we've built specific features to help you scale.
                        </p>

                        <div className="space-y-4">
                            {[
                                "Dedicated Customer Success Manager",
                                "Custom AI Model Fine-tuning",
                                "Priority 24/7 Support",
                                "SLA Guarantees",
                                "Custom Invoicing & PO Support",
                                "Onboarding & Training Sessions"
                            ].map((feature, i) => (
                                <motion.div
                                    key={i}
                                    className="flex items-center gap-3"
                                    initial={{ opacity: 0, x: -10 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1, duration: 0.3 }}
                                    viewport={{ once: true }}
                                >
                                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                                    <span className="font-medium">{feature}</span>
                                </motion.div>
                            ))}
                        </div>

                        <div className="mt-8">
                            <Button size="lg" asChild>
                                <Link href="/contact">
                                    Schedule a Demo
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </motion.div>

                    <motion.div
                        className="relative"
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        viewport={{ once: true }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-blue-500/20 rounded-2xl blur-3xl" />
                        <div className="relative bg-card border rounded-2xl p-8 shadow-2xl">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b pb-4">
                                    <div className="font-semibold">Enterprise Dashboard</div>
                                    <div className="text-sm text-muted-foreground">Admin View</div>
                                </div>
                                <div className="space-y-4">
                                    <div className="h-24 bg-muted/50 rounded-lg w-full animate-pulse" />
                                    <div className="h-24 bg-muted/50 rounded-lg w-full animate-pulse delay-75" />
                                    <div className="h-24 bg-muted/50 rounded-lg w-full animate-pulse delay-150" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </Section>

            <Section background="muted">
                <div className="text-center max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold mb-6">Ready to scale?</h2>
                    <p className="text-lg text-muted-foreground mb-8">
                        Join forward-thinking companies that are transforming how they communicate.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button size="lg" className="bg-purple-600 hover:bg-purple-700" asChild>
                            <Link href="/contact">Contact Sales</Link>
                        </Button>
                        <Button size="lg" variant="outline" asChild>
                            <Link href="/pricing">View Pricing</Link>
                        </Button>
                    </div>
                </div>
            </Section>

            <Footer />
        </div>
    );
}
