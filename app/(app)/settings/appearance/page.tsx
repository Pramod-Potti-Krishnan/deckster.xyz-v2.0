"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Sun, Moon, Monitor, Check } from "lucide-react"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme()
  // Avoid hydration mismatch: theme is only known on the client.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Choose how Deckster looks to you. Select a theme or follow your system setting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = mounted && theme === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                aria-pressed={active}
                className={cn(
                  "relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-colors",
                  active
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                )}
              >
                {active && <Check className="absolute right-3 top-3 h-4 w-4 text-purple-600" />}
                <Icon className="h-6 w-6" />
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
