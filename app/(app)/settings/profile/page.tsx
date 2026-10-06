"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Camera, Crown, Mail, Shield, Sparkles, User, Loader2 } from "lucide-react"
import Link from "next/link"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"
const STUDIO_SHELL = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"

type ProfileRefresh = { kind: "name" | "avatar"; fields: { name?: string; image?: string }; draftRevision: number }
type ProfileUi = {
  lifetime: number; isEditing: boolean; displayName: string; draftRevision: number
  isSaving: boolean; isUploading: boolean; error: string | null; avatarError: string | null
  notice: string | null; refresh: ProfileRefresh | null
}
type ProfileOperation = { owner: string; lifetime: number; generation: number; controller: AbortController }
const emptyProfileUi = (lifetime: number): ProfileUi => ({ lifetime, isEditing: false, displayName: "", draftRevision: 0, isSaving: false, isUploading: false, error: null, avatarError: null, notice: null, refresh: null })
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value))
function validPhotoUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password } catch { return false }
}

export default function ProfileSettingsPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const { update } = useSession()
  const id = typeof user?.id === "string" && user.id ? user.id : null
  const ready = !isLoading && isAuthenticated && Boolean(id)
  const context = useRef({ owner: ready ? id : null, lifetime: 0, startEpoch: 0, ready })
  // Keep a known owner's draft through unresolved loading. A different observed
  // owner, sign-out or ABA retires the lifetime synchronously before publication.
  const nextOwner = isLoading ? (id && context.current.owner && id !== context.current.owner ? id : context.current.owner) : (ready ? id : null)
  if (nextOwner !== context.current.owner) {
    context.current.owner = nextOwner; context.current.lifetime += 1; context.current.startEpoch += 1
  }
  if (ready !== context.current.ready) context.current.startEpoch += 1
  context.current.ready = ready
  const owner = context.current.owner
  const lifetime = context.current.lifetime
  const startEpoch = context.current.startEpoch
  const [storedUi, setUi] = useState<ProfileUi>(() => emptyProfileUi(lifetime))
  const ui = storedUi.lifetime === lifetime ? storedUi : emptyProfileUi(lifetime)
  const { isEditing, displayName, isSaving, isUploading, error, avatarError, notice, refresh } = ui
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const generation = useRef(0)
  const active = useRef<ProfileOperation | null>(null)
  const waiters = useRef(new Set<() => void>())
  const draft = useRef({ lifetime, revision: ui.draftRevision, value: displayName })
  draft.current = { lifetime, revision: ui.draftRevision, value: displayName }
  const wake = useCallback(() => { for (const notify of [...waiters.current]) notify() }, [])
  const isCurrent = useCallback((operation: ProfileOperation) => mounted.current && !operation.controller.signal.aborted &&
    generation.current === operation.generation && context.current.owner === operation.owner && context.current.lifetime === operation.lifetime, [])
  const canStart = useCallback(() => Boolean(mounted.current && owner && context.current.ready && context.current.owner === owner &&
    context.current.lifetime === lifetime && context.current.startEpoch === startEpoch), [owner, lifetime, startEpoch])
  const publish = useCallback((change: (value: ProfileUi) => ProfileUi) => {
    if (!mounted.current || !context.current.ready || context.current.owner !== owner || context.current.lifetime !== lifetime) return
    setUi(value => {
      if (!mounted.current || !context.current.ready || context.current.owner !== owner || context.current.lifetime !== lifetime) return value
      return change(value.lifetime === lifetime ? value : emptyProfileUi(lifetime))
    })
  }, [owner, lifetime])
  const publishOperation = useCallback((operation: ProfileOperation, change: (value: ProfileUi) => ProfileUi) => {
    if (!isCurrent(operation) || !context.current.ready) return
    setUi(value => isCurrent(operation) && context.current.ready ? change(value.lifetime === lifetime ? value : emptyProfileUi(lifetime)) : value)
  }, [isCurrent, lifetime])
  const waitForReady = useCallback(async (operation: ProfileOperation): Promise<boolean> => {
    if (!isCurrent(operation)) return false
    if (context.current.ready) return true
    await new Promise<void>(resolve => {
      const signal = operation.controller.signal
      const notify = () => {
        if (!isCurrent(operation) || context.current.ready) { waiters.current.delete(notify); signal.removeEventListener("abort", notify); resolve() }
      }
      waiters.current.add(notify); signal.addEventListener("abort", notify, { once: true }); notify()
    })
    return isCurrent(operation) && context.current.ready
  }, [isCurrent])
  // Run the side effect in the same turn as the final admission check. A
  // readiness promise can settle before another queued owner render runs.
  const runWhenReady = async <T,>(operation: ProfileOperation, run: () => T): Promise<Awaited<T> | undefined> => {
    while (isCurrent(operation)) {
      if (context.current.ready) return await run()
      if (!await waitForReady(operation)) return
    }
  }
  useLayoutEffect(() => {
    mounted.current = true
    // StrictMode cleanup retires work, but does not retire a healthy draft.
    if (!active.current) setUi(value => value.lifetime === context.current.lifetime && (value.isSaving || value.isUploading)
      ? { ...value, isSaving: false, isUploading: false, notice: "The account update was interrupted locally. Already dispatched work may have completed. Check your profile before retrying." } : value)
    return () => { mounted.current = false; generation.current += 1; active.current?.controller.abort(); active.current = null; wake() }
  }, [wake])
  useLayoutEffect(() => {
    if (active.current && active.current.lifetime !== lifetime) {
      generation.current += 1; active.current.controller.abort(); active.current = null
    }
    setUi(value => value.lifetime === lifetime ? value : emptyProfileUi(lifetime))
    wake()
  }, [lifetime, ready, startEpoch, wake])

  const begin = (kind: "name" | "avatar"): ProfileOperation | null => {
    if (!canStart() || !owner || (active.current && isCurrent(active.current))) return null
    const operation = { owner, lifetime, generation: ++generation.current, controller: new AbortController() }
    active.current = operation
    publishOperation(operation, value => ({ ...value, isSaving: kind === "name", isUploading: kind === "avatar", error: null, avatarError: null, notice: null, refresh: null }))
    return operation
  }
  const finish = async (operation: ProfileOperation, input?: HTMLInputElement, file?: File) => {
    await runWhenReady(operation, () => {
      publishOperation(operation, value => ({ ...value, isSaving: false, isUploading: false }))
      // Never clear a replacement input or a more recent selection.
      if (input && fileInputRef.current === input && input.files?.[0] === file) input.value = ""
      active.current = null
    })
  }
  const refreshAcknowledged = async (operation: ProfileOperation, acknowledged: ProfileRefresh) => {
    // NextAuth itself goes loading during this already-dispatched refresh. Its
    // result can publish only after verified same-owner readiness returns.
    let session: Awaited<ReturnType<typeof update>> | undefined
    try { session = await runWhenReady(operation, () => update(acknowledged.fields)) } catch { session = null }
    if (!await waitForReady(operation)) return
    const confirmed = session?.user?.id === operation.owner &&
      (acknowledged.fields.name === undefined || session.user.name === acknowledged.fields.name) &&
      (acknowledged.fields.image === undefined || session.user.image === acknowledged.fields.image)
    publishOperation(operation, value => {
      if (!confirmed) return { ...value, refresh: acknowledged, notice: `${acknowledged.kind === "name" ? "Display name" : "Account photo"} saved, but your account session could not be verified. Retry account refresh without sending another save or upload.` }
      const newerDraft = acknowledged.kind === "name" && (draft.current.lifetime !== operation.lifetime || draft.current.revision !== acknowledged.draftRevision || draft.current.value.trim() !== acknowledged.fields.name)
      return { ...value, refresh: null, isEditing: acknowledged.kind === "name" && !newerDraft ? false : value.isEditing,
        notice: newerDraft ? "The earlier display name was saved. Your newer edit is still here and has not been sent." : `${acknowledged.kind === "name" ? "Display name" : "Account photo"} saved to your account.` }
    })
  }
  const startEditing = () => {
    if (!canStart() || active.current) return
    const revision = draft.current.revision + 1
    draft.current = { lifetime, revision, value: user?.name || "" }
    publish(value => ({ ...value, displayName: user?.name || "", draftRevision: revision, error: null, isEditing: true, notice: value.refresh ? value.notice : null }))
  }
  const cancelEditing = () => {
    if (!canStart() || active.current) return
    publish(value => ({ ...value, isEditing: false, error: null }))
  }
  const changeName = (value: string) => {
    if (!canStart()) return
    const revision = draft.current.revision + 1
    draft.current = { lifetime, revision, value }
    publish(current => ({ ...current, displayName: value, draftRevision: revision, error: null }))
  }
  const handleSave = async () => {
    if (!canStart() || draft.current.lifetime !== lifetime || draft.current.revision !== ui.draftRevision) return
    const name = displayName.trim()
    if (!name || name.length > 80) { publish(value => ({ ...value, error: name ? "Display name must be 80 characters or fewer" : "Display name is required" })); return }
    const operation = begin("name"); if (!operation) return
    const revision = draft.current.revision
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }), signal: operation.controller.signal })
      if (!await waitForReady(operation) || !isCurrent(operation)) return
      const body: unknown = await runWhenReady(operation, () => response.json().catch(() => null))
      if (!await waitForReady(operation)) return
      if (!response.ok) throw new Error(isRecord(body) && typeof body.error === "string" ? body.error : "Failed to update profile")
      // The real PATCH receipt selects these nullable fields and has no ownerID.
      if (!isRecord(body) || body.error || body.name !== name || !(body.email === null || typeof body.email === "string") || !(body.image === null || typeof body.image === "string"))
        throw new Error("The returned name receipt could not be verified. The request outcome is unconfirmed; check your account profile before saving again.")
      const acknowledged: ProfileRefresh = { kind: "name", fields: { name: body.name as string }, draftRevision: revision }
      publishOperation(operation, value => ({ ...value, refresh: acknowledged }))
      await refreshAcknowledged(operation, acknowledged)
    } catch (failure) {
      if (await waitForReady(operation)) publishOperation(operation, value => ({ ...value, error: failure instanceof Error ? failure.message : "The profile request could not be verified. Check your account before retrying.", notice: "Your edit is still here. Already dispatched work may have completed; it cannot be cancelled here." }))
    } finally { await finish(operation) }
  }
  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!canStart()) return
    const input = event.target, file = input.files?.[0]
    if (!file || active.current) return
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      publish(value => ({ ...value, avatarError: "Choose a JPEG, PNG, WebP, or GIF image up to 5 MB." })); input.value = ""; return
    }
    const operation = begin("avatar"); if (!operation) return
    try {
      const data = new FormData(); data.append("avatar", file)
      const response = await fetch("/api/profile/avatar", { method: "POST", body: data, signal: operation.controller.signal })
      if (!await waitForReady(operation) || !isCurrent(operation)) return
      const body: unknown = await runWhenReady(operation, () => response.json().catch(() => null))
      if (!await waitForReady(operation)) return
      if (!response.ok) throw new Error(isRecord(body) && typeof body.error === "string" ? body.error : "Upload failed")
      if (!isRecord(body) || body.error || !validPhotoUrl(body.image)) throw new Error("The returned photo receipt could not be verified. The request outcome is unconfirmed; check your profile before selecting another photo.")
      const acknowledged: ProfileRefresh = { kind: "avatar", fields: { image: body.image }, draftRevision: draft.current.revision }
      publishOperation(operation, value => ({ ...value, refresh: acknowledged }))
      await refreshAcknowledged(operation, acknowledged)
    } catch (failure) {
      if (await waitForReady(operation)) publishOperation(operation, value => ({ ...value, avatarError: failure instanceof Error ? failure.message : "The photo request could not be verified. Check your profile before reselecting.", notice: "Already dispatched work may have completed; it cannot be cancelled here. Reselect a photo only when you are ready to send another upload." }))
    } finally { await finish(operation, input, file) }
  }
  const retryAccountRefresh = async () => {
    if (!refresh || !canStart()) return
    const operation = begin(refresh.kind); if (!operation) return
    try { await refreshAcknowledged(operation, refresh) } finally { await finish(operation) }
  }

  if (isLoading) return <div role={STUDIO_SHELL ? "status" : undefined} aria-busy={STUDIO_SHELL ? true : undefined} className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
  if (!ready || !user) return null
  const userInitials = user.name?.split(" ").map(name => name[0]).join("").toUpperCase().slice(0, 2) || "U"

  return (
    <Card data-studio-settings-profile={STUDIO_SHELL ? "true" : undefined} aria-busy={STUDIO_SHELL ? isSaving || isUploading : undefined}>
      <CardHeader data-studio-settings-profile-header={STUDIO_SHELL ? "true" : undefined}>
        <div className="flex items-center justify-between">
          <CardTitle>Profile Information</CardTitle>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Button data-studio-settings-profile-cancel={STUDIO_SHELL ? "true" : undefined} variant="ghost" size="sm" onClick={cancelEditing} disabled={isSaving || isUploading}>
                Cancel
              </Button>
              <Button data-studio-settings-profile-save={STUDIO_SHELL ? "true" : undefined} size="sm" onClick={handleSave} disabled={isSaving || isUploading}>
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : (
            <Button data-studio-settings-profile-outline={STUDIO_SHELL ? "true" : undefined} variant="outline" size="sm" onClick={startEditing} disabled={isSaving || isUploading}>
              Edit Profile
            </Button>
          )}
        </div>
        <CardDescription>Your personal details and account information</CardDescription>
      </CardHeader>
      <CardContent data-studio-settings-profile-body={STUDIO_SHELL ? "true" : undefined} className="space-y-6">
        {/* Avatar */}
        <div data-studio-settings-profile-identity={STUDIO_SHELL ? "true" : undefined} className="flex items-center space-x-4">
          <div className="relative group">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.image || undefined} alt={user.name || "User avatar"} />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-xl font-medium text-white">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <button
              data-studio-settings-profile-upload={STUDIO_SHELL ? "true" : undefined}
              aria-busy={STUDIO_SHELL ? isUploading : undefined}
              type="button"
              onClick={() => { if (canStart() && !active.current) fileInputRef.current?.click() }}
              disabled={isSaving || isUploading}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
              aria-label="Change avatar"
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={isSaving || isUploading}
              onChange={handleAvatarUpload}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">{user.name}</h3>
              {user.tier && user.tier !== "free" && (
                <Badge
                  className={
                    user.tier === "premium"
                      ? "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400"
                      : user.tier === "pro"
                        ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400"
                  }
                  data-studio-settings-profile-outline={STUDIO_SHELL ? "true" : undefined} variant="outline"
                >
                  {user.tier === "premium" && <Sparkles className="h-3 w-3 mr-1" />}
                  {user.tier === "pro" && <Crown className="h-3 w-3 mr-1" />}
                  {user.tier === "starter" && <Shield className="h-3 w-3 mr-1" />}
                  {user.tier === "premium" ? "Max" : <span className="capitalize">{user.tier}</span>}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {STUDIO_SHELL && isUploading && <p data-studio-settings-profile-status="true" role="status">Uploading your account photo…</p>}
            {avatarError && (
              <p data-studio-settings-profile-error={STUDIO_SHELL ? "true" : undefined} role={STUDIO_SHELL ? "alert" : undefined} className="text-xs text-red-600">{avatarError}</p>
            )}
          </div>
        </div>

        {notice && <div data-studio-settings-profile-status={STUDIO_SHELL ? "true" : undefined}><p role="status" className="text-sm text-muted-foreground">{notice}</p>{refresh && <Button variant="outline" size="sm" onClick={retryAccountRefresh} disabled={isSaving || isUploading}>Retry account refresh</Button>}</div>}

        <Separator />

        {/* Fields */}
        <div data-studio-settings-profile-fields={STUDIO_SHELL ? "true" : undefined} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={STUDIO_SHELL && isEditing ? "settings-profile-display-name" : undefined} className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Display Name
            </Label>
            {isEditing ? (
              <>
                <Input
                  id={STUDIO_SHELL ? "settings-profile-display-name" : undefined}
                  autoComplete={STUDIO_SHELL ? "name" : undefined}
                  aria-invalid={STUDIO_SHELL ? Boolean(error) : undefined}
                  aria-describedby={STUDIO_SHELL ? `settings-profile-name-help${error ? " settings-profile-name-error" : ""}` : undefined}
                  value={displayName}
                  onChange={(e) => changeName(e.target.value)}
                  placeholder="Enter your display name"
                  maxLength={80}
                  disabled={isSaving || isUploading}
                />
                {error && <p id={STUDIO_SHELL ? "settings-profile-name-error" : undefined} data-studio-settings-profile-error={STUDIO_SHELL ? "true" : undefined} role={STUDIO_SHELL ? "alert" : undefined} className="text-sm text-red-600">{error}</p>}
              </>
            ) : (
              <p className="text-sm">{user.name || "Not set"}</p>
            )}
            {STUDIO_SHELL && <p id="settings-profile-name-help" data-studio-settings-profile-help="true">Your account display name · up to 80 characters</p>}
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
        <div data-studio-settings-profile-plan={STUDIO_SHELL ? "true" : undefined} className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Subscription</p>
            <p className="text-sm text-muted-foreground">
              Manage your plan, payment method, and invoices
            </p>
          </div>
          <Button data-studio-settings-profile-outline={STUDIO_SHELL ? "true" : undefined} variant="outline" asChild>
            <Link href="/billing">Manage</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
