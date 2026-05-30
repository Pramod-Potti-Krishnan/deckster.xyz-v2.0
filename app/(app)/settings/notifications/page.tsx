"use client"

import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Mail } from "lucide-react"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

const EMAIL_PREFS = [
  { label: "Account Activity", desc: "Important notifications about your account", def: true },
  { label: "Product Updates", desc: "New features and improvements", def: true },
  { label: "Marketing & Promotions", desc: "Special offers and promotional content", def: false },
]

export default function NotificationsSettingsPage() {
  const { user } = useAuth()

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Choose what emails you want to receive</CardDescription>
            </div>
            <span className="text-xs text-muted-foreground">Coming soon</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {EMAIL_PREFS.map((row, i) => (
            <div key={row.label}>
              {i > 0 && <Separator className="mb-4" />}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{row.label}</Label>
                  <p className="text-sm text-muted-foreground">{row.desc}</p>
                </div>
                <Switch checked={row.def} disabled />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>How you receive notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">Email Address</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Coming soon</span>
              <Button variant="outline" size="sm" disabled>
                Verify
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
