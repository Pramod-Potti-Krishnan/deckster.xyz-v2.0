"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { lastBuilderSessionKey } from "@/lib/last-builder-session"
import { ArrowLeft, Brain, LayoutDashboard, Layers } from "lucide-react"
import { StudioNavigationHint } from "@/components/layout/studio-navigation-hint"
import { studioNavLabels } from "@/lib/studio-nav-labels"
import "./studio-library-back.css"
import "./studio-p2-library-shell.css"
import { Plus } from "lucide-react"
import { NEW_PRESENTATION_HREF, STUDIO_P2_LIBRARY_SHELL_ENABLED as p2Shell, showsNewPresentation } from "@/lib/studio-p2-library-shell"

/**
 * PASS2B G45 (NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK, default off): the library pages, i.e. the Studio rail's destinations besides Studio itself, by the same
 * exact paths the Studio top bar below titles them by ("Your details" has two routes). Settings, billing and the rest keep the plain "Account" bar.
 */
const STUDIO_LIBRARY_BACK_PATHS = ["/dashboard", "/knowledge", "/studio/templates", "/studio/themes", "/studio/intelligence", "/studio/details", "/profile"]

/**
 * Returns the user to their most recent builder session (if one is remembered),
 * otherwise opens a fresh builder. Reads localStorage inside the click handler so
 * there is no SSR/hydration concern.
 */
export function BackToBuilderButton({ rail = false, label }: { rail?: boolean; label?: string } = {}) {
  const router = useRouter()
  const { user } = useAuth()
  const studioLabels = process.env.NEXT_PUBLIC_STUDIO_V4_LABELS === "true"
  // PASS2B G45: the Studio top bar names it itself (`label`); every other use passes none and keeps the words it had.
  const returnLabel = label ?? (rail ? "Studio" : studioLabels ? "Back to Studio" : "Back to builder")

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
    <StudioNavigationHint enabled={rail || studioLabels} label={returnLabel}>
      <Button
        data-studio-v4-account-return="true"
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className="text-slate-600 dark:text-slate-300"
        aria-label={returnLabel}
      >
        {rail ? <Layers className="h-5 w-5" /> : <><ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{returnLabel}</span></>}
      </Button>
    </StudioNavigationHint>
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
  const studioLabels = process.env.NEXT_PUBLIC_STUDIO_V4_LABELS === "true"

  // PASS2B G43 (NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS, default off): the top bar title of /dashboard and /knowledge, as the rail names them.
  const navLabels = studioNavLabels(process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS === "true")

  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true") {
    // PASS2B G45 (NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK, default off): "Back to Studio" at the right of the library pages' top bar, the existing
    // return button (last builder session, else a fresh builder). Null with the flag off, and on every other route.
    const libraryBack = process.env.NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK === "true" && STUDIO_LIBRARY_BACK_PATHS.includes(pathname) ? <div data-studio-library-back="true"><BackToBuilderButton label="Back to Studio" /></div> : null
    return <header data-studio-v4-shell-header="true"><div className="flex h-full items-center"><span className="text-sm font-semibold">{pathname === "/dashboard" ? navLabels.decks : pathname === "/knowledge" ? navLabels.knowledge : pathname === "/profile" || pathname === "/studio/details" ? "Your details" : pathname === "/studio/templates" ? "Templates" : pathname === "/studio/themes" ? "Themes & brand" : pathname === "/studio/intelligence" ? "Intelligence" : "Account"}</span>{libraryBack}{showsNewPresentation(p2Shell, pathname, STUDIO_LIBRARY_BACK_PATHS) && <Link data-studio-p2-new-deck="true" href={NEW_PRESENTATION_HREF}><Plus aria-hidden="true" />Presentation</Link>}</div></header>
  }

  const navItems = [
    { href: "/dashboard", label: "Decks", icon: LayoutDashboard },
    { href: "/knowledge", label: "Knowledge", icon: Brain },
  ]

  return (
    <header data-studio-v4-account-header="true" className="sticky top-0 z-40 h-14 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-slate-800 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/85">
      <div className="flex h-full items-center px-4">
        <StudioNavigationHint enabled={studioLabels} label="Home">
          <Link data-studio-v4-account-home="true" href="/" className="group flex items-center gap-0.5" aria-label="Deckster home">
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
        </StudioNavigationHint>

        <nav className="ml-3 flex items-center gap-1 sm:ml-5" aria-label="Product navigation">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <StudioNavigationHint key={item.href} enabled={studioLabels} label={item.label}>
                <Link
                  data-studio-v4-account-nav="true"
                  aria-label={studioLabels ? item.label : undefined}
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
              </StudioNavigationHint>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <BackToBuilderButton />
          <UserProfileMenu studioLabels={studioLabels} studioPalette={process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS === "true"} />
        </div>
      </div>
    </header>
  )
}
