"use client"

import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Mail, CheckCircle2 } from "lucide-react"

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
            <Badge variant="outline" className="text-muted-foreground">
              Planned
            </Badge>
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
          <p className="text-xs text-muted-foreground pt-2">
            Preferences will be saved once notification delivery is activated.
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
