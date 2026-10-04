"use client"

import { useEffect, useRef, useState } from "react"
import { signOut } from "next-auth/react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Globe, Lock, Trash2, AlertTriangle } from "lucide-react"
import "@/components/settings/studio-security.css"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

function interruptionMessage(acknowledged: boolean) {
  return acknowledged
    ? "Account deletion was confirmed, but sign-out was interrupted. Verify your account before retrying sign-out."
    : "Deletion was not confirmed. The request may have completed. Verify your account before trying again."
}

export default function SecuritySettingsPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const owner = user?.id || null
  const accessReady = !!(owner && isAuthenticated && !isLoading)
  // This changes during render, before the previous account's effect cleanup.
  const currentOwner = useRef<string | null>(null)
  currentOwner.current = accessReady ? owner : null
  return <SecuritySettingsForAccount key={owner || 'signed-out'} owner={owner} accessReady={accessReady} accessLoading={isLoading} currentOwner={currentOwner} />
}

function SecuritySettingsForAccount({ owner, accessReady, accessLoading, currentOwner }: {
  owner: string | null
  accessReady: boolean
  accessLoading: boolean
  currentOwner: { current: string | null }
}) {
  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletionConfirmed, setDeletionConfirmed] = useState(false)
  const mounted = useRef(false)
  const generation = useRef(0)
  const pending = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const confirmationOpen = useRef(false)
  const confirmationText = useRef("")
  const acknowledged = useRef(false)
  const interrupted = useRef(false)

  useEffect(() => {
    mounted.current = true
    if (interrupted.current) {
      interrupted.current = false
      setIsDeleting(false)
      setError(interruptionMessage(acknowledged.current))
    }
    return () => {
      mounted.current = false
      generation.current += 1
      controller.current?.abort()
      if (pending.current) interrupted.current = true
      pending.current = false
    }
  }, [])

  useEffect(() => {
    if (!accessReady) {
      const wasPending = pending.current
      generation.current += 1
      controller.current?.abort()
      pending.current = false
      setIsDeleting(false)
      if (wasPending) setError(interruptionMessage(acknowledged.current))
    }
  }, [accessReady])

  const canDelete = accessReady && showConfirm && (deletionConfirmed || confirmText.trim() === "DELETE")
  const isCurrentOwner = () => mounted.current && accessReady && !!owner && currentOwner.current === owner

  const handleDelete = async () => {
    if (!isCurrentOwner() || pending.current || !confirmationOpen.current || (!acknowledged.current && confirmationText.current.trim() !== "DELETE")) return
    pending.current = true
    const attempt = ++generation.current
    const abort = new AbortController()
    controller.current = abort
    const isCurrent = () => isCurrentOwner() && generation.current === attempt && !abort.signal.aborted
    setIsDeleting(true)
    setError(null)
    let signOutCompleted = false
    try {
      if (!acknowledged.current) {
        const resp = await fetch("/api/account", { method: "DELETE", signal: abort.signal })
        if (!isCurrent()) return
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}))
          if (isCurrent()) setError(typeof body.error === "string" ? body.error : "Failed to delete account")
          return
        }
        acknowledged.current = true
        setDeletionConfirmed(true)
      }
      // Retry this acknowledged phase without repeating account deletion.
      if (isCurrent()) {
        await signOut({ callbackUrl: "/" })
        signOutCompleted = true
      }
    } catch (e) {
      if (isCurrent()) {
        console.error("Account delete error:", e)
        setError(acknowledged.current
          ? "Account deletion was confirmed, but sign-out did not complete. Try signing out again."
          : interruptionMessage(false))
      }
    } finally {
      if (isCurrent() && !signOutCompleted) {
        pending.current = false
        setIsDeleting(false)
      }
    }
  }

  const contents = (
    <>
      <Card data-studio-security-card={studioShell ? "authentication" : undefined}>
        <CardHeader data-studio-security-header={studioShell ? "true" : undefined}>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>Manage how you sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4" data-studio-security-body={studioShell ? "true" : undefined}>
          <div className="flex items-center justify-between rounded-lg border p-4" data-studio-security-row={studioShell ? "true" : undefined}>
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Google Sign-In</p>
                <p className="text-sm text-muted-foreground">{accessReady ? "Currently signed in with Google" : accessLoading ? "Verifying your sign-in…" : "Your sign-in could not be verified."}</p>
              </div>
            </div>
            <span className={`text-sm ${accessReady ? "text-green-600" : "text-muted-foreground"}`} data-studio-security-connected={studioShell && accessReady ? "true" : undefined}>{accessReady ? "Connected" : accessLoading ? "Checking…" : "Unverified"}</span>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4" data-studio-security-row={studioShell ? "true" : undefined}>
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
            <Badge variant="outline" className="text-muted-foreground" data-studio-security-planned={studioShell ? "true" : undefined}>
              Planned
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-900/50" data-studio-security-card={studioShell ? "danger" : undefined}>
        <CardHeader data-studio-security-header={studioShell ? "true" : undefined}>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions for your account</CardDescription>
        </CardHeader>
        <CardContent data-studio-security-body={studioShell ? "true" : undefined}>
          {!showConfirm ? (
            <div className="flex items-center justify-between rounded-lg border border-red-200 p-4 dark:border-red-900/50" data-studio-security-row={studioShell ? "true" : undefined}>
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
                data-studio-security-open={studioShell ? "true" : undefined}
                disabled={!accessReady}
                onClick={() => {
                  if (!isCurrentOwner() || pending.current || confirmationOpen.current) return
                  confirmationOpen.current = true
                  confirmationText.current = ""
                  setConfirmText("")
                  setShowConfirm(true)
                  setError(null)
                }}
              >
                Delete Account
              </Button>
            </div>
          ) : (
            <Alert className="border-red-200 dark:border-red-900/50" data-studio-security-confirmation={studioShell ? "true" : undefined}>
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="space-y-4">
                <div className="space-y-1">
                  <p className="font-medium" id={studioShell ? "security-delete-warning" : undefined}>
                    This permanently deletes your account, presentations, uploads, and billing
                    history. It cannot be undone.
                  </p>
                  {studioShell ? <label htmlFor="security-delete-confirmation">
                    Type <span className="font-mono font-semibold">DELETE</span> to confirm.
                  </label> : <p className="text-sm">
                    Type <span className="font-mono font-semibold">DELETE</span> to confirm.
                  </p>}
                </div>
                <Input
                  id={studioShell ? "security-delete-confirmation" : undefined}
                  aria-describedby={studioShell ? `security-delete-warning${error ? " security-delete-error" : ""}` : undefined}
                  value={confirmText}
                  onChange={(e) => {
                    if (pending.current || acknowledged.current || !confirmationOpen.current || !isCurrentOwner()) return
                    confirmationText.current = e.target.value
                    setConfirmText(e.target.value)
                  }}
                  placeholder="DELETE"
                  disabled={isDeleting || deletionConfirmed || !accessReady}
                  autoComplete="off"
                />
                {error && <p className="text-sm text-red-600" id={studioShell ? "security-delete-error" : undefined} role={studioShell ? "alert" : undefined} data-studio-security-error={studioShell ? "true" : undefined}>{error}</p>}
                {!accessReady && <p role="status">Verify your signed-in account before continuing.</p>}
                {deletionConfirmed && !error && <p role="status">Account deletion confirmed. Signing out…</p>}
                <div className="flex gap-2" data-studio-security-actions={studioShell ? "true" : undefined}>
                  <Button
                    variant="destructive"
                    size="sm"
                    data-studio-security-delete={studioShell ? "true" : undefined}
                    disabled={!canDelete || isDeleting}
                    aria-busy={isDeleting}
                    onClick={handleDelete}
                  >
                    {deletionConfirmed ? isDeleting ? "Signing out…" : "Retry sign-out" : isDeleting ? "Deleting…" : "Delete My Account"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-studio-security-cancel={studioShell ? "true" : undefined}
                    disabled={isDeleting || deletionConfirmed}
                    onClick={() => {
                      if (!mounted.current || pending.current || acknowledged.current) return
                      confirmationOpen.current = false
                      confirmationText.current = ""
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
  return studioShell ? <div data-studio-security="true">{contents}</div> : contents
}
