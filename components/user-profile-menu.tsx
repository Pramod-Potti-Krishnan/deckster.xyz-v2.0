"use client"

import { useCallback, useEffect, useLayoutEffect, useState, useRef, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useStudioAboutReplay } from "@/components/builder/studio-introduction"
import { StudioAboutDialog } from "@/components/studio-about-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  Moon,
  Sun,
  HelpCircle,
  Info,
  LogOut,
  LayoutDashboard,
  Brain,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Clock,
} from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { StudioNavigationHint } from "@/components/layout/studio-navigation-hint"
import "./user-profile-studio-v4.css"

// ---------------------------------------------------------------------------
// Inline quota bar — shows daily + weekly remaining % as thin progress bars
// ---------------------------------------------------------------------------

interface QuotaSnapshot {
  tierLabel: string
  remainingPct: { daily: number; weekly: number }
  flags: { dailyNear: boolean; dailyAt: boolean; weeklyNear: boolean; weeklyAt: boolean }
  resetAt?: { daily: string; weekly: string }
  caps?: { dailyCents: number; weeklyCents: number }
  spent?: { dailyCents: number; weeklyCents: number }
}

function readQuotaSnapshot(data: unknown): QuotaSnapshot | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  const value = data as Partial<QuotaSnapshot>
  if (typeof value.tierLabel !== "string" || !value.tierLabel.trim() ||
    !value.remainingPct || !Number.isFinite(value.remainingPct.daily) || !Number.isFinite(value.remainingPct.weekly) ||
    !value.flags || [value.flags.dailyNear, value.flags.dailyAt, value.flags.weeklyNear, value.flags.weeklyAt].some(flag => typeof flag !== "boolean")) return null
  if (value.resetAt !== undefined && (!value.resetAt || typeof value.resetAt.daily !== "string" || typeof value.resetAt.weekly !== "string")) return null
  return { tierLabel: value.tierLabel, remainingPct: value.remainingPct, flags: value.flags,
    resetAt: value.resetAt, caps: value.caps, spent: value.spent }
}

function formatResetTime(isoString: string): string {
  const d = new Date(isoString)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffH = Math.round(diffMs / (1000 * 60 * 60))
  if (diffH <= 24) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

function formatRemainingTime(isoString: string): string {
  const d = new Date(isoString)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  if (diffMs <= 0) return "now"
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffH < 1) return "<1h"
  return `${diffH}h`
}

function UsageRemaining({ data, isExpanded, onToggle }: { data: QuotaSnapshot; isExpanded: boolean; onToggle: () => void }) {
  const dailyPct = Math.round(Math.max(0, Math.min(1, data.remainingPct.daily)) * 100)
  const weeklyPct = Math.round(Math.max(0, Math.min(1, data.remainingPct.weekly)) * 100)

  return (
    <div>
      <DropdownMenuItem
        data-studio-v4-profile-role="usage"
        aria-expanded={isExpanded}
        onSelect={(event) => { event.preventDefault(); onToggle() }}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer"
      >
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span>Usage remaining</span>
        <span className="ml-auto">
          {isExpanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          }
        </span>
      </DropdownMenuItem>
      {isExpanded && (
        <div className="pl-8 pr-3 pb-1">
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-muted-foreground w-14">{data.resetAt ? formatRemainingTime(data.resetAt.daily) : "Daily"}</span>
            <span className="tabular-nums font-medium w-12 text-center">{dailyPct}%</span>
            <span className="text-muted-foreground tabular-nums w-16 text-right">{data.resetAt ? formatResetTime(data.resetAt.daily) : ""}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-muted-foreground w-14">Weekly</span>
            <span className="tabular-nums font-medium w-12 text-center">{weeklyPct}%</span>
            <span className="text-muted-foreground tabular-nums w-16 text-right">{data.resetAt ? formatResetTime(data.resetAt.weekly) : ""}</span>
          </div>
          <DropdownMenuItem asChild><a
            data-studio-v4-profile-role="upgrade"
            href="/billing"
            className="flex items-center justify-between py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Upgrade for more usage</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a></DropdownMenuItem>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UserProfileMenu({ studioLabels = false, studioPalette = false, sessionUsage }: { studioLabels?: boolean; studioPalette?: boolean; sessionUsage?: ReactNode } = {}) {
  const { user, logout, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [aboutOpen, setAboutOpen] = useState(false)
  const accountTrigger = useRef<HTMLButtonElement>(null)
  const aboutReplay = useStudioAboutReplay({ onOpenChange: setAboutOpen, restoreFocus: () => accountTrigger.current?.focus() })
  const quotaOwner = user?.id ? `id:${user.id}` : user?.email ? `email:${user.email}` : null
  const quotaReady = !isLoading && isAuthenticated && quotaOwner !== null
  // An observed owner change retires private cached data even after A→B→A.
  // Readiness checks retire requests, but can retain the same owner's cache.
  const quotaOwnerRef = useRef({ owner: quotaOwner })
  if (quotaOwnerRef.current.owner !== quotaOwner) quotaOwnerRef.current = { owner: quotaOwner }
  const quotaOwnerLifetime = quotaOwnerRef.current
  const quotaContextRef = useRef({ owner: quotaOwnerLifetime, ready: quotaReady })
  if (quotaContextRef.current.owner !== quotaOwnerLifetime || quotaContextRef.current.ready !== quotaReady) {
    quotaContextRef.current = { owner: quotaOwnerLifetime, ready: quotaReady }
  }
  const quotaContext = quotaContextRef.current
  const [menuOpen, setMenuOpen] = useState<{ context: typeof quotaContext; open: boolean } | null>(null)
  const isOpen = menuOpen?.context === quotaContext && menuOpen.open
  const setIsOpen = useCallback((open: boolean) => setMenuOpen({ context: quotaContext, open }), [quotaContext])
  const [quotaCache, setQuotaCache] = useState<{ owner: typeof quotaOwnerLifetime; data: QuotaSnapshot } | null>(null)
  const [usageExpansion, setUsageExpansion] = useState<{ owner: typeof quotaOwnerLifetime; expanded: boolean } | null>(null)
  const [quotaRead, setQuotaRead] = useState<{ owner: typeof quotaOwnerLifetime; status: "loading" | "ready" | "failed" } | null>(null)
  const quota = quotaReady && quotaCache?.owner === quotaOwnerLifetime ? quotaCache.data : null
  const quotaReadStatus = quotaReady && quotaRead?.owner === quotaOwnerLifetime ? quotaRead.status : null
  const isUsageExpanded = usageExpansion?.owner === quotaOwnerLifetime && usageExpansion.expanded
  const quotaMountedRef = useRef(false)
  const quotaRequestRef = useRef(0)
  const quotaAbortRef = useRef<AbortController | null>(null)
  const studioProfile = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && studioPalette

  useLayoutEffect(() => {
    quotaMountedRef.current = true
    return () => {
      quotaMountedRef.current = false
      quotaRequestRef.current += 1
      quotaAbortRef.current?.abort()
    }
  }, [])

  useLayoutEffect(() => {
    quotaRequestRef.current += 1
    quotaAbortRef.current?.abort()
    quotaAbortRef.current = null
    setIsOpen(false)
    setQuotaCache(previous => previous?.owner === quotaOwnerLifetime ? previous : null)
    setUsageExpansion(previous => previous?.owner === quotaOwnerLifetime ? previous : null)
    setQuotaRead(previous => previous?.owner === quotaOwnerLifetime ? previous : null)
  }, [quotaContext, quotaOwnerLifetime, setIsOpen])

  const canReadQuota = useCallback(() => quotaMountedRef.current && quotaContext.ready &&
    quotaContextRef.current === quotaContext && quotaOwnerRef.current === quotaOwnerLifetime,
  [quotaContext, quotaOwnerLifetime])

  const onMenuOpenChange = useCallback((open: boolean) => {
    if (canReadQuota()) setIsOpen(open)
  }, [canReadQuota, setIsOpen])

  const toggleUsage = useCallback(() => {
    if (!canReadQuota()) return
    setUsageExpansion(previous => ({ owner: quotaOwnerLifetime,
      expanded: previous?.owner === quotaOwnerLifetime ? !previous.expanded : true }))
  }, [canReadQuota, quotaOwnerLifetime])

  // Fetch quota when dropdown opens (lightweight GET, cached by React state)
  const fetchQuota = useCallback(async () => {
    if (!canReadQuota()) return
    const request = ++quotaRequestRef.current
    quotaAbortRef.current?.abort()
    const controller = new AbortController()
    quotaAbortRef.current = controller
    const current = () => canReadQuota() && quotaRequestRef.current === request && !controller.signal.aborted
    setQuotaRead({ owner: quotaOwnerLifetime, status: "loading" })
    try {
      const res = await fetch("/api/usage/quota", { signal: controller.signal })
      if (!current()) return
      if (res.ok) {
        const data = readQuotaSnapshot(await res.json())
        if (!current()) return
        if (data) {
          setQuotaCache({ owner: quotaOwnerLifetime, data })
          setQuotaRead({ owner: quotaOwnerLifetime, status: "ready" })
        } else setQuotaRead({ owner: quotaOwnerLifetime, status: "failed" })
      } else setQuotaRead({ owner: quotaOwnerLifetime, status: "failed" })
    } catch {
      // Non-fatal — preserve an owned cached snapshot, never substitute zero.
      if (current()) setQuotaRead({ owner: quotaOwnerLifetime, status: "failed" })
    } finally {
      if (quotaAbortRef.current === controller) quotaAbortRef.current = null
    }
  }, [canReadQuota, quotaOwnerLifetime])

  useEffect(() => {
    if (isOpen) fetchQuota()
  }, [isOpen, fetchQuota])

  if (isLoading || !user) {
    return (
      <div data-studio-profile-loading={studioProfile ? "true" : undefined} className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
    )
  }

  const userInitials = user.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  const handleNavigation = (path: string) => {
    router.push(path)
    setIsOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    setIsOpen(false)
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <>
    <DropdownMenu open={isOpen} onOpenChange={onMenuOpenChange}>
      <StudioNavigationHint enabled={studioLabels} label="Account menu">
        <DropdownMenuTrigger asChild>
          <Button
            ref={accountTrigger} data-studio-profile-trigger={studioProfile ? "true" : undefined}
            aria-label={studioLabels ? "Open account menu" : undefined}
            variant="ghost"
            className="relative h-10 w-10 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <Avatar data-studio-profile-avatar={studioProfile ? "true" : undefined} className="h-10 w-10 border-2 border-gray-200 dark:border-gray-700">
              <AvatarImage
                src={user.image || undefined}
                alt={user.name || "User avatar"}
              />
              <AvatarFallback data-studio-profile-fallback={studioProfile ? "true" : undefined} className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-medium">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
      </StudioNavigationHint>
      <DropdownMenuContent data-studio-v4-profile={studioPalette ? "true" : undefined} data-studio-profile-fidelity={studioProfile ? "true" : undefined} side={studioProfile ? "right" : undefined} sideOffset={studioProfile ? 8 : undefined} align="end" className="w-64">
        <DropdownMenuLabel data-studio-profile-identity={studioProfile ? "true" : undefined} className="font-normal">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2">
              <p data-studio-profile-name={studioProfile ? "true" : undefined} className="text-sm font-medium leading-none">{user.name}</p>
              {quota && (
                <Badge
                  data-studio-v4-profile-role="tier"
                  variant="outline"
                  className="h-4 border-purple-200 bg-purple-50 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                >
                  {quota.tierLabel}
                </Badge>
              )}
            </div>
            <p data-studio-profile-email={studioProfile ? "true" : undefined} className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        {process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && sessionUsage && <div data-studio-session-usage="true" role="group" aria-label="Current session token usage">{sessionUsage}</div>}

        <DropdownMenuSeparator data-studio-v4-profile-role="separator" />

        <DropdownMenuItem data-studio-v4-profile-role="item" onClick={() => handleNavigation("/dashboard")}>
          <LayoutDashboard className="mr-2 h-4 w-4" />
          <span>Dashboard</span>
        </DropdownMenuItem>

        <DropdownMenuItem data-studio-v4-profile-role="item" onClick={() => handleNavigation("/knowledge")}>
          <Brain className="mr-2 h-4 w-4" />
          <span>Knowledge</span>
        </DropdownMenuItem>

        <DropdownMenuItem data-studio-v4-profile-role="item" onClick={() => handleNavigation("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>

        <DropdownMenuItem data-studio-v4-profile-role="item" onClick={toggleTheme}>
          {theme === "dark" ? (
            <>
              <Sun className="mr-2 h-4 w-4" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="mr-2 h-4 w-4" />
              <span>Dark Mode</span>
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuItem data-studio-v4-profile-role="item" onClick={() => handleNavigation("/help")}>
          <HelpCircle className="mr-2 h-4 w-4" />
          <span>Help</span>
        </DropdownMenuItem>

        {process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && <DropdownMenuItem data-studio-v4-profile-role="item" onSelect={event => { event.preventDefault(); setIsOpen(false); setAboutOpen(true) }}><Info className="mr-2 h-4 w-4" /><span>About Studio</span></DropdownMenuItem>}

        {quotaReadStatus === "loading" && <p role="status" className="px-2 py-1.5 text-xs text-muted-foreground">{quota ? "Refreshing usage. Showing previously loaded usage." : "Loading usage…"}</p>}
        {quotaReadStatus === "failed" && <p role="status" className="px-2 py-1.5 text-xs text-muted-foreground">{quota ? "Usage refresh unavailable. Showing previously loaded usage." : "Usage unavailable. Reopen the menu to retry."}</p>}
        {quota && (
          <>
            <DropdownMenuSeparator data-studio-v4-profile-role="separator" />
            <UsageRemaining data={quota} isExpanded={isUsageExpanded} onToggle={toggleUsage} />
          </>
        )}

        <DropdownMenuSeparator data-studio-v4-profile-role="separator" />

        <DropdownMenuItem data-studio-v4-profile-role="danger" onClick={handleLogout} className="text-red-600 dark:text-red-400">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && <StudioAboutDialog open={aboutOpen} onOpenChange={setAboutOpen} onCloseAutoFocus={aboutReplay.onCloseAutoFocus} onReplay={aboutReplay.intro ? aboutReplay.requestFromAbout : undefined} replayEnabled={aboutReplay.intro?.availableIgnoringOwnAboutModal} />}
    </>
  )
}
