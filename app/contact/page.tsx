'use client';

import { Header, Footer } from '@/components/layout';
import { PageHeader } from '@/components/marketing/PageHeader';
import { Section } from '@/components/marketing/Section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, MessageSquare, MapPin } from 'lucide-react';

import { motion } from 'framer-motion';

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />

            <PageHeader
                title="Get in Touch"
                subtitle="Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible."
                badge={{
                    text: "Contact Us",
                    icon: <Mail className="h-3 w-3" />
                }}
            />

            <Section>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Contact Form */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        viewport={{ once: true }}
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

                    {/* Contact Info */}
                    <motion.div
                        className="space-y-8"
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        viewport={{ once: true }}
                    >
                        <div>
                            <h3 className="text-2xl font-bold mb-6">Other ways to connect</h3>
                            <p className="text-muted-foreground mb-8">
                                Whether you have a question about features, trials, pricing, need a demo, or anything else, our team is ready to answer all your questions.
                            </p>
                        </div>

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
                    </motion.div>
                </div>
            </Section>

            <Footer />
        </div>
    );
}
