"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Camera, Loader2, Save, UserRound } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { keepStudioScrollFocusVisible } from "@/lib/studio-inspector-focus"

/** Uses the existing profile routes and JWT refresh, without adding presenter defaults. */
export function AccountProfileEditor() {
  const { user } = useAuth()
  const { update } = useSession()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState("")
  const [operation, setOperation] = useState<"name" | "avatar" | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const mounted = useRef(true)
  const busy = useRef(false)
  const activeOperation = useRef<"name" | "avatar" | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const currentOwner = useRef(user?.id)
  const lifetime = useRef(0)
  currentOwner.current = user?.id
  useLayoutEffect(() => {
    mounted.current = true
    if (activeOperation.current) {
      activeOperation.current = null
      setOperation(null)
      setNotice("")
      setError("The account update was interrupted locally. Its outcome is unconfirmed. Check your account profile before retrying.")
    }
    return () => { mounted.current = false; lifetime.current += 1; busy.current = false }
  }, [])
  function isCurrent(owner: string, requestLifetime: number) {
    return mounted.current && currentOwner.current === owner && lifetime.current === requestLifetime
  }
  useEffect(() => {
    if (!editing || name === (user?.name || "")) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [editing, name, user?.name])

  async function refreshSession(owner: string, requestLifetime: number, fields: { name?: string; image?: string }) {
    if (!isCurrent(owner, requestLifetime)) return false
    try {
      const session = await update(fields)
      return Boolean(isCurrent(owner, requestLifetime) && session?.user?.id === owner
        && (fields.name === undefined || session.user.name === fields.name)
        && (fields.image === undefined || session.user.image === fields.image))
    } catch {
      return false
    }
  }

  async function saveName() {
    if (busy.current || !user?.id) return
    const owner = user.id
    const requestLifetime = lifetime.current
    if (!isCurrent(owner, requestLifetime)) return
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 80) { setError("Use a display name between 1 and 80 characters."); return }
    busy.current = true; activeOperation.current = "name"; setOperation("name"); setError(""); setNotice("")
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "Your display name could not be saved.")
      if (result.name !== trimmed) throw new Error("The name update was not confirmed. Check your account profile before retrying.")
      if (!isCurrent(owner, requestLifetime)) return
      const refreshed = await refreshSession(owner, requestLifetime, { name: result.name })
      if (!isCurrent(owner, requestLifetime)) return
      setEditing(false)
      setNotice(refreshed ? "Display name saved to your account." : "Display name saved. Reload to refresh your account session.")
    } catch (failure) {
      if (isCurrent(owner, requestLifetime)) setError(failure instanceof Error ? failure.message : "Your display name could not be saved. Your edit is still here.")
    } finally {
      if (isCurrent(owner, requestLifetime)) { busy.current = false; activeOperation.current = null; setOperation(null) }
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file || busy.current || !user?.id) return
    const owner = user.id
    const requestLifetime = lifetime.current
    if (!isCurrent(owner, requestLifetime)) return
    setError(""); setNotice("")
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) { setError("Choose a JPEG, PNG, WebP, or GIF image."); return }
    if (file.size > 5 * 1024 * 1024) { setError("Choose an account photo smaller than 5 MB."); return }
    if (!file.size) { setError("This image is empty. Choose another file."); return }
    busy.current = true; activeOperation.current = "avatar"; setOperation("avatar")
    try {
      const data = new FormData(); data.append("avatar", file)
      const response = await fetch("/api/profile/avatar", { method: "POST", body: data })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "Your account photo could not be uploaded.")
      if (typeof result.image !== "string" || !result.image) throw new Error("The photo update was not confirmed. Check your profile before retrying.")
      if (!isCurrent(owner, requestLifetime)) return
      const refreshed = await refreshSession(owner, requestLifetime, { image: result.image })
      if (isCurrent(owner, requestLifetime)) setNotice(refreshed ? "Account photo saved." : "Account photo saved. Reload to refresh your account session.")
    } catch (failure) {
      if (isCurrent(owner, requestLifetime)) setError(failure instanceof Error ? failure.message : "Your account photo could not be uploaded.")
    } finally {
      if (isCurrent(owner, requestLifetime)) { busy.current = false; activeOperation.current = null; setOperation(null) }
    }
  }

  if (!user) return null
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true") return (
    <div className="sp-account-editor sp-account-editor-fitted" data-studio-account-fit="true">
      <div className="sp-account-body" onFocusCapture={event => keepStudioScrollFocusVisible(event.target, ".sp-account-body")}>
        <div className="sp-form-intro"><h2>A profile that travels with you.</h2><p>Your name and photo are saved to your Deckster account. Presentation identity has its own preview.</p></div>
        <div className="sp-account-photo"><div className="sp-account-avatar">{user.image ? <img src={user.image} alt={`${user.name || "Your"} account photo`} /> : <UserRound size={28} aria-hidden="true" />}</div><div><strong>{user.name || "Your profile"}</strong><p>{user.email}</p><button className="sp-button" type="button" disabled={Boolean(operation)} onClick={() => fileInput.current?.click()}>{operation === "avatar" ? <Loader2 size={14} className="sp-spin" /> : <Camera size={14} />} {operation === "avatar" ? "Uploading…" : "Change account photo"}</button><small>JPEG, PNG, WebP, or GIF · up to 5 MB</small></div><input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Upload account photo" disabled={Boolean(operation)} onChange={event => { void uploadAvatar(event.target.files?.[0]); event.target.value = "" }} /></div>
        <div className="sp-field"><span>Display name</span>{editing ? <input aria-label="Account display name" value={name} maxLength={80} autoComplete="name" disabled={Boolean(operation)} onChange={event => { setName(event.target.value); setError("") }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void saveName() } }} /> : <strong className="sp-account-value">{user.name || "Not set"}</strong>}<small>This name appears in your account. It does not rename existing presentations.</small></div>
        <div className="sp-account-readonly"><span>Email address</span><strong>{user.email}</strong><p>Your email is linked to your Google account.</p></div>
        <div className="sp-account-links"><div><strong>Your plan</strong><p>Plan, payment method, and invoices</p></div><Link className="sp-button" href="/billing">Manage plan</Link></div>
      </div>
      <div className="sp-account-controls">
        <div className="sp-actions-row">{editing ? <><button className="sp-button sp-button-save" type="button" disabled={Boolean(operation) || !name.trim()} onClick={() => void saveName()}>{operation === "name" ? <Loader2 size={14} className="sp-spin" /> : <Save size={14} />}{operation === "name" ? "Saving…" : "Save account name"}</button><button className="sp-button" type="button" disabled={Boolean(operation)} onClick={() => { setEditing(false); setError("") }}>Cancel</button></> : <button className="sp-button" type="button" disabled={Boolean(operation)} onClick={() => { setName(user.name || ""); setEditing(true); setError(""); setNotice("") }}>Edit display name</button>}</div>
        {(error || notice) && <div className="sp-account-result" tabIndex={0} aria-label="Account update status">
          {error && <p className="sp-error" role="alert">{error}</p>}{notice && <p className="sp-account-status" role="status">{notice}</p>}
        </div>}
      </div>
    </div>
  )
  return <div className="sp-form-section sp-account-editor">
    <div className="sp-form-intro"><h2>A profile that travels with you.</h2><p>Your name and photo are saved to your Deckster account. Presentation identity has its own preview.</p></div>
    <div className="sp-account-photo"><div className="sp-account-avatar">{user.image ? <img src={user.image} alt={`${user.name || "Your"} account photo`} /> : <UserRound size={28} aria-hidden="true" />}</div><div><strong>{user.name || "Your profile"}</strong><p>{user.email}</p><button className="sp-button" type="button" disabled={Boolean(operation)} onClick={() => fileInput.current?.click()}>{operation === "avatar" ? <Loader2 size={14} className="sp-spin" /> : <Camera size={14} />} {operation === "avatar" ? "Uploading…" : "Change account photo"}</button><small>JPEG, PNG, WebP, or GIF · up to 5 MB</small></div><input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Upload account photo" disabled={Boolean(operation)} onChange={event => { void uploadAvatar(event.target.files?.[0]); event.target.value = "" }} /></div>
    <div className="sp-field"><span>Display name</span>{editing ? <input aria-label="Account display name" value={name} maxLength={80} autoComplete="name" disabled={Boolean(operation)} onChange={event => { setName(event.target.value); setError("") }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void saveName() } }} /> : <strong className="sp-account-value">{user.name || "Not set"}</strong>}<small>This name appears in your account. It does not rename existing presentations.</small></div>
    <div className="sp-actions-row">{editing ? <><button className="sp-button sp-button-save" type="button" disabled={Boolean(operation) || !name.trim()} onClick={() => void saveName()}>{operation === "name" ? <Loader2 size={14} className="sp-spin" /> : <Save size={14} />}{operation === "name" ? "Saving…" : "Save account name"}</button><button className="sp-button" type="button" disabled={Boolean(operation)} onClick={() => { setEditing(false); setError("") }}>Cancel</button></> : <button className="sp-button" type="button" disabled={Boolean(operation)} onClick={() => { setName(user.name || ""); setEditing(true); setError(""); setNotice("") }}>Edit display name</button>}</div>
    {error && <p className="sp-error" role="alert">{error}</p>}{notice && <p className="sp-account-status" role="status">{notice}</p>}
    <div className="sp-account-readonly"><span>Email address</span><strong>{user.email}</strong><p>Your email is linked to your Google account.</p></div>
    <div className="sp-account-links"><div><strong>Your plan</strong><p>Plan, payment method, and invoices</p></div><Link className="sp-button" href="/billing">Manage plan</Link></div>
  </div>
}
