'use client';

import { cn } from '@/lib/utils';

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode;
    background?: 'default' | 'muted' | 'none';
    container?: boolean;
    width?: 'default' | 'narrow' | 'wide' | 'full';
}

export function Section({
    children,
    className,
    background = 'default',
    container = true,
    width = 'default',
    ...props
}: SectionProps) {
    const bgClasses = {
        default: 'bg-background',
        muted: 'bg-muted/30',
        none: '',
    };

    const widthClasses = {
        default: 'max-w-6xl',
        narrow: 'max-w-4xl',
        wide: 'max-w-7xl',
        full: 'max-w-full',
    };

    return (
        <section
            className={cn(
                'py-16 md:py-24',
                bgClasses[background],
                className
            )}
            {...props}
        >
            {container ? (
                <div className={cn("container mx-auto px-4", widthClasses[width])}>
                    {children}
                </div>
            ) : (
                children
            )}
        </section>
    );
}
