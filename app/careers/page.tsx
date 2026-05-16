'use client';

import Link from 'next/link';
import { Header, Footer } from '@/components/layout';
import { SnapDeck } from '@/components/marketing/SnapDeck/SnapDeck';
import { SlideNavArrows } from '@/components/marketing/SnapDeck/SlideNavArrows';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Rocket, Heart, Globe, Zap } from 'lucide-react';

import { motion } from 'framer-motion';

export default function CareersPage() {
    return (
        <div className="flex min-h-screen flex-col bg-background font-sans">
            <SnapDeck />
            <SlideNavArrows />
            <Header />
            <main>
                {/* Slide 1: Hero */}
                <section
                    id="careers-hero"
                    data-snap="slide"
                    className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12"
                >
                    <div className="mx-auto w-full max-w-3xl text-center">
                        <Badge variant="secondary" className="mb-4 inline-flex items-center gap-1.5">
                            <Rocket className="h-3 w-3" />
                            We&apos;re Hiring
                        </Badge>
                        <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
                            Join Our Mission
                        </h1>
                        <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                            We&apos;re building the future of presentation design. Come help us democratize creativity with AI.
                        </p>
                    </div>
                </section>

                {/* Slide 2: Why work here */}
                <section
                    id="careers-why"
                    data-snap="slide"
                    className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12"
                >
                    <div className="mx-auto w-full max-w-6xl">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            viewport={{ once: true }}
                            className="mb-10 text-center"
                        >
                            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                                Why work here
                            </h2>
                            <p className="mx-auto mt-4 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                                A small team, a big mission, and the kind of culture that makes hard work feel worthwhile.
                            </p>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                { icon: Heart, title: "People First", desc: "We believe in a healthy work-life balance, competitive compensation, and a supportive culture.", color: "text-purple-600", bg: "from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20" },
                                { icon: Globe, title: "Remote Friendly", desc: "Work from anywhere. We are a distributed team with members across the globe.", color: "text-blue-600", bg: "from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20" },
                                { icon: Zap, title: "High Impact", desc: "Join a fast-paced startup where your work directly shapes the product and user experience.", color: "text-pink-600", bg: "from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20" }
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1, duration: 0.5 }}
                                    viewport={{ once: true }}
                                >
                                    <Card className={`bg-gradient-to-br ${item.bg} border-none h-full`}>
                                        <CardHeader>
                                            <item.icon className={`h-8 w-8 ${item.color} mb-2`} />
                                            <CardTitle>{item.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {item.desc}
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Slide 3: Open roles */}
                <section
                    id="careers-roles"
                    data-snap="slide"
                    className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12"
                >
                    <div className="mx-auto w-full max-w-4xl">
                        <motion.h2
                            className="text-balance text-3xl font-bold tracking-tight text-center sm:text-4xl md:text-5xl mb-10"
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                        >
                            Open Positions
                        </motion.h2>

                        <div className="space-y-4">
                            {[
                                { title: "Senior Frontend Engineer", dept: "Engineering", loc: "Remote", type: "Full-time" },
                                { title: "AI Research Scientist", dept: "AI / ML", loc: "San Francisco / Remote", type: "Full-time" },
                                { title: "Product Designer", dept: "Design", loc: "Remote", type: "Full-time" },
                                { title: "Developer Advocate", dept: "Marketing", loc: "Remote", type: "Full-time" },
                            ].map((job, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1, duration: 0.4 }}
                                    viewport={{ once: true }}
                                >
                                    <Card className="hover:border-purple-500 transition-colors cursor-pointer group">
                                        <CardContent className="p-6 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-lg group-hover:text-purple-600 transition-colors">{job.title}</h3>
                                                <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                                                    <span>{job.dept}</span>
                                                    <span>•</span>
                                                    <span>{job.loc}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <Badge variant="secondary">{job.type}</Badge>
                                                <Button variant="ghost" size="sm">Apply &rarr;</Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Slide 4: CTA + compact footer */}
                <section
                    id="careers-cta"
                    data-snap="slide"
                    className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col"
                >
                    <div className="flex flex-1 items-center justify-center px-4 py-12">
                        <div className="mx-auto w-full max-w-3xl text-center">
                            <h2 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
                                Don&apos;t see your role?
                            </h2>
                            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                                We&apos;re always looking for exceptional people. Tell us about yourself and what you&apos;d like to build.
                            </p>
                            <div className="mt-8 flex justify-center">
                                <Button asChild size="lg">
                                    <Link href="/contact">Get in touch</Link>
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
