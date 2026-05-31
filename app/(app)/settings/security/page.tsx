"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Globe, Lock, Trash2, AlertTriangle } from "lucide-react"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

export default function SecuritySettingsPage() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDelete = confirmText.trim() === "DELETE"

  const handleDelete = async () => {
    if (!canDelete) return
    setIsDeleting(true)
    setError(null)
    try {
      const resp = await fetch("/api/account", { method: "DELETE" })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        setError(body.error || "Failed to delete account")
        setIsDeleting(false)
        return
      }
      // Account is gone — sign out and return to the landing page.
      await signOut({ callbackUrl: "/" })
    } catch (e) {
      console.error("Account delete error:", e)
      setError("Network error. Please try again.")
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>Manage how you sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Google Sign-In</p>
                <p className="text-sm text-muted-foreground">Currently signed in with Google</p>
              </div>
            </div>
            <span className="text-sm text-green-600">Connected</span>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Your Google account&apos;s 2FA protects your sign-in.
                  App-level TOTP is planned for a future release.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              Planned
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions for your account</CardDescription>
        </CardHeader>
        <CardContent>
          {!showConfirm ? (
            <div className="flex items-center justify-between rounded-lg border border-red-200 p-4 dark:border-red-900/50">
              <div className="flex items-center gap-3">
                <Trash2 className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all associated data
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => {
                  setShowConfirm(true)
                  setError(null)
                }}
              >
                Delete Account
              </Button>
            </div>
          ) : (
            <Alert className="border-red-200 dark:border-red-900/50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="space-y-4">
                <div className="space-y-1">
                  <p className="font-medium">
                    This permanently deletes your account, presentations, uploads, and billing
                    history. It cannot be undone.
                  </p>
                  <p className="text-sm">
                    Type <span className="font-mono font-semibold">DELETE</span> to confirm.
                  </p>
                </div>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  disabled={isDeleting}
                  autoComplete="off"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={!canDelete || isDeleting}
                    onClick={handleDelete}
                  >
                    {isDeleting ? "Deleting…" : "Delete My Account"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => {
                      setShowConfirm(false)
                      setConfirmText("")
                      setError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </>
  )
}
