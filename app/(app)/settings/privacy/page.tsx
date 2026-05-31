"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Eye, Download } from "lucide-react"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

const VISIBILITY = [
  { v: "public", t: "Public", d: "Anyone can view your profile" },
  { v: "team", t: "Team Only", d: "Only team members can view your profile" },
  { v: "private", t: "Private", d: "Only you can view your profile" },
]

export default function PrivacySettingsPage() {
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription>
                Control how your data is used and who can see your information
              </CardDescription>
            </div>
            <span className="text-xs text-muted-foreground">Coming soon</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Profile Visibility
            </Label>
            <div className="space-y-3 opacity-60">
              {VISIBILITY.map((o) => (
                <label key={o.v} className="flex cursor-not-allowed items-center space-x-3">
                  <input
                    type="radio"
                    name="visibility"
                    value={o.v}
                    defaultChecked={o.v === "private"}
                    disabled
                    className="text-purple-600"
                  />
                  <div>
                    <p className="font-medium">{o.t}</p>
                    <p className="text-sm text-muted-foreground">{o.d}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Activity Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Allow us to collect usage data to improve the product
              </p>
            </div>
            <Switch disabled />
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
