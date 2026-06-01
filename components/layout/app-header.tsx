"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { ArrowLeft } from "lucide-react"

/** localStorage key the builder writes its active session id to. */
export const LAST_SESSION_KEY = "deckster:last_session_id"

/**
 * Returns the user to their most recent builder session (if one is remembered),
 * otherwise opens a fresh builder. Reads localStorage inside the click handler so
 * there is no SSR/hydration concern.
 */
export function BackToBuilderButton() {
  const router = useRouter()

  const handleClick = () => {
    let target = "/builder"
    if (typeof window !== "undefined") {
      try {
        const last = window.localStorage.getItem(LAST_SESSION_KEY)
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
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back to builder
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
  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/80">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
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

        <div className="flex items-center gap-1 sm:gap-2">
          <BackToBuilderButton />
          <UserProfileMenu />
        </div>
      </div>
    </header>
  )
}
