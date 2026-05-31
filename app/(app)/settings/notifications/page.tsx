"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Mail, CheckCircle2, Loader2 } from "lucide-react"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

interface Preferences {
  emailAccountActivity: boolean
  emailProductUpdates: boolean
  emailMarketing: boolean
  activityTracking: boolean
}

const EMAIL_PREFS: {
  key: keyof Preferences
  label: string
  desc: string
}[] = [
  {
    key: "emailAccountActivity",
    label: "Account Activity",
    desc: "Important notifications about your account",
  },
  {
    key: "emailProductUpdates",
    label: "Product Updates",
    desc: "New features and improvements",
  },
  {
    key: "emailMarketing",
    label: "Marketing & Promotions",
    desc: "Special offers and promotional content",
  },
]

export default function NotificationsSettingsPage() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        setPrefs(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const toggle = useCallback(
    async (key: keyof Preferences) => {
      if (!prefs) return
      const next = !prefs[key]
      // Optimistic update
      setPrefs((p) => (p ? { ...p, [key]: next } : p))
      setSaving(key)
      try {
        const res = await fetch("/api/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: next }),
        })
        if (!res.ok) {
          // Revert on failure
          setPrefs((p) => (p ? { ...p, [key]: !next } : p))
        }
      } catch {
        setPrefs((p) => (p ? { ...p, [key]: !next } : p))
      } finally {
        setSaving(null)
      }
    },
    [prefs]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>Choose what emails you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {EMAIL_PREFS.map((row, i) => (
            <div key={row.key}>
              {i > 0 && <Separator className="mb-4" />}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{row.label}</Label>
                  <p className="text-sm text-muted-foreground">{row.desc}</p>
                </div>
                <Switch
                  checked={prefs?.[row.key] ?? false}
                  onCheckedChange={() => toggle(row.key)}
                  disabled={saving === row.key}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-2">
            Preferences saved. Email delivery will activate when notifications ship.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Address</CardTitle>
          <CardDescription>Your notification delivery address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">{user?.email}</p>
              <p className="text-sm text-muted-foreground">
                Verified via Google sign-in
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Verified</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
