"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Eye, Download, Loader2 } from "lucide-react"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

export default function PrivacySettingsPage() {
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
