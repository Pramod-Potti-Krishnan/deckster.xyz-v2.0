"use client"

import type { ComponentType } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSubscription } from "@/hooks/use-subscription"
import { cn } from "@/lib/utils"
import { User, Palette, Bell, ShieldCheck, Lock, Brain } from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  premiumOnly?: boolean
}

const ITEMS: NavItem[] = [
  { href: "/settings/profile", label: "Profile", icon: User },
  { href: "/settings/appearance", label: "Appearance", icon: Palette },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/privacy", label: "Privacy & Data", icon: ShieldCheck },
  { href: "/settings/security", label: "Security", icon: Lock },
  { href: "/settings/knowledge-graph", label: "Knowledge Graph", icon: Brain, premiumOnly: true },
]

export function SettingsSidebar() {
  const pathname = usePathname()
  const { subscription } = useSubscription()
  // Premium gate mirrors useKnowledgeGraph().isPremium exactly (subscription.tier).
  const isPremium = subscription?.tier === "premium"

  const items = ITEMS.filter((item) => !item.premiumOnly || isPremium)

  return (
    <nav
      aria-label="Settings"
      className="flex flex-row gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0"
    >
      {items.map((item) => {
        const active = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-purple-100 text-purple-900 dark:bg-purple-950/50 dark:text-purple-200"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
