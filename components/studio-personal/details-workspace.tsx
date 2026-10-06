"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, FileText, ImagePlus, Info, LayoutTemplate, RotateCcw, Trash2, UserRound } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { AccountProfileEditor } from "./account-profile-editor"
import { AccountIdentityPreview } from "./account-identity-preview"
import { StudioWorkflowAction } from "@/components/studio-libraries/studio-workflow-action"
import { StudioIntroReplay } from "@/components/studio-intro-replay"
import "@/components/studio-libraries/destination-intros.css"
import "./personal-workspaces.css"

type DetailsDraft = { author: string; role: string; company: string; email: string; footer: "author" | "title" | "pages" | "none"; confidentiality: string }
type LocalLogo = { url: string; name: string }
const sampleTitle = "Ideas worth sharing."
const initialDraft = (accountName: string): DetailsDraft => ({ author: accountName, role: "", company: "", email: "", footer: "author", confidentiality: "" })

/** Reuse the existing client session reader; middleware remains the access policy. */
export function AccountDetailsWorkspace() {
  const { user, isLoading } = useAuth()
  if (isLoading && !user) return <div className="sp-workspace" role="status">Loading your account…</div>
  if (!user?.id) return <div className="sp-workspace" role="alert">Your account session is unavailable. Reload to try again.</div>
  return <DetailsWorkspace key={user.id} accountName={user.name || ""} accountEmail={user.email} accountImage={user.image} />
}

/** Existing account editing and an explicitly local presentation-identity preview. */
export function DetailsWorkspace({ accountName, accountEmail, accountImage }: { accountName: string; accountEmail?: string | null; accountImage?: string | null }) {
  const [draft, setDraft] = useState<DetailsDraft>(() => initialDraft(accountName))
  const [section, setSection] = useState<"account" | "identity" | "footer">("account")
  const [preview, setPreview] = useState<"title" | "content">("title")
  const [logo, setLogo] = useState<LocalLogo | null>(null)
  const [logoError, setLogoError] = useState("")
  const currentLogo = useRef<LocalLogo | null>(logo)
  currentLogo.current = logo
  const [status, setStatus] = useState("")
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft(accountName)) || Boolean(logo)

  useEffect(() => {
    if (!logo) return
    return () => URL.revokeObjectURL(logo.url)
  }, [logo])
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [dirty])

  function update<Key extends keyof DetailsDraft>(key: Key, value: DetailsDraft[Key]) {
    setDraft(previous => ({ ...previous, [key]: value }))
    setStatus("Preview updated. Your account and presentations are unchanged.")
  }

  function previewLogo(file: File | undefined) {
    if (!file) return
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setLogoError("Choose a PNG, JPEG, or WebP image.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Choose an image smaller than 2 MB.")
      return
    }
    if (!file.size) {
      setLogoError("This image is empty. Choose another file.")
      return
    }
    try {
      const url = URL.createObjectURL(file)
      setLogoError("")
      setLogo({ url, name: file.name })
      setStatus("Logo added to this preview only. No file was uploaded.")
    } catch {
      setLogoError("Your browser could not preview this image. Choose another file.")
    }
  }

  function discardFailedLogo(url: string) {
    if (currentLogo.current?.url !== url) return
    setLogo(null)
    setLogoError("This file could not be displayed. Choose another image.")
    setStatus("Choose another logo for this local preview.")
  }

  const page = preview === "title" ? 1 : 2
  const footer = draft.footer === "author" ? `${draft.author.trim() || "Your name"} · ${page} / 8`
    : draft.footer === "title" ? `${sampleTitle} · ${page} / 8`
      : draft.footer === "pages" ? `Page ${page} of 8` : ""

  return (
    <main className="sp-workspace sp-details" data-studio-personal="details" data-studio-intro-surface="details">
      <header className="sp-heading">
        <div><p className="sp-eyebrow">MAKE IT YOURS</p><h1>Your details</h1><p>The person behind the presentation.</p></div>
        <span className="sp-draft-badge"><span /> {section === "account" ? "Your account" : "Local draft preview"}</span>
      </header>

      <div className="sp-context-bar"><span><UserRound size={16} aria-hidden="true" /> {section === "account" ? "Account name & photo" : "Presentation identity preview"}</span><Link href="/settings/profile">Account settings <ArrowUpRight size={14} aria-hidden="true" /></Link></div>

      <div className="sp-details-layout">
        <section className="sp-details-form" aria-label="Your account and presentation details">
          <div className="sp-section-switcher" role="group" aria-label="Details section"><button type="button" aria-pressed={section === "account"} onClick={() => setSection("account")}><UserRound size={15} aria-hidden="true" /> Account</button><button type="button" aria-pressed={section === "identity"} onClick={() => setSection("identity")}>Presenter preview</button><button type="button" aria-pressed={section === "footer"} onClick={() => setSection("footer")}><LayoutTemplate size={15} aria-hidden="true" /> Footer & logo</button></div>
          <div className="sp-account-pane" hidden={section !== "account"}><AccountProfileEditor /></div>
          {section === "identity" ? <div className="sp-form-section">
            <div className="sp-form-intro"><h2>A familiar introduction</h2><p>Explore how your name and professional details could appear across your slides.</p></div>
            <div className="sp-field-grid">
              <label className="sp-field sp-field-wide"><span>Author name</span><input value={draft.author} maxLength={80} placeholder="Your name" autoComplete="off" onChange={event => update("author", event.target.value)} /><small>Starts with your account name. Editing here changes only this preview.</small></label>
              <label className="sp-field"><span>Job title</span><input value={draft.role} maxLength={80} placeholder="e.g. Product Director" autoComplete="off" onChange={event => update("role", event.target.value)} /></label>
              <label className="sp-field"><span>Organization</span><input value={draft.company} maxLength={120} placeholder="Your organization" autoComplete="off" onChange={event => update("company", event.target.value)} /></label>
              <label className="sp-field sp-field-wide"><span>Contact line <small>Optional</small></span><input value={draft.email} maxLength={120} placeholder="Email or website to show on slides" autoComplete="off" onChange={event => update("email", event.target.value)} /></label>
            </div>
            <div className="sp-inline-note"><FileText size={16} aria-hidden="true" /><p>One reusable identity is the direction. Saving defaults and applying them to decks are not connected in this candidate.</p></div>
          </div> : section === "footer" ? <div className="sp-form-section">
            <div className="sp-form-intro"><h2>The finishing details</h2><p>Preview a consistent footer and logo across a sample deck.</p></div>
            <label className="sp-field"><span>Footer style</span><select value={draft.footer} onChange={event => update("footer", event.target.value as DetailsDraft["footer"])}><option value="author">Author + page number</option><option value="title">Presentation title + page number</option><option value="pages">Page X of Y</option><option value="none">No footer text</option></select></label>
            <label className="sp-field"><span>Confidentiality note <small>Optional</small></span><input value={draft.confidentiality} maxLength={120} placeholder="e.g. Internal discussion" onChange={event => update("confidentiality", event.target.value)} /></label>
            <div className="sp-logo-control"><span className="sp-field-label">Logo</span><div className="sp-logo-drop"><ImagePlus size={24} strokeWidth={1.5} aria-hidden="true" /><div><strong>{logo ? logo.name : "Bring a little of your brand"}</strong><p>PNG, JPEG, or WebP · up to 2 MB</p><label className="sp-logo-picker">{logo ? "Change preview image" : "Choose preview image"}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose logo preview image" onChange={event => { previewLogo(event.target.files?.[0]); event.target.value = "" }} /></label></div>{logo && <button type="button" className="sp-icon-button" aria-label="Remove preview logo" onClick={() => { setLogo(null); setLogoError(""); setStatus("Logo removed from this preview.") }}><Trash2 size={15} aria-hidden="true" /></button>}</div><small>Device-local preview. No upload or saved logo default.</small>{logoError && <p className="sp-error" role="alert">{logoError}</p>}</div>
          </div> : null}
        </section>

        <AccountIdentityPreview active={section === "account"} name={accountName} email={accountEmail} image={accountImage} onPresenterPreview={() => setSection("identity")} />
        <aside className="sp-identity-preview" hidden={section === "account"} aria-label="Sample slide preview">
          <div className="sp-preview-heading"><span>SLIDE PREVIEW</span><div className="sp-preview-switcher" role="group" aria-label="Sample slide"><button type="button" aria-pressed={preview === "title"} onClick={() => setPreview("title")}>Title</button><button type="button" aria-pressed={preview === "content"} onClick={() => setPreview("content")}>Content</button></div></div>
          <div className="sp-sample-slide" data-preview-slide={preview}>
            <div className="sp-sample-slide-top"><span>{draft.company.trim() || "YOUR ORGANIZATION"}</span>{logo && <img key={logo.url} src={logo.url} alt="Your selected logo preview" onError={() => discardFailedLogo(logo.url)} />}</div>
            <div className="sp-sample-slide-body">
              {preview === "title" ? <><div className="sp-sample-line" /><h2>{sampleTitle}</h2><div className="sp-sample-byline"><strong>{draft.author.trim() || "Your name"}</strong><span>{draft.role.trim() || "Your professional introduction"}</span>{draft.email.trim() && <small>{draft.email.trim()}</small>}</div></> : <><p className="sp-sample-kicker">A SHARED PERSPECTIVE</p><h2>One idea.<br />A lasting impression.</h2><div className="sp-sample-content"><span /><span /><span /></div><small className="sp-sample-content-label">Illustrative content</small></>}
            </div>
            <div className="sp-sample-footer"><span>{draft.confidentiality}</span><span>{footer}</span></div>
          </div>
          <p className="sp-preview-caption">Sample deck · {page} of 8 <span>Preview only</span></p>
          <div className="sp-current-path"><span className="sp-task-icon"><LayoutTemplate size={19} strokeWidth={1.6} aria-hidden="true" /></span><div><strong>Working on a real presentation?</strong><p>Open Master in Studio for the current deck’s footer, author, and logo.</p><StudioWorkflowAction action="master" className="sp-button">Open deck details in Studio</StudioWorkflowAction></div></div>
        </aside>
      </div>

      {section !== "account" && <div className="sp-draft-actions">
        <div><p id="sp-details-save-note"><Info size={15} aria-hidden="true" /> Reusable defaults are not connected. Leaving this page discards the draft.</p><span className="sp-feedback" role="status">{status || "Your account profile and existing presentation settings remain available."}</span></div>
        <div className="sp-action-buttons"><button className="sp-button" type="button" disabled={!dirty} onClick={() => { setDraft(initialDraft(accountName)); setLogo(null); setLogoError(""); setStatus("Draft reset. Author name restored from your account.") }}><RotateCcw size={14} aria-hidden="true" /> Reset draft</button><button className="sp-button sp-button-save" type="button" disabled aria-describedby="sp-details-save-note">Save as defaults</button></div>
      </div>}
      <p className="sp-later-note">Presenter avatars and voice are optional later additions.</p>
      <StudioIntroReplay screen="details" autoStart={true} targetSelector='[data-studio-intro-surface="details"]' className="studio-destination-intro-replay" />
    </main>
  )
}
