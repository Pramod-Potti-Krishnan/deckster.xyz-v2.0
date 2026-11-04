"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Camera, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  STUDIO_PROFILE_NAME_MAX,
  STUDIO_PROFILE_PHOTO_TYPES,
  STUDIO_PROFILE_WORDS as W,
  studioProfileFailure,
  studioProfileInitials,
  studioProfileNameProblem,
  studioProfilePhotoProblem,
  studioProfileSaved,
  studioProfileTier,
} from "@/lib/studio-p2-profile-page"
import "./studio-p2-profile-page.css"

// PASS2 Profile page (NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE, default off, Studio shell only): /settings/profile in the shell's tokens, with every state spoken: loading, signed out,
// a name or photo that could not be saved, and the saved confirmation. The same three things as before (display name, account photo, the way to Billing); no new action.
export function StudioProfilePage() {
  const { user, isLoading } = useAuth()
  const { update } = useSession()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState("")
  const [operation, setOperation] = useState<"name" | "photo" | null>(null)
  const [nameError, setNameError] = useState("")
  const [photoError, setPhotoError] = useState("")
  const [notice, setNotice] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)

  if (isLoading) {
    return (
      <section data-studio-p2-profile="true" data-studio-p2-profile-state="loading" role="status" aria-busy="true">
        <div data-studio-p2-profile-header="true"><div><i data-studio-p2-profile-bar="title" /><i data-studio-p2-profile-bar="lede" /></div></div>
        <div data-studio-p2-profile-body="true">
          <div data-studio-p2-profile-identity="true"><i data-studio-p2-profile-bar="avatar" /><div><i data-studio-p2-profile-bar="name" /><i data-studio-p2-profile-bar="email" /></div></div>
          <i data-studio-p2-profile-bar="field" />
          <i data-studio-p2-profile-bar="field" />
        </div>
        <span className="sr-only">{W.loading}</span>
      </section>
    )
  }
  if (!user) {
    return (
      <section data-studio-p2-profile="true" data-studio-p2-profile-state="signed-out" aria-labelledby="studio-p2-profile-title">
        <div data-studio-p2-profile-body="true" data-studio-p2-profile-empty="true">
          <h2 id="studio-p2-profile-title">{W.signedOutTitle}</h2>
          <p>{W.signedOutBody}</p>
          <Link data-studio-p2-profile-link="true" href="/auth/signin">{W.signIn}</Link>
        </div>
      </section>
    )
  }

  const busy = operation !== null
  const tier = studioProfileTier(user.tier)

  const startEditing = () => {
    setName(user.name || "")
    setNotice("")
    setEditing(true)
  }
  const cancelEditing = () => {
    setEditing(false)
    setNameError("")
  }

  async function saveName() {
    if (busy) return
    const problem = studioProfileNameProblem(name)
    if (problem) { setNameError(problem); return }
    const trimmed = name.trim()
    setOperation("name"); setNameError(""); setPhotoError(""); setNotice("")
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) { setNameError(studioProfileFailure("name", response.status, body)); return }
      // The name is saved. Refresh the JWT-backed session so it shows everywhere without a re-login; if that read fails the save still stands.
      const refreshed = await update({ name: trimmed }).then(() => true, () => false)
      setEditing(false)
      setNotice(studioProfileSaved("name", refreshed))
    } catch {
      setNameError(studioProfileFailure("name", 0, null))
    } finally {
      setOperation(null)
    }
  }

  async function uploadPhoto(file?: File) {
    if (!file || busy) return
    setPhotoError(""); setNotice("")
    const problem = studioProfilePhotoProblem(file)
    if (problem) { setPhotoError(problem); return }
    setOperation("photo")
    try {
      const form = new FormData()
      form.append("avatar", file)
      const response = await fetch("/api/profile/avatar", { method: "POST", body: form })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) { setPhotoError(studioProfileFailure("photo", response.status, body)); return }
      const image = body && typeof body.image === "string" ? body.image : ""
      if (!image) { setPhotoError(studioProfileFailure("photo", 0, null)); return }
      const refreshed = await update({ image }).then(() => true, () => false)
      setNotice(studioProfileSaved("photo", refreshed))
    } catch {
      setPhotoError(studioProfileFailure("photo", 0, null))
    } finally {
      setOperation(null)
    }
  }

  return (
    <section data-studio-p2-profile="true" data-studio-p2-profile-state="ready" aria-labelledby="studio-p2-profile-title" aria-busy={busy}>
      <header data-studio-p2-profile-header="true">
        <div>
          <h2 id="studio-p2-profile-title">{W.title}</h2>
          <p>{W.lede}</p>
        </div>
        <div data-studio-p2-profile-actions="true">
          {editing ? (
            <>
              <button type="button" data-studio-p2-profile-cancel="true" onClick={cancelEditing} disabled={busy}>{W.cancel}</button>
              <button type="button" data-studio-p2-profile-save="true" onClick={() => void saveName()} disabled={busy}>{operation === "name" ? W.saving : W.save}</button>
            </>
          ) : (
            <button type="button" data-studio-p2-profile-edit="true" onClick={startEditing} disabled={busy}>{W.edit}</button>
          )}
        </div>
      </header>
      <div data-studio-p2-profile-body="true">
        <div data-studio-p2-profile-identity="true">
          <Avatar data-studio-p2-profile-avatar="true">
            <AvatarImage src={user.image || undefined} alt={`${user.name || "Your"} account photo`} />
            <AvatarFallback data-studio-p2-profile-initials="true">{studioProfileInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div data-studio-p2-profile-who="true">
            <div data-studio-p2-profile-namerow="true">
              <strong>{user.name || W.nameUnset}</strong>
              {tier && <span data-studio-p2-profile-tier={tier.id}>{tier.label}</span>}
            </div>
            <p>{user.email}</p>
            <button type="button" data-studio-p2-profile-photo="true" onClick={() => fileInput.current?.click()} disabled={busy}>
              {operation === "photo" ? <Loader2 size={14} aria-hidden="true" data-studio-p2-profile-spin="true" /> : <Camera size={14} aria-hidden="true" />}
              {operation === "photo" ? W.uploading : W.changePhoto}
            </button>
            <small>{W.photoHint}</small>
            {photoError && <p data-studio-p2-profile-error="true" role="alert">{photoError}</p>}
          </div>
          <input ref={fileInput} type="file" hidden aria-label="Upload account photo" accept={STUDIO_PROFILE_PHOTO_TYPES.join(",")} disabled={busy} onChange={(event) => { void uploadPhoto(event.target.files?.[0]); event.target.value = "" }} />
        </div>
        <p data-studio-p2-profile-status="true" role="status">{notice}</p>
        <div data-studio-p2-profile-field="name">
          {editing ? <label htmlFor="studio-p2-profile-name">{W.nameLabel}</label> : <span>{W.nameLabel}</span>}
          {editing ? (
            <input
              id="studio-p2-profile-name"
              value={name}
              onChange={(event) => { setName(event.target.value); setNameError("") }}
              placeholder={W.namePlaceholder}
              maxLength={STUDIO_PROFILE_NAME_MAX}
              autoComplete="name"
              disabled={busy}
              aria-invalid={Boolean(nameError)}
              aria-describedby={`studio-p2-profile-name-help${nameError ? " studio-p2-profile-name-error" : ""}`}
            />
          ) : (
            <strong data-studio-p2-profile-value="true" data-studio-p2-profile-unset={user.name ? undefined : "true"}>{user.name || W.nameUnset}</strong>
          )}
          {nameError && <p id="studio-p2-profile-name-error" data-studio-p2-profile-error="true" role="alert">{nameError}</p>}
          <small id="studio-p2-profile-name-help">{W.nameHelp}</small>
        </div>
        <div data-studio-p2-profile-field="email">
          <span>{W.emailLabel}</span>
          <strong data-studio-p2-profile-value="true">{user.email}</strong>
          <small>{W.emailNote}</small>
        </div>
        <div data-studio-p2-profile-plan="true">
          <div>
            <strong>{W.planTitle}</strong>
            <p>{W.planNote}</p>
          </div>
          <Link data-studio-p2-profile-link="true" href="/billing">{W.planAction}</Link>
        </div>
      </div>
    </section>
  )
}
