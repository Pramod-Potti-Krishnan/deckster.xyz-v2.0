"use client"

import "@/components/settings/studio-appearance-settings.css"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Sun, Moon, Monitor, Check, Info } from "lucide-react"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

const STUDIO_SHELL = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

export default function AppearanceSettingsPage() {
  const { theme, setTheme, resolvedTheme, systemTheme } = useTheme()
  // Avoid hydration mismatch: theme is only known on the client.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (STUDIO_SHELL) {
    const currentAppearance = !mounted ? "Reading your appearance…" : theme === "system" ? resolvedTheme === "dark" || resolvedTheme === "light" ? `System · currently ${resolvedTheme}` : "System · waiting for your device setting" : theme === "light" || theme === "dark" ? `${theme === "light" ? "Light" : "Dark"} appearance selected` : "Appearance not yet resolved"
    return <Card data-studio-appearance-settings="true">
      <CardHeader data-studio-appearance-header="true"><CardTitle>Interface appearance</CardTitle><CardDescription>Choose how Deckster looks to you. Select a theme or follow your system setting.</CardDescription></CardHeader>
      <CardContent data-studio-appearance-body="true">
        <p className="sas-status" role="status">{mounted && <Monitor size={14} aria-hidden="true" />}{currentAppearance}</p>
        <div className="sas-options" role="group" aria-label="Interface appearance">
          {OPTIONS.map(opt => {
            const Icon = opt.icon
            const active = mounted && theme === opt.value
            const preview = opt.value === "system" ? mounted && (systemTheme === "light" || systemTheme === "dark") ? systemTheme : "loading" : opt.value
            return <button key={opt.value} type="button" data-studio-appearance-choice={opt.value} className="sas-option" aria-pressed={active} onClick={() => setTheme(opt.value)}>
              <span className="sas-specimen" data-preview={preview} aria-hidden="true"><span className="sas-mini-rail"><i /><i /><i /></span><span className="sas-mini-main"><span /><span className="sas-mini-canvas"><span className="sas-mini-sidebar" /><span className="sas-mini-slide"><i /><i /><i /></span></span></span></span>
              <span className="sas-option-heading"><Icon size={16} aria-hidden="true" /><strong>{opt.label}</strong>{active && <Check size={14} aria-hidden="true" />}</span>
              <span className="sas-option-description">{opt.value === "light" ? "Bright panels on a soft background." : opt.value === "dark" ? "Dark panels with softer contrast." : "Follows your device’s light or dark appearance."}{opt.value === "system" && <small>{preview === "loading" ? "Device appearance will show when available." : `Your device currently uses ${preview}.`}</small>}</span>
            </button>
          })}
        </div>
        <div className="sas-scope"><Info size={15} aria-hidden="true" /><p>These choices change Deckster’s interface in this browser. Review presentation colors and fonts in <Link href="/studio/themes">Themes &amp; brand</Link>.</p></div>
      </CardContent>
    </Card>
  }

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
