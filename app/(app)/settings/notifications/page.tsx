"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Mail, CheckCircle2, Loader2, Info } from "lucide-react"
import "@/components/settings/studio-notifications.css"

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
  return process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"
    ? <StudioNotificationsSettingsPage />
    : <ClassicNotificationsSettingsPage />
}

function StudioNotificationsSettingsPage() {
  const { user, isLoading } = useAuth()
  const owner = user?.id ?? null
  return <StudioAccountNotifications key={owner ?? "pending"} owner={owner} authLoading={isLoading} email={user?.email ?? ""} />
}

function isPreferences(value: unknown): value is Preferences {
  return !!value && typeof value === "object" &&
    ["emailAccountActivity", "emailProductUpdates", "emailMarketing", "activityTracking"]
      .every((key) => typeof (value as Record<string, unknown>)[key] === "boolean")
}

function withoutChoice<T>(choices: Partial<Record<keyof Preferences, T>>, key: keyof Preferences) {
  const next = { ...choices }
  delete next[key]
  return next
}

function StudioAccountNotifications({ owner, authLoading, email }: { owner: string | null; authLoading: boolean; email: string }) {
  const [confirmed, setConfirmed] = useState<Preferences | null>(null)
  const [choices, setChoices] = useState<Partial<Preferences>>({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState<keyof Preferences | null>(null)
  const [saveErrors, setSaveErrors] = useState<Partial<Record<keyof Preferences, string>>>({})
  const [savedKey, setSavedKey] = useState<keyof Preferences | null>(null)
  const mounted = useRef(false)
  const busy = useRef(false)
  const generation = useRef(0)
  const request = useRef<AbortController | null>(null)

  const readPreferences = useCallback(async () => {
    if (!owner || busy.current || !mounted.current) return
    busy.current = true
    const token = ++generation.current
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setLoadError(null)
    setSavedKey(null)
    try {
      const response = await fetch("/api/preferences", { signal: controller.signal })
      if (!response.ok) throw new Error("Preferences could not be loaded. Try again.")
      const record: unknown = await response.json()
      if (!isPreferences(record)) throw new Error("The preference record was incomplete. Try loading it again.")
      if (!mounted.current || generation.current !== token) return
      setConfirmed(record)
      // Only remove a local choice once the server independently confirms it.
      setChoices((current) => Object.fromEntries(Object.entries(current).filter(([key, value]) => record[key as keyof Preferences] !== value)))
      setSaveErrors({})
    } catch (error) {
      if (!mounted.current || generation.current !== token || controller.signal.aborted) return
      setLoadError(error instanceof Error ? error.message : "Preferences could not be loaded. Try again.")
    } finally {
      if (mounted.current && generation.current === token) {
        busy.current = false
        request.current = null
        setLoading(false)
      }
    }
  }, [owner])

  useEffect(() => {
    mounted.current = true
    void readPreferences()
    return () => {
      mounted.current = false
      ++generation.current
      request.current?.abort()
      request.current = null
      busy.current = false
    }
  }, [readPreferences])

  const savePreference = useCallback(async (key: keyof Preferences, next: boolean) => {
    if (!owner || !confirmed || busy.current || !mounted.current) return
    busy.current = true
    const token = ++generation.current
    const controller = new AbortController()
    request.current = controller
    setChoices((current) => ({ ...current, [key]: next }))
    setSaveErrors((current) => withoutChoice(current, key))
    setSavedKey(null)
    setSaving(key)
    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error("This choice was not confirmed. Retry it or discard the local choice.")
      const record: unknown = await response.json()
      if (!isPreferences(record) || record[key] !== next) throw new Error("The response did not confirm this choice. Reload preferences or retry.")
      if (!mounted.current || generation.current !== token) return
      setConfirmed(record)
      setChoices((current) => withoutChoice(current, key))
      setSavedKey(key)
    } catch (error) {
      if (!mounted.current || generation.current !== token || controller.signal.aborted) return
      setSaveErrors((current) => ({ ...current, [key]: error instanceof Error ? error.message : "This choice was not confirmed. Please retry." }))
    } finally {
      if (mounted.current && generation.current === token) {
        busy.current = false
        request.current = null
        setSaving(null)
      }
    }
  }, [owner, confirmed])

  const disabled = !owner || !confirmed || loading || saving !== null
  const status = authLoading ? "Checking your account…" : !owner ? "Sign in to load your account preferences." : loading ? confirmed ? "Refreshing your saved preferences…" : "Loading your saved preferences…" : loadError ? confirmed ? "Showing the last confirmed record. Refresh failed." : "Preferences unavailable. Switches are disabled until loaded." : confirmed ? "Account preference record loaded." : "Waiting for your preference record…"

  return (
    <div data-studio-notifications="true" aria-busy={loading || saving !== null}>
      <Card className="sn-card">
        <CardHeader className="sn-header"><CardTitle>Email Notifications</CardTitle><CardDescription>Choose what emails you want to receive</CardDescription></CardHeader>
        <CardContent className="sn-body">
          <div className="sn-load"><span role="status">{loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}{status}</span><button type="button" className="sn-action" onClick={() => void readPreferences()} disabled={!owner || loading || saving !== null} data-studio-notifications-refresh>{loadError ? "Retry loading" : "Refresh"}</button></div>
          {loadError && <p className="sn-error" role="alert">{loadError}</p>}
          {EMAIL_PREFS.map((row) => {
            const id = `notification-${row.key}`
            const hasChoice = choices[row.key] !== undefined
            return <div className="sn-row" key={row.key} data-studio-notification={row.key} data-unsaved={hasChoice ? "true" : "false"}>
              <div><Label htmlFor={id}>{row.label}</Label><p id={`${id}-help`}>{row.desc}</p><p id={`${id}-status`} className={confirmed && !hasChoice ? "sn-confirmed" : undefined} role="status">{saving === row.key ? "Saving local choice…" : hasChoice ? `Unsaved local choice · last confirmed ${confirmed?.[row.key] ? "on" : "off"}` : confirmed ? `${savedKey === row.key ? "Save confirmed" : "Last confirmed"} · ${confirmed[row.key] ? "On" : "Off"}` : "Not loaded"}</p></div>
              <Switch id={id} checked={choices[row.key] ?? confirmed?.[row.key] ?? false} onCheckedChange={(next) => void savePreference(row.key, next)} disabled={disabled} aria-describedby={`${id}-help ${id}-status${saveErrors[row.key] ? ` ${id}-error` : ""}`} />
              {hasChoice && saving !== row.key && <div className="sn-row-recovery">
                {saveErrors[row.key] && <p id={`${id}-error`} className="sn-error" role="alert">{saveErrors[row.key]}</p>}
                <button type="button" className="sn-action" disabled={disabled} onClick={() => void savePreference(row.key, choices[row.key]!)}>Retry choice</button>
                <button type="button" className="sn-action" disabled={loading || saving !== null} onClick={() => { setChoices((current) => withoutChoice(current, row.key)); setSaveErrors((current) => { const next = { ...current }; delete next[row.key]; return next }); setSavedKey(null) }}>Discard local choice</button>
              </div>}
            </div>
          })}
          <p className="sn-delivery"><Info className="h-3.5 w-3.5" aria-hidden="true" />Email delivery will activate when notifications ship.</p>
        </CardContent>
      </Card>
      <Card className="sn-card"><CardHeader className="sn-header"><CardTitle>Email Address</CardTitle><CardDescription>Your notification delivery address</CardDescription></CardHeader><CardContent className="sn-body"><div className="sn-email"><Mail className="h-5 w-5" aria-hidden="true" /><div><strong>{email || "Account email unavailable"}</strong>{email && <p>Verified via Google sign-in</p>}</div>{email && <span><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Verified</span>}</div></CardContent></Card>
    </div>
  )
}

function ClassicNotificationsSettingsPage() {
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
