'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { UserProfileMenu } from '@/components/user-profile-menu';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { name: 'Meet the Team', href: '/agents' },
  { name: 'How We Compare', href: '/compare' },
  { name: 'Learn to Use', href: '/learn' },
  { name: 'Start Your Journey', href: '/pricing' },
] as const;

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto px-4">
        <div className="flex h-12 items-center justify-between">
          {/* Logo — icon + wordmark as two separate elements */}
          <div className="flex items-center">
            <Link href="/" className="group flex items-center gap-2">
              <img
                src="/logo-icon.png"
                alt=""
                aria-hidden
                className="h-10 w-auto transition-transform group-hover:scale-105"
              />
              <img
                src="/logo-wordmark.png"
                alt="Deckster"
                className="h-8 w-auto transition-transform group-hover:scale-105"
              />
            </Link>
          </div>

          {/* Desktop Navigation — 4 flat invitation phrases, no dropdowns */}
          <div className="hidden md:flex md:items-center md:space-x-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors',
                  'hover:bg-accent hover:text-foreground',
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* CTA Buttons / User Profile */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {isLoading ? (
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
            ) : session ? (
              <UserProfileMenu />
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/auth/signin">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/auth/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu — 4 flat links mirroring desktop */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t">
            <div className="space-y-1 px-2 pb-3 pt-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}

              {/* Mobile CTA / Profile */}
              <div className="mt-4 flex flex-col space-y-2 px-3">
                {isLoading ? (
                  <div className="h-10 animate-pulse rounded-md bg-muted" />
                ) : session ? (
                  <div className="py-2">
                    <UserProfileMenu />
                  </div>
                ) : (
                  <>
                    <Button variant="ghost" asChild className="w-full">
                      <Link href="/auth/signin">Sign In</Link>
                    </Button>
                    <Button asChild className="w-full">
                      <Link href="/auth/signup">Get Started</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
