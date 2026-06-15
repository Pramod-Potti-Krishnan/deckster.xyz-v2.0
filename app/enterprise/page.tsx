'use client';

import { Header, Footer } from '@/components/layout';
import { SnapDeck } from '@/components/marketing/SnapDeck/SnapDeck';
import { SlideNavArrows } from '@/components/marketing/SnapDeck/SlideNavArrows';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, Users, Building2, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const SECURITY_CARDS = [
  {
    icon: Shield,
    title: 'Bank-Grade Security',
    desc: 'SOC 2 Type II compliant, GDPR ready, and end-to-end encryption for all your data.',
    color: 'text-purple-600',
  },
  {
    icon: Lock,
    title: 'Advanced Control',
    desc: 'SSO (SAML/OIDC), granular role-based access control, and audit logs.',
    color: 'text-blue-600',
  },
  {
    icon: Users,
    title: 'Scalable Collaboration',
    desc: 'Unlimited workspaces, shared asset libraries, and team-wide templates.',
    color: 'text-pink-600',
  },
];

const ENTERPRISE_FEATURES = [
  'Dedicated Customer Success Manager',
  'Custom AI Model Fine-tuning',
  'Priority 24/7 Support',
  'SLA Guarantees',
  'Custom Invoicing & PO Support',
  'Onboarding & Training Sessions',
];

export default function EnterprisePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <SnapDeck />
      <SlideNavArrows />
      <Header />
      <main>
        {/* Slide 1: Hero */}
        <section
          id="enterprise-hero"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-4xl text-center">
            <Badge variant="secondary" className="mb-6 inline-flex items-center gap-1.5">
              <Building2 className="h-3 w-3" />
              Enterprise Ready
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              Roll out AI presentations across your org
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Secure, scalable, and collaborative. Empower your entire organization with the next generation of presentation tools.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/contact">Contact Sales</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/legal/security">View Security Docs</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Slide 2: Security */}
        <section
          id="enterprise-security"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-5xl">
            <div className="mb-12 text-center">
              <h2 className="text-balance text-3xl font-bold sm:text-4xl md:text-5xl">
                Built for Trust at Scale
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-muted-foreground">
                Security, compliance, and control your IT and security teams can sign off on.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {SECURITY_CARDS.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full border-2">
                    <CardHeader>
                      <feature.icon className={`mb-4 h-10 w-10 ${feature.color}`} />
                      <CardTitle>{feature.title}</CardTitle>
                      <CardDescription>{feature.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Slide 3: Enterprise Features */}
        <section
          id="enterprise-features"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <h2 className="mb-6 text-balance text-3xl font-bold sm:text-4xl md:text-5xl">
                Why Global Teams Choose Deckster
              </h2>
              <p className="mb-8 text-lg text-muted-foreground">
                We understand the unique challenges of large organizations. That&apos;s why we&apos;ve built specific features to help you scale.
              </p>

              <div className="space-y-4">
                {ENTERPRISE_FEATURES.map((feature, i) => (
                  <motion.div
                    key={feature}
                    className="flex items-center gap-3"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.3 }}
                    viewport={{ once: true }}
                  >
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
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
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-blue-500/20 blur-3xl" />
              <div className="relative rounded-2xl border bg-card p-8 shadow-2xl">
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b pb-4">
                    <div className="font-semibold">Enterprise Dashboard</div>
                    <div className="text-sm text-muted-foreground">Admin View</div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-24 w-full animate-pulse rounded-lg bg-muted/50" />
                    <div className="h-24 w-full animate-pulse rounded-lg bg-muted/50 delay-75" />
                    <div className="h-24 w-full animate-pulse rounded-lg bg-muted/50 delay-150" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Slide 4: CTA + compact footer */}
        <section
          id="enterprise-cta"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col"
        >
          <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-3xl text-center">
              <h2 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
                Ready to scale?
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                Join forward-thinking companies that are transforming how they communicate.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
                <Button size="lg" className="bg-purple-600 hover:bg-purple-700" asChild>
                  <Link href="/contact">Contact Sales</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/pricing">View Pricing</Link>
                </Button>
              </div>
            </div>
          </div>

          <Footer compact />
        </section>
      </main>
    </div>
  );
}
