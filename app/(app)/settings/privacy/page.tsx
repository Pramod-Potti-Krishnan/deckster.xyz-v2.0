"use client"

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Eye, Download, Loader2 } from "lucide-react"
import "@/components/settings/studio-privacy.css"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

export default function PrivacySettingsPage() {
  return process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"
    ? <StudioPrivacySettingsPage />
    : <ClassicPrivacySettingsPage />
}

type PreferenceAccess = { owner: string | null; ready: boolean; epoch: number }
function preferenceAccessCurrent(live: PreferenceAccess, captured: PreferenceAccess) {
  return Boolean(captured.owner && captured.ready && live.ready && live.owner === captured.owner && live.epoch === captured.epoch)
}

function StudioPrivacySettingsPage() {
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
  return <StudioAccountPrivacy key={owner ?? "pending"} owner={owner} authLoading={isLoading} access={access} liveAccess={accessRef} />
}

function confirmedTracking(record: unknown): record is { activityTracking: boolean } {
  return !!record && typeof record === "object" &&
    ["emailAccountActivity", "emailProductUpdates", "emailMarketing", "activityTracking"]
      .every((key) => typeof (record as Record<string, unknown>)[key] === "boolean")
}

function StudioAccountPrivacy({ owner, authLoading, access, liveAccess }: { owner: string | null; authLoading: boolean; access: PreferenceAccess; liveAccess: { current: PreferenceAccess } }) {
  const [confirmed, setConfirmed] = useState<boolean | null>(null)
  const [choice, setChoice] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
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
  const confirmedRef = useRef<boolean | null>(null)
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
    setSaving(false)
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
    setSaving(false)
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
    setSaved(false)
    try {
      const response = await fetch("/api/preferences", { signal: controller.signal })
      if (!currentRequest(token, controller)) return
      if (!response.ok) throw new Error("Activity preference could not be loaded. Try again.")
      const record: unknown = await response.json()
      if (!currentRequest(token, controller)) return
      if (!confirmedTracking(record)) throw new Error("The preference record was incomplete. Try loading it again.")
      setConfirmed(record.activityTracking)
      readbackNeeded.current = false
      setOperationNotice(null)
      setChoice((current) => current === record.activityTracking ? null : current)
      setSaveError(null)
    } catch (error) {
      if (!currentRequest(token, controller)) return
      setLoadError(error instanceof Error ? error.message : "Activity preference could not be loaded. Try again.")
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

  const saveTracking = useCallback(async (next: boolean) => {
    if (!canStart() || confirmed === null || busy.current || readbackNeeded.current) return
    busy.current = true
    const token = ++generation.current
    const controller = new AbortController()
    request.current = controller
    requestAccess.current = access.epoch
    requestKind.current = "write"
    setChoice(next)
    setSaveError(null)
    setSaved(false)
    setSaving(true)
    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityTracking: next }),
        signal: controller.signal,
      })
      if (!currentRequest(token, controller)) return
      if (!response.ok) throw new Error("This choice was not confirmed. Retry it or discard the local choice.")
      const record: unknown = await response.json()
      if (!currentRequest(token, controller)) return
      if (!confirmedTracking(record) || record.activityTracking !== next) throw new Error("The response did not confirm this choice. Reload preferences or retry.")
      setConfirmed(record.activityTracking)
      setChoice(null)
      setSaved(true)
    } catch (error) {
      if (!currentRequest(token, controller)) return
      setSaveError(error instanceof Error ? error.message : "This choice was not confirmed. Please retry.")
    } finally {
      if (currentRequest(token, controller)) {
        busy.current = false
        request.current = null
        requestAccess.current = null
        requestKind.current = null
        setSaving(false)
      }
    }
  }, [canStart, access, liveAccess, confirmed, mountLifetime])

  if (!access.ready) return <div data-studio-privacy="true" role="status" aria-busy={authLoading}>{authLoading ? "Checking your account…" : "Sign in to load your account preferences."}</div>

  const disabled = !access.ready || readbackNeeded.current || !owner || confirmed === null || loading || saving
  const status = authLoading ? "Checking your account…" : !owner ? "Sign in to load your account preference." : loading ? confirmed === null ? "Loading your saved preference…" : "Refreshing your saved preference…" : loadError ? confirmed === null ? "Preference unavailable. The switch is disabled until loaded." : "Showing the last confirmed record. Refresh failed." : confirmed === null ? "Waiting for your preference record…" : "Account preference record loaded."

  return (
    <div data-studio-privacy="true" aria-busy={loading || saving}>
      <Card className="sp-card"><CardHeader className="sp-header"><CardTitle>Privacy Settings</CardTitle><CardDescription>Control how your data is used and who can see your information</CardDescription></CardHeader><CardContent className="sp-body">
        <div className="sp-row"><div><Label><Eye className="h-4 w-4" aria-hidden="true" />Profile Visibility</Label><p>Your profile is private. Public profiles and team sharing are planned for a future release.</p></div><Badge variant="outline" className="sp-planned">Planned</Badge></div>
        <div className="sp-tracking" data-studio-privacy-tracking data-unsaved={choice !== null ? "true" : "false"}>
          <div className="sp-load"><span role="status">{loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}{status}</span><button type="button" className="sp-action" onClick={() => void readPreferences()} disabled={!access.ready || !owner || loading || saving} data-studio-privacy-refresh>{loadError ? "Retry loading" : "Refresh"}</button></div>
          {loadError && <p className="sp-error" role="alert">{loadError}</p>}
          {operationNotice && <p role="status">{operationNotice}</p>}
          <div className="sp-row"><div><Label htmlFor="privacy-activity-tracking">Activity Tracking</Label><p id="privacy-activity-help">Allow us to collect usage data to improve the product</p><p id="privacy-activity-status" className={confirmed !== null && choice === null ? "sp-confirmed" : undefined} role="status">{saving ? "Saving local choice…" : choice !== null ? `Unsaved local choice · last confirmed ${confirmed ? "on" : "off"}` : confirmed === null ? "Not loaded" : `${saved ? "Save confirmed" : "Last confirmed"} · ${confirmed ? "On" : "Off"}`}</p></div><Switch id="privacy-activity-tracking" checked={choice ?? confirmed ?? false} onCheckedChange={(next) => void saveTracking(next)} disabled={disabled} aria-describedby={`privacy-activity-help privacy-activity-status${saveError ? " privacy-activity-error" : ""}`} /></div>
          {choice !== null && !saving && <div className="sp-recovery">{saveError && <p className="sp-error" id="privacy-activity-error" role="alert">{saveError}</p>}<div><button type="button" className="sp-action" onClick={() => void saveTracking(choice)} disabled={disabled}>Retry choice</button><button type="button" className="sp-action" disabled={loading || saving} onClick={() => { if (!canStart() || busy.current) return; setChoice(null); setSaveError(null); setSaved(false) }}>Discard local choice</button></div></div>}
        </div>
      </CardContent></Card>
      <Card className="sp-card"><CardHeader className="sp-header"><CardTitle>Data Management</CardTitle><CardDescription>Export or delete your personal data</CardDescription></CardHeader><CardContent className="sp-body"><div className="sp-export"><Download className="h-5 w-5" aria-hidden="true" /><div><strong>Export Your Data</strong><p>Download all your presentations and account data</p></div><Button className="sp-action" variant="outline" onClick={() => {
                // GET route responds with Content-Disposition: attachment,
                // so this triggers a download rather than a navigation.
                window.location.href = "/api/account/export"
              }}>Export</Button></div></CardContent></Card>
    </div>
  )
}

function ClassicPrivacySettingsPage() {
  const [activityTracking, setActivityTracking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        setActivityTracking(data.activityTracking ?? false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const toggleTracking = useCallback(async () => {
    const next = !activityTracking
    setActivityTracking(next)
    setSaving(true)
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityTracking: next }),
      })
      if (!res.ok) setActivityTracking(!next)
    } catch {
      setActivityTracking(!next)
    } finally {
      setSaving(false)
    }
  }, [activityTracking])

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Privacy Settings</CardTitle>
          <CardDescription>
            Control how your data is used and who can see your information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Profile Visibility
              </Label>
              <p className="text-sm text-muted-foreground">
                Your profile is private. Public profiles and team sharing are
                planned for a future release.
              </p>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              Planned
            </Badge>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Activity Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Allow us to collect usage data to improve the product
              </p>
            </div>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={activityTracking}
                onCheckedChange={toggleTracking}
                disabled={saving}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Export or delete your personal data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Export Your Data</p>
                <p className="text-sm text-muted-foreground">
                  Download all your presentations and account data
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                // GET route responds with Content-Disposition: attachment,
                // so this triggers a download rather than a navigation.
                window.location.href = "/api/account/export"
              }}
            >
              Export
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
