'use client';

import { Header, Footer } from '@/components/layout';
import { PageHeader } from '@/components/marketing/PageHeader';
import { Section } from '@/components/marketing/Section';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';
import { motion } from 'framer-motion';

export default function BlogPage() {
    const posts = [
        {
            title: "The Future of AI in Presentation Design",
            excerpt: "How multi-agent systems are revolutionizing the way we create and deliver presentations.",
            date: "Nov 15, 2024",
            author: "Sarah Chen",
            category: "AI Technology",
            readTime: "5 min read",
            image: "bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20"
        },
        {
            title: "5 Tips for More Engaging Slides",
            excerpt: "Learn the secrets of professional designers to keep your audience glued to the screen.",
            date: "Nov 10, 2024",
            author: "Marcus Johnson",
            category: "Design",
            readTime: "4 min read",
            image: "bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20"
        },
        {
            title: "Introducing Deckster Enterprise",
            excerpt: "New security features, SSO, and team collaboration tools for large organizations.",
            date: "Nov 5, 2024",
            author: "Team Deckster",
            category: "Product Update",
            readTime: "3 min read",
            image: "bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900/20 dark:to-rose-900/20"
        },
        {
            title: "Why Storytelling Matters in Data Presentation",
            excerpt: "Don't just show numbers. Tell a story that drives action and decision making.",
            date: "Oct 28, 2024",
            author: "Emily Davis",
            category: "Data Visualization",
            readTime: "6 min read",
            image: "bg-gradient-to-br from-orange-100 to-yellow-100 dark:from-orange-900/20 dark:to-yellow-900/20"
        },
        {
            title: "Mastering the Art of the Pitch",
            excerpt: "A comprehensive guide to structuring your startup pitch deck for investors.",
            date: "Oct 20, 2024",
            author: "David Kim",
            category: "Business",
            readTime: "8 min read",
            image: "bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20"
        },
        {
            title: "How We Built Our Multi-Agent System",
            excerpt: "A technical deep dive into the architecture behind Deckster's AI agents.",
            date: "Oct 15, 2024",
            author: "Alex Rivera",
            category: "Engineering",
            readTime: "10 min read",
            image: "bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/20 dark:to-violet-900/20"
        }
    ];

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />

            <PageHeader
                title="Deckster Blog"
                subtitle="Insights, updates, and guides on presentation design and AI technology."
                badge={{
                    text: "Latest Updates",
                    icon: <Calendar className="h-3 w-3" />
                }}
            />

            <Section>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {posts.map((post, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                            viewport={{ once: true }}
                        >
                            <Card className="flex flex-col h-full hover:shadow-lg transition-shadow cursor-pointer group overflow-hidden border-2 hover:border-purple-200 dark:hover:border-purple-800">
                                <div className={`h-48 w-full ${post.image} transition-transform duration-500 group-hover:scale-105`} />
                                <CardHeader>
                                    <div className="flex justify-between items-center mb-2">
                                        <Badge variant="secondary" className="text-xs font-normal">
                                            {post.category}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">{post.readTime}</span>
                                    </div>
                                    <CardTitle className="group-hover:text-purple-600 transition-colors line-clamp-2">
                                        {post.title}
                                    </CardTitle>
                                    <CardDescription className="line-clamp-2">
                                        {post.excerpt}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="mt-auto">
                                    <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            <span>{post.author}</span>
                                        </div>
                                        <span>{post.date}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-16 text-center">
                    <Button variant="outline" size="lg">
                        Load More Articles
                    </Button>
                </div>
            </Section>

            <Section background="muted">
                <div className="text-center max-w-2xl mx-auto">
                    <h2 className="text-3xl font-bold mb-4">Subscribe to our newsletter</h2>
                    <p className="text-muted-foreground mb-8">
                        Get the latest insights and updates delivered straight to your inbox.
                    </p>
                    <div className="flex gap-2 max-w-md mx-auto">
                        <input
                            type="email"
                            placeholder="Enter your email"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <Button>Subscribe</Button>
                    </div>
                </div>
            </Section>

            <Footer />
        </div>
    );
}
