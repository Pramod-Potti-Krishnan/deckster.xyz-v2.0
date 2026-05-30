"use client"

import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Mail, User } from "lucide-react"
import Link from "next/link"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

export default function ProfileSettingsPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
  }
  if (!user) return null

  const userInitials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Profile Information</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Editing coming soon</span>
            <Button variant="outline" size="sm" disabled>
              Edit Profile
            </Button>
          </div>
        </div>
        <CardDescription>Your personal details and account information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={user.image || undefined} alt={user.name || "User avatar"} />
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-xl font-medium text-white">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h3 className="text-lg font-medium">{user.name}</h3>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <Separator />

        {/* Fields */}
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Display Name
            </Label>
            <p className="text-sm">{user.name || "Not set"}</p>
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Address
            </Label>
            <p className="text-sm">{user.email}</p>
            <p className="text-xs text-muted-foreground">
              Email cannot be changed as it&apos;s linked to your Google account
            </p>
          </div>
        </div>

        <Separator />

        {/* Subscription is owned by /billing — link out instead of duplicating */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Subscription</p>
            <p className="text-sm text-muted-foreground">
              Manage your plan, payment method, and invoices
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/billing">Manage</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
