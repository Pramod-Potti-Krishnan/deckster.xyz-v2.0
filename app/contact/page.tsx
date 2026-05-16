'use client';

import { Header, Footer } from '@/components/layout';
import { SnapDeck } from '@/components/marketing/SnapDeck/SnapDeck';
import { SlideNavArrows } from '@/components/marketing/SnapDeck/SlideNavArrows';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageSquare, MapPin } from 'lucide-react';

import { motion } from 'framer-motion';

export default function ContactPage() {
    return (
        <div className="flex min-h-screen flex-col bg-background font-sans">
            <SnapDeck />
            <SlideNavArrows />
            <Header />
            <main>
                {/* Slide 1: Hero + form */}
                <section
                    id="contact-hero"
                    data-snap="slide"
                    className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12"
                >
                    <div className="mx-auto w-full max-w-6xl">
                        <div className="mb-10 text-center">
                            <Badge variant="secondary" className="mb-4 inline-flex items-center gap-1.5">
                                <Mail className="h-3 w-3" />
                                Contact Us
                            </Badge>
                            <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
                                Get in Touch
                            </h1>
                            <p className="mx-auto mt-4 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                                Have questions? We&apos;d love to hear from you. Send us a message and we&apos;ll respond as soon as possible.
                            </p>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            viewport={{ once: true }}
                            className="mx-auto max-w-2xl"
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle>Send us a message</CardTitle>
                                    <CardDescription>
                                        Fill out the form below and our team will get back to you within 24 hours.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="first-name">First name</Label>
                                                <Input id="first-name" placeholder="John" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="last-name">Last name</Label>
                                                <Input id="last-name" placeholder="Doe" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <Input id="email" type="email" placeholder="john@example.com" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="subject">Subject</Label>
                                            <Input id="subject" placeholder="How can we help?" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="message">Message</Label>
                                            <Textarea
                                                id="message"
                                                placeholder="Tell us more about your project..."
                                                className="min-h-[150px]"
                                            />
                                        </div>
                                        <Button type="submit" className="w-full">
                                            Send Message
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </section>

                {/* Slide 2: Contact channels */}
                <section
                    id="contact-channels"
                    data-snap="slide"
                    className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12"
                >
                    <div className="mx-auto w-full max-w-4xl">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            viewport={{ once: true }}
                            className="mb-10 text-center"
                        >
                            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                                Other ways to connect
                            </h2>
                            <p className="mx-auto mt-4 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                                Whether you have a question about features, trials, pricing, need a demo, or anything else, our team is ready to answer all your questions.
                            </p>
                        </motion.div>

                        <div className="grid gap-6">
                            {[
                                { icon: Mail, title: "Email Support", desc: "For general inquiries and support", link: "support@deckster.xyz", color: "text-purple-600", border: "border-l-purple-600" },
                                { icon: MessageSquare, title: "Sales", desc: "For enterprise and high-volume inquiries", link: "sales@deckster.xyz", color: "text-blue-600", border: "border-l-blue-600" },
                                { icon: MapPin, title: "Office", desc: "123 AI Boulevard, San Francisco, CA 94105", link: null, color: "text-pink-600", border: "border-l-pink-600" }
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1, duration: 0.4 }}
                                    viewport={{ once: true }}
                                >
                                    <Card className={`border-l-4 ${item.border}`}>
                                        <CardContent className="pt-6">
                                            <div className="flex items-start gap-4">
                                                <item.icon className={`h-6 w-6 ${item.color} mt-1`} />
                                                <div>
                                                    <h4 className="font-semibold mb-1">{item.title}</h4>
                                                    <p className="text-sm text-muted-foreground mb-2">
                                                        {item.desc}
                                                    </p>
                                                    {item.link && (
                                                        <a href={`mailto:${item.link}`} className={`${item.color} hover:underline`}>
                                                            {item.link}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Slide 3: Closing CTA + compact footer */}
                <section
                    id="contact-cta"
                    data-snap="slide"
                    className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col"
                >
                    <div className="flex flex-1 items-center justify-center px-4 py-12">
                        <div className="mx-auto w-full max-w-3xl text-center">
                            <h2 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
                                We&apos;ll be in touch.
                            </h2>
                            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                                Send a note above or email us directly &mdash; expect a response within 24 hours.
                            </p>
                            <div className="mt-8 flex flex-wrap justify-center gap-3">
                                <Button asChild size="lg">
                                    <a href="mailto:support@deckster.xyz">Email support</a>
                                </Button>
                                <Button asChild size="lg" variant="outline">
                                    <a href="mailto:sales@deckster.xyz">Talk to sales</a>
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
