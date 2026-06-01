"use client"

import { useCallback, useEffect, useState } from "react"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  CreditCard,
  Moon,
  Sun,
  LogOut,
  LayoutDashboard,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Clock,
} from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

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
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle() }}
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
      </button>
      {isExpanded && (
        <div className="pl-8 pr-3 pb-2 space-y-0.5">
          <div className="flex items-center justify-between py-1 text-[11px]">
            <span className="text-muted-foreground w-14">{data.resetAt ? formatRemainingTime(data.resetAt.daily) : "Daily"}</span>
            <span className="tabular-nums font-medium w-12 text-center">{dailyPct}%</span>
            <span className="text-muted-foreground tabular-nums w-16 text-right">{data.resetAt ? formatResetTime(data.resetAt.daily) : ""}</span>
          </div>
          <div className="flex items-center justify-between py-1 text-[11px]">
            <span className="text-muted-foreground w-14">Weekly</span>
            <span className="tabular-nums font-medium w-12 text-center">{weeklyPct}%</span>
            <span className="text-muted-foreground tabular-nums w-16 text-right">{data.resetAt ? formatResetTime(data.resetAt.weekly) : ""}</span>
          </div>
          <div className="pt-1.5 space-y-0">
            <a
              href="/billing"
              className="flex items-center justify-between py-1 text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              <span>Upgrade for more usage</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a
              href="https://deckster.xyz/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between py-1 text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              <span>Learn more</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UserProfileMenu() {
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [quota, setQuota] = useState<QuotaSnapshot | null>(null)
  const [isUsageExpanded, setIsUsageExpanded] = useState(false)

  // Fetch quota when dropdown opens (lightweight GET, cached by React state)
  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/quota")
      if (res.ok) {
        const data = await res.json()
        setQuota({
          tierLabel: data.tierLabel,
          remainingPct: data.remainingPct,
          flags: data.flags,
          resetAt: data.resetAt,
          caps: data.caps,
          spent: data.spent,
        })
      }
    } catch {
      // Non-fatal — dropdown still works without bars
    }
  }, [])

  useEffect(() => {
    if (isOpen) fetchQuota()
  }, [isOpen, fetchQuota])

  if (isLoading || !user) {
    return (
      <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
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
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
        >
          <Avatar className="h-10 w-10 border-2 border-gray-200 dark:border-gray-700">
            <AvatarImage
              src={user.image || undefined}
              alt={user.name || "User avatar"}
            />
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              {quota && (
                <Badge
                  variant="outline"
                  className="h-4 border-purple-200 bg-purple-50 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                >
                  {quota.tierLabel}
                </Badge>
              )}
            </div>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleNavigation("/dashboard")}>
          <LayoutDashboard className="mr-2 h-4 w-4" />
          <span>Dashboard</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleNavigation("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleNavigation("/billing")}>
          <CreditCard className="mr-2 h-4 w-4" />
          <span>Subscription</span>
          {user.tier === "free" && (
            <Badge variant="secondary" className="ml-auto text-xs">
              Upgrade
            </Badge>
          )}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={toggleTheme}>
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

        {quota && (
          <>
            <DropdownMenuSeparator />
            <UsageRemaining data={quota} isExpanded={isUsageExpanded} onToggle={() => setIsUsageExpanded(v => !v)} />
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
