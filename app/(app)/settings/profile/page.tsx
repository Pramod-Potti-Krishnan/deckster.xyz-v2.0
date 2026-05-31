"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Mail, User } from "lucide-react"
import Link from "next/link"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

export default function ProfileSettingsPage() {
  const { user, isLoading } = useAuth()
  const { update } = useSession()

  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const startEditing = () => {
    setDisplayName(user.name || "")
    setError(null)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setError(null)
  }

  const handleSave = async () => {
    const name = displayName.trim()
    if (!name) {
      setError("Display name is required")
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const resp = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        setError(body.error || "Failed to update profile")
        return
      }
      // Refresh the JWT-backed session so the new name shows everywhere
      // (header avatar, dropdown) without a re-login.
      await update({ name })
      setIsEditing(false)
    } catch (e) {
      console.error("Profile save error:", e)
      setError("Network error. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Profile Information</CardTitle>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={isSaving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={startEditing}>
              Edit Profile
            </Button>
          )}
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
            {isEditing ? (
              <>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  maxLength={80}
                  disabled={isSaving}
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
              </>
            ) : (
              <p className="text-sm">{user.name || "Not set"}</p>
            )}
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
