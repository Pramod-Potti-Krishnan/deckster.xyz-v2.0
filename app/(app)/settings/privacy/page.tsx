"use client"

import { useEffect, useState, useCallback, useRef } from "react"
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

function StudioPrivacySettingsPage() {
  const { user, isLoading } = useAuth()
  const owner = user?.id ?? null
  return <StudioAccountPrivacy key={owner ?? "pending"} owner={owner} authLoading={isLoading} />
}

function confirmedTracking(record: unknown): record is { activityTracking: boolean } {
  return !!record && typeof record === "object" &&
    ["emailAccountActivity", "emailProductUpdates", "emailMarketing", "activityTracking"]
      .every((key) => typeof (record as Record<string, unknown>)[key] === "boolean")
}

function StudioAccountPrivacy({ owner, authLoading }: { owner: string | null; authLoading: boolean }) {
  const [confirmed, setConfirmed] = useState<boolean | null>(null)
  const [choice, setChoice] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
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
    setSaved(false)
    try {
      const response = await fetch("/api/preferences", { signal: controller.signal })
      if (!response.ok) throw new Error("Activity preference could not be loaded. Try again.")
      const record: unknown = await response.json()
      if (!confirmedTracking(record)) throw new Error("The preference record was incomplete. Try loading it again.")
      if (!mounted.current || generation.current !== token) return
      setConfirmed(record.activityTracking)
      setChoice((current) => current === record.activityTracking ? null : current)
      setSaveError(null)
    } catch (error) {
      if (!mounted.current || generation.current !== token || controller.signal.aborted) return
      setLoadError(error instanceof Error ? error.message : "Activity preference could not be loaded. Try again.")
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

  const saveTracking = useCallback(async (next: boolean) => {
    if (!owner || confirmed === null || busy.current || !mounted.current) return
    busy.current = true
    const token = ++generation.current
    const controller = new AbortController()
    request.current = controller
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
      if (!response.ok) throw new Error("This choice was not confirmed. Retry it or discard the local choice.")
      const record: unknown = await response.json()
      if (!confirmedTracking(record) || record.activityTracking !== next) throw new Error("The response did not confirm this choice. Reload preferences or retry.")
      if (!mounted.current || generation.current !== token) return
      setConfirmed(record.activityTracking)
      setChoice(null)
      setSaved(true)
    } catch (error) {
      if (!mounted.current || generation.current !== token || controller.signal.aborted) return
      setSaveError(error instanceof Error ? error.message : "This choice was not confirmed. Please retry.")
    } finally {
      if (mounted.current && generation.current === token) {
        busy.current = false
        request.current = null
        setSaving(false)
      }
    }
  }, [owner, confirmed])

  const disabled = !owner || confirmed === null || loading || saving
  const status = authLoading ? "Checking your account…" : !owner ? "Sign in to load your account preference." : loading ? confirmed === null ? "Loading your saved preference…" : "Refreshing your saved preference…" : loadError ? confirmed === null ? "Preference unavailable. The switch is disabled until loaded." : "Showing the last confirmed record. Refresh failed." : confirmed === null ? "Waiting for your preference record…" : "Account preference record loaded."

  return (
    <div data-studio-privacy="true" aria-busy={loading || saving}>
      <Card className="sp-card"><CardHeader className="sp-header"><CardTitle>Privacy Settings</CardTitle><CardDescription>Control how your data is used and who can see your information</CardDescription></CardHeader><CardContent className="sp-body">
        <div className="sp-row"><div><Label><Eye className="h-4 w-4" aria-hidden="true" />Profile Visibility</Label><p>Your profile is private. Public profiles and team sharing are planned for a future release.</p></div><Badge variant="outline" className="sp-planned">Planned</Badge></div>
        <div className="sp-tracking" data-studio-privacy-tracking data-unsaved={choice !== null ? "true" : "false"}>
          <div className="sp-load"><span role="status">{loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}{status}</span><button type="button" className="sp-action" onClick={() => void readPreferences()} disabled={!owner || loading || saving} data-studio-privacy-refresh>{loadError ? "Retry loading" : "Refresh"}</button></div>
          {loadError && <p className="sp-error" role="alert">{loadError}</p>}
          <div className="sp-row"><div><Label htmlFor="privacy-activity-tracking">Activity Tracking</Label><p id="privacy-activity-help">Allow us to collect usage data to improve the product</p><p id="privacy-activity-status" className={confirmed !== null && choice === null ? "sp-confirmed" : undefined} role="status">{saving ? "Saving local choice…" : choice !== null ? `Unsaved local choice · last confirmed ${confirmed ? "on" : "off"}` : confirmed === null ? "Not loaded" : `${saved ? "Save confirmed" : "Last confirmed"} · ${confirmed ? "On" : "Off"}`}</p></div><Switch id="privacy-activity-tracking" checked={choice ?? confirmed ?? false} onCheckedChange={(next) => void saveTracking(next)} disabled={disabled} aria-describedby={`privacy-activity-help privacy-activity-status${saveError ? " privacy-activity-error" : ""}`} /></div>
          {choice !== null && !saving && <div className="sp-recovery">{saveError && <p className="sp-error" id="privacy-activity-error" role="alert">{saveError}</p>}<div><button type="button" className="sp-action" onClick={() => void saveTracking(choice)} disabled={disabled}>Retry choice</button><button type="button" className="sp-action" disabled={loading || saving} onClick={() => { setChoice(null); setSaveError(null); setSaved(false) }}>Discard local choice</button></div></div>}
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
