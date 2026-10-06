"use client"

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react"
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

type PreferenceAccess = { owner: string | null; ready: boolean; epoch: number }
function preferenceAccessCurrent(live: PreferenceAccess, captured: PreferenceAccess) {
  return Boolean(captured.owner && captured.ready && live.ready && live.owner === captured.owner && live.epoch === captured.epoch)
}

function StudioNotificationsSettingsPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const suppliedOwner = user?.id ?? null
  const accessRef = useRef<PreferenceAccess>({ owner: null, ready: false, epoch: 0 })
  // Retain a known owner's memory during an unresolved check; observed owner or
  // readiness transitions synchronously retire captured callbacks before cleanup.
  const owner = isLoading ? suppliedOwner ?? accessRef.current.owner : isAuthenticated ? suppliedOwner : null
  const ready = Boolean(owner && isAuthenticated && !isLoading)
  const previous = accessRef.current
  if (previous.owner !== owner || previous.ready !== ready) {
    accessRef.current = { owner, ready, epoch: previous.epoch + 1 }
  }
  const access = accessRef.current
  return <StudioAccountNotifications key={owner ?? "pending"} owner={owner} authLoading={isLoading} access={access} liveAccess={accessRef} email={user?.email ?? ""} />
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

function StudioAccountNotifications({ owner, authLoading, email, access, liveAccess }: { owner: string | null; authLoading: boolean; email: string; access: PreferenceAccess; liveAccess: { current: PreferenceAccess } }) {
  const [confirmed, setConfirmed] = useState<Preferences | null>(null)
  const [choices, setChoices] = useState<Partial<Preferences>>({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState<keyof Preferences | null>(null)
  const [saveErrors, setSaveErrors] = useState<Partial<Record<keyof Preferences, string>>>({})
  const [savedKey, setSavedKey] = useState<keyof Preferences | null>(null)
  const mounted = useRef(false)
  const mountLifetimeRef = useRef(0)
  const mountLifetime = mountLifetimeRef.current
  const [, setMountRevision] = useState(0)
  const interruptedWrite = useRef(false)
  const busy = useRef(false)
  const generation = useRef(0)
  const request = useRef<AbortController | null>(null)
  const requestAccess = useRef<number | null>(null)
  const requestKind = useRef<"read" | "write" | null>(null)
  const confirmedRef = useRef<Preferences | null>(null)
  confirmedRef.current = confirmed
  const readbackNeeded = useRef(false)
  const [operationNotice, setOperationNotice] = useState<string | null>(null)
  const canStart = useCallback(() => mounted.current && mountLifetimeRef.current === mountLifetime && preferenceAccessCurrent(liveAccess.current, access), [liveAccess, access, mountLifetime])
  const currentRequest = (token: number, controller: AbortController) => mounted.current && mountLifetimeRef.current === mountLifetime && !controller.signal.aborted &&
    generation.current === token && preferenceAccessCurrent(liveAccess.current, access)

  useLayoutEffect(() => {
    mounted.current = true
    // Effect reconnect must publish a fresh rendered mount admission. It cannot
    // make an older captured callback current again merely by setting mounted.
    setMountRevision(mountLifetimeRef.current)
    setLoading(false)
    setSaving(null)
    if (interruptedWrite.current) {
      interruptedWrite.current = false
      setOperationNotice("A previous preference choice is unconfirmed after local interruption. Already dispatched work may have completed. Refresh the saved preferences before deciding whether to send another choice.")
    }
    return () => {
      mounted.current = false
      ++mountLifetimeRef.current
      ++generation.current
      if (requestKind.current === "write") {
        readbackNeeded.current = true
        interruptedWrite.current = true
      }
      request.current?.abort()
      request.current = null
      requestAccess.current = null
      requestKind.current = null
      busy.current = false
    }
  }, [])

  useLayoutEffect(() => {
    if (requestAccess.current === null || requestAccess.current === access.epoch) return
    if (requestKind.current === "write") {
      readbackNeeded.current = true
      setOperationNotice("A previous preference choice is unconfirmed after account readiness changed. Already dispatched work may have completed. Refresh the saved preferences before deciding whether to send another choice.")
    }
    ++generation.current
    request.current?.abort()
    request.current = null
    requestAccess.current = null
    requestKind.current = null
    busy.current = false
    setLoading(false)
    setSaving(null)
  }, [access.epoch])

  const readPreferences = useCallback(async () => {
    if (!canStart() || busy.current) return
    busy.current = true
    const token = ++generation.current
    const controller = new AbortController()
    request.current = controller
    requestAccess.current = access.epoch
    requestKind.current = "read"
    setLoading(true)
    setLoadError(null)
    setSavedKey(null)
    try {
      const response = await fetch("/api/preferences", { signal: controller.signal })
      if (!currentRequest(token, controller)) return
      if (!response.ok) throw new Error("Preferences could not be loaded. Try again.")
      const record: unknown = await response.json()
      if (!currentRequest(token, controller)) return
      if (!isPreferences(record)) throw new Error("The preference record was incomplete. Try loading it again.")
      setConfirmed(record)
      readbackNeeded.current = false
      setOperationNotice(null)
      // Only remove a local choice once the server independently confirms it.
      setChoices((current) => Object.fromEntries(Object.entries(current).filter(([key, value]) => record[key as keyof Preferences] !== value)))
      setSaveErrors({})
    } catch (error) {
      if (!currentRequest(token, controller)) return
      setLoadError(error instanceof Error ? error.message : "Preferences could not be loaded. Try again.")
    } finally {
      if (currentRequest(token, controller)) {
        busy.current = false
        request.current = null
        requestAccess.current = null
        requestKind.current = null
        setLoading(false)
      }
    }
  }, [canStart, access, liveAccess, mountLifetime])

  useEffect(() => {
    // Re-entry with a confirmed cache keeps local choices. Recovery is an explicit
    // read, never an automatic repeat of a previously dispatched PATCH.
    if (access.ready && confirmedRef.current === null) void readPreferences()
  }, [readPreferences, access.ready])

  const savePreference = useCallback(async (key: keyof Preferences, next: boolean) => {
    if (!canStart() || !confirmed || busy.current || readbackNeeded.current) return
    busy.current = true
    const token = ++generation.current
    const controller = new AbortController()
    request.current = controller
    requestAccess.current = access.epoch
    requestKind.current = "write"
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
      if (!currentRequest(token, controller)) return
      if (!response.ok) throw new Error("This choice was not confirmed. Retry it or discard the local choice.")
      const record: unknown = await response.json()
      if (!currentRequest(token, controller)) return
      if (!isPreferences(record) || record[key] !== next) throw new Error("The response did not confirm this choice. Reload preferences or retry.")
      setConfirmed(record)
      setChoices((current) => withoutChoice(current, key))
      setSavedKey(key)
    } catch (error) {
      if (!currentRequest(token, controller)) return
      setSaveErrors((current) => ({ ...current, [key]: error instanceof Error ? error.message : "This choice was not confirmed. Please retry." }))
    } finally {
      if (currentRequest(token, controller)) {
        busy.current = false
        request.current = null
        requestAccess.current = null
        requestKind.current = null
        setSaving(null)
      }
    }
  }, [canStart, access, liveAccess, confirmed, mountLifetime])

  if (!access.ready) return <div data-studio-notifications="true" role="status" aria-busy={authLoading}>{authLoading ? "Checking your account…" : "Sign in to load your account preferences."}</div>

  const disabled = !access.ready || readbackNeeded.current || !owner || !confirmed || loading || saving !== null
  const status = authLoading ? "Checking your account…" : !owner ? "Sign in to load your account preferences." : loading ? confirmed ? "Refreshing your saved preferences…" : "Loading your saved preferences…" : loadError ? confirmed ? "Showing the last confirmed record. Refresh failed." : "Preferences unavailable. Switches are disabled until loaded." : confirmed ? "Account preference record loaded." : "Waiting for your preference record…"

  return (
    <div data-studio-notifications="true" aria-busy={loading || saving !== null}>
      <Card className="sn-card">
        <CardHeader className="sn-header"><CardTitle>Email Notifications</CardTitle><CardDescription>Choose what emails you want to receive</CardDescription></CardHeader>
        <CardContent className="sn-body">
          <div className="sn-load"><span role="status">{loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}{status}</span><button type="button" className="sn-action" onClick={() => void readPreferences()} disabled={!access.ready || !owner || loading || saving !== null} data-studio-notifications-refresh>{loadError ? "Retry loading" : "Refresh"}</button></div>
          {loadError && <p className="sn-error" role="alert">{loadError}</p>}
          {operationNotice && <p role="status">{operationNotice}</p>}
          {EMAIL_PREFS.map((row) => {
            const id = `notification-${row.key}`
            const hasChoice = choices[row.key] !== undefined
            return <div className="sn-row" key={row.key} data-studio-notification={row.key} data-unsaved={hasChoice ? "true" : "false"}>
              <div><Label htmlFor={id}>{row.label}</Label><p id={`${id}-help`}>{row.desc}</p><p id={`${id}-status`} className={confirmed && !hasChoice ? "sn-confirmed" : undefined} role="status">{saving === row.key ? "Saving local choice…" : hasChoice ? `Unsaved local choice · last confirmed ${confirmed?.[row.key] ? "on" : "off"}` : confirmed ? `${savedKey === row.key ? "Save confirmed" : "Last confirmed"} · ${confirmed[row.key] ? "On" : "Off"}` : "Not loaded"}</p></div>
              <Switch id={id} checked={choices[row.key] ?? confirmed?.[row.key] ?? false} onCheckedChange={(next) => void savePreference(row.key, next)} disabled={disabled} aria-describedby={`${id}-help ${id}-status${saveErrors[row.key] ? ` ${id}-error` : ""}`} />
              {hasChoice && saving !== row.key && <div className="sn-row-recovery">
                {saveErrors[row.key] && <p id={`${id}-error`} className="sn-error" role="alert">{saveErrors[row.key]}</p>}
                <button type="button" className="sn-action" disabled={disabled} onClick={() => void savePreference(row.key, choices[row.key]!)}>Retry choice</button>
                <button type="button" className="sn-action" disabled={loading || saving !== null} onClick={() => { if (!canStart() || busy.current) return; setChoices((current) => withoutChoice(current, row.key)); setSaveErrors((current) => { const next = { ...current }; delete next[row.key]; return next }); setSavedKey(null) }}>Discard local choice</button>
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
