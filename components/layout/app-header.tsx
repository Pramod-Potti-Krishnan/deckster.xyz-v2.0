"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { lastBuilderSessionKey } from "@/lib/last-builder-session"
import { ArrowLeft, Brain, LayoutDashboard } from "lucide-react"

/**
 * Returns the user to their most recent builder session (if one is remembered),
 * otherwise opens a fresh builder. Reads localStorage inside the click handler so
 * there is no SSR/hydration concern.
 */
export function BackToBuilderButton() {
  const router = useRouter()
  const { user } = useAuth()

  const handleClick = () => {
    let target = "/builder"
    if (typeof window !== "undefined") {
      try {
        const userId = user?.id ?? user?.email
        const last = userId
          ? window.localStorage.getItem(lastBuilderSessionKey(userId))
          : null
        if (last) target = `/builder?session_id=${last}`
      } catch {
        // localStorage can throw (Safari private mode) — fall back to fresh builder
      }
    }
    router.push(target)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="text-slate-600 dark:text-slate-300"
      aria-label="Back to builder"
    >
      <ArrowLeft className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Back to builder</span>
    </Button>
  )
}

/**
 * Shared chrome for the authenticated account area (dashboard, settings, billing,
 * shortcuts). Logo → home, "Back to builder" → last session, profile menu → nav.
 * Rendered once by app/(app)/layout.tsx — pages inside the group must NOT render
 * their own header.
 */
export function AppHeader() {
  const pathname = usePathname()

  const navItems = [
    { href: "/dashboard", label: "Decks", icon: LayoutDashboard },
    { href: "/knowledge", label: "Knowledge", icon: Brain },
  ]

  return (
    <header className="sticky top-0 z-40 h-14 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-slate-800 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/85">
      <div className="flex h-full items-center px-4">
        <Link href="/" className="group flex items-center gap-0.5" aria-label="Deckster home">
          <img
            src="/logo-icon.png"
            alt=""
            aria-hidden
            className="h-10 w-auto transition-transform group-hover:scale-105"
          />
          <img
            src="/logo-wordmark.png"
            alt="Deckster"
            className="hidden h-8 w-auto transition-transform group-hover:scale-105 sm:block"
          />
        </Link>

        <nav className="ml-3 flex items-center gap-1 sm:ml-5" aria-label="Product navigation">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:px-3",
                  active
                    ? "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-200"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <BackToBuilderButton />
          <UserProfileMenu />
        </div>
      </div>
    </header>
  )
}
