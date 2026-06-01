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
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  User,
  Settings,
  CreditCard,
  Moon,
  Sun,
  Keyboard,
  HelpCircle,
  LogOut,
  LayoutDashboard,
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
}

function barColor(near: boolean, at: boolean): string {
  if (at) return "bg-red-500"
  if (near) return "bg-amber-500"
  return "bg-emerald-500"
}

function QuotaBars({ data }: { data: QuotaSnapshot }) {
  const { remainingPct, flags } = data
  const dailyPct = Math.round(Math.max(0, Math.min(1, remainingPct.daily)) * 100)
  const weeklyPct = Math.round(Math.max(0, Math.min(1, remainingPct.weekly)) * 100)

  return (
    <div className="space-y-1.5 px-2 py-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Daily</span>
        <span className="tabular-nums">{dailyPct}% left</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", barColor(flags.dailyNear, flags.dailyAt))}
          style={{ width: `${dailyPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Weekly</span>
        <span className="tabular-nums">{weeklyPct}% left</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", barColor(flags.weeklyNear, flags.weeklyAt))}
          style={{ width: `${weeklyPct}%` }}
        />
      </div>
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

        {/* Quota bars — compact daily + weekly progress */}
        {quota && <QuotaBars data={quota} />}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleNavigation("/dashboard")}>
          <LayoutDashboard className="mr-2 h-4 w-4" />
          <span>Dashboard</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleNavigation("/settings/profile")}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
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

        <DropdownMenuSeparator />

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

        <DropdownMenuItem onClick={() => handleNavigation("/shortcuts")}>
          <Keyboard className="mr-2 h-4 w-4" />
          <span>Keyboard Shortcuts</span>
          <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleNavigation("/help")}>
          <HelpCircle className="mr-2 h-4 w-4" />
          <span>Support</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
