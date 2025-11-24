'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    badge?: {
        text: string;
        icon?: React.ReactNode;
    };
    cta?: {
        text: string;
        href: string;
        variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link';
    };
    secondaryCta?: {
        text: string;
        href: string;
        variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link';
    };
    align?: 'center' | 'left';
    className?: string;
}

export function PageHeader({
    title,
    subtitle,
    badge,
    cta,
    secondaryCta,
    align = 'center',
    className,
}: PageHeaderProps) {
    return (
        <section className={cn(
            'relative py-16 md:py-24 border-b bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20',
            className
        )}>
            {/* Background Elements - Removed to match /compare standard */}

            <div className={cn('container mx-auto px-4 relative z-10', align === 'center' ? 'text-center' : 'text-left')}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className={cn('max-w-4xl', align === 'center' ? 'mx-auto' : '')}
                >
                    {badge && (
                        <Badge className="mb-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 px-4 py-1.5 text-sm shadow-sm">
                            {badge.icon && <span className="mr-2">{badge.icon}</span>}
                            {badge.text}
                        </Badge>
                    )}

                    <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-tight">
                        {title}
                    </h1>

                    {subtitle && (
                        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                            {subtitle}
                        </p>
                    )}

                    {(cta || secondaryCta) && (
                        <div className={cn('flex flex-col sm:flex-row gap-4', align === 'center' ? 'justify-center' : 'justify-start')}>
                            {cta && (
                                <Button
                                    size="lg"
                                    variant={cta.variant || 'default'}
                                    className="h-12 px-8 text-lg rounded-full"
                                    asChild
                                >
                                    <Link href={cta.href}>
                                        {cta.text}
                                        <ChevronRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            )}
                            {secondaryCta && (
                                <Button
                                    size="lg"
                                    variant={secondaryCta.variant || 'outline'}
                                    className="h-12 px-8 text-lg rounded-full"
                                    asChild
                                >
                                    <Link href={secondaryCta.href}>
                                        {secondaryCta.text}
                                    </Link>
                                </Button>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>
        </section>
    );
}
