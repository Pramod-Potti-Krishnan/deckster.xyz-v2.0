"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, FileText, Info, LayoutTemplate, RotateCcw, Save, UserRound } from "lucide-react"
import { AccountProfileEditor } from "./account-profile-editor"
import { AccountIdentityPreview } from "./account-identity-preview"
import { StudioWorkflowAction } from "@/components/studio-libraries/studio-workflow-action"
import { StudioIntroReplay } from "@/components/studio-intro-replay"
import { lastBuilderSessionKey } from "@/lib/last-builder-session"
import { getLayoutServiceUrl, LAYOUT_URL_CONFIG_ERROR } from "@/lib/layout-service-client"
import {
  STUDIO_DETAILS_FIELD_TOKENS, STUDIO_DETAILS_FOOTER_PRESETS, STUDIO_DETAILS_WORDS, studioDetailsDeckTarget, studioDetailsDraftFromDeck, studioDetailsFooterText, studioDetailsInitial,
  studioDetailsMergeDerivative, studioDetailsValid, studioDetailsWouldChange, type StudioDeckDerivative, type StudioDetailsDraft,
} from "@/lib/studio-details"
import "@/components/studio-libraries/destination-intros.css"
import "./personal-workspaces.css"
import "./studio-p2-details.css"

type Section = "account" | "profile" | "slides"
type Deck = { status: "loading" } | { status: "none" } | { status: "error" } | { status: "ready"; presentationId: string; title: string; existing: StudioDeckDerivative | null }
const SECTIONS: readonly { id: Section; label: string; Icon: typeof UserRound }[] = [{ id: "account", label: "Account", Icon: UserRound }, { id: "profile", label: "Profile", Icon: UserRound }, { id: "slides", label: "Slide details", Icon: FileText }]
const FIELDS = [
  { key: "author", label: "Author name", placeholder: "Your name", max: 80 }, { key: "role", label: "Professional title", placeholder: "e.g. Strategy Director", max: 80 },
  { key: "company", label: "Organization", placeholder: "Company or team", max: 120 }, { key: "email", label: "Contact email", placeholder: "Optional", max: 120 },
  { key: "website", label: "Website", placeholder: "Optional", max: 120 }, { key: "confidentiality", label: "Confidentiality line", placeholder: "e.g. Internal — confidential", max: 120 },
] as const
const sampleTitle = "Ideas worth sharing."

/** PASS2 DET-01..06: Your details as the v4 mockup has it, wired to the open deck's existing footer and logo (flag NEXT_PUBLIC_STUDIO_P2_DETAILS). */
export function StudioP2DetailsWorkspace({ userId, accountName, accountEmail, accountImage }: { userId: string; accountName: string; accountEmail?: string | null; accountImage?: string | null }) {
  const [section, setSection] = useState<Section>("account")
  const [preview, setPreview] = useState<"title" | "content">("title")
  const [draft, setDraft] = useState<StudioDetailsDraft>(() => studioDetailsInitial(accountName))
  const [loaded, setLoaded] = useState<StudioDetailsDraft>(() => studioDetailsInitial(accountName))
  const [deck, setDeck] = useState<Deck>({ status: "loading" })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState("")
  const [logoBroken, setLogoBroken] = useState("")
  const edited = useRef(false)
  const baseId = useId()
  const now = new Date()
  const check = studioDetailsValid(draft, now)
  const existing = deck.status === "ready" ? deck.existing : null
  const dirty = JSON.stringify(draft) !== JSON.stringify(loaded)
  const canSave = deck.status === "ready" && check.ok && !saving && studioDetailsWouldChange(existing, draft, now)

  useEffect(() => {
    const controller = new AbortController()
    const read = async () => {
      try {
        let sessionId = ""
        try { sessionId = window.localStorage.getItem(lastBuilderSessionKey(userId)) || "" } catch { /* No remembered deck. */ }
        if (!sessionId || sessionId === "new") { setDeck({ status: "none" }); return }
        const sessionResponse = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { signal: controller.signal, cache: "no-store" })
        if (sessionResponse.status === 404 || sessionResponse.status === 410) { setDeck({ status: "none" }); return }
        if (!sessionResponse.ok) { setDeck({ status: "error" }); return }
        const target = studioDetailsDeckTarget((await sessionResponse.json().catch(() => null) as { session?: unknown } | null)?.session)
        if (!target) { setDeck({ status: "none" }); return }
        if (LAYOUT_URL_CONFIG_ERROR) { setDeck({ status: "error" }); return }
        const layoutResponse = await fetch(`${getLayoutServiceUrl()}/api/presentations/${encodeURIComponent(target.presentationId)}/derivative-elements`, { signal: controller.signal, cache: "no-store" })
        if (!layoutResponse.ok) { setDeck({ status: "error" }); return }
        const body = await layoutResponse.json().catch(() => null) as { derivative_elements?: StudioDeckDerivative | null } | null
        const existingElements = body?.derivative_elements ?? null
        setDeck({ status: "ready", presentationId: target.presentationId, title: target.title, existing: existingElements })
        if (!edited.current) { const fromDeck = studioDetailsDraftFromDeck(existingElements, accountName); setDraft(fromDeck); setLoaded(fromDeck) }
      } catch {
        if (!controller.signal.aborted) setDeck({ status: "error" })
      }
    }
    void read()
    return () => controller.abort()
  }, [userId, accountName])
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [dirty])

  function change<Key extends keyof StudioDetailsDraft>(key: Key, value: StudioDetailsDraft[Key]) {
    edited.current = true
    setDraft(previous => ({ ...previous, [key]: value }))
    setStatus("")
  }
  async function save() {
    if (deck.status !== "ready" || !canSave) return
    const body = studioDetailsMergeDerivative(deck.existing, draft, new Date())
    setSaving(true); setStatus(STUDIO_DETAILS_WORDS.saving)
    try {
      const response = await fetch(`${getLayoutServiceUrl()}/api/presentations/${encodeURIComponent(deck.presentationId)}/derivative-elements?${new URLSearchParams({ created_by: "user", change_summary: "Updated from Your details" })}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(String(response.status))
      setDeck({ ...deck, existing: body })
      setLoaded(draft)
      setStatus(STUDIO_DETAILS_WORDS.saved)
    } catch {
      setStatus(STUDIO_DETAILS_WORDS.saveFailed)
    } finally {
      setSaving(false)
    }
  }
  function reset() {
    const start = deck.status === "ready" ? studioDetailsDraftFromDeck(deck.existing, accountName) : studioDetailsInitial(accountName)
    setDraft(start); setLoaded(start); edited.current = false; setStatus("Draft reset to what the presentation has now.")
  }
  function moveTab(event: React.KeyboardEvent, index: number) {
    let next = index
    if (event.key === "ArrowRight") next = (index + 1) % SECTIONS.length
    else if (event.key === "ArrowLeft") next = (index + SECTIONS.length - 1) % SECTIONS.length
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = SECTIONS.length - 1
    else return
    event.preventDefault()
    setSection(SECTIONS[next].id)
    document.getElementById(`${baseId}-${SECTIONS[next].id}-tab`)?.focus()
  }

  const page = preview === "title" ? 1 : 2
  const footer = studioDetailsFooterText(draft, deck.status === "ready" && deck.title ? deck.title : sampleTitle, page, 8, now)
  const logoUrl = check.logo ? draft.logoUrl.trim() : ""
  const scope = deck.status === "ready" ? <><strong>{deck.title || "Your open presentation"}</strong> · {STUDIO_DETAILS_WORDS.scopeNote}</>
    : deck.status === "loading" ? STUDIO_DETAILS_WORDS.scopeLoading : deck.status === "error" ? STUDIO_DETAILS_WORDS.scopeError : STUDIO_DETAILS_WORDS.scopeNone

  return (
    <main className="sp-workspace sp-details" data-studio-personal="details" data-studio-p2-details="true" data-studio-intro-surface="details">
      <header className="sp-heading">
        <div><p className="sp-eyebrow">MAKE IT YOURS</p><h1>Your details</h1><p>The person behind the presentation.</p></div>
        <span className="sp-draft-badge"><span /> {section === "account" ? "Your account" : "This presentation"}</span>
      </header>

      <div className="sp-context-bar"><span><UserRound size={16} aria-hidden="true" /> {section === "account" ? "Account name & photo" : "Presentation details"}</span><Link href="/settings/profile">Account settings <ArrowUpRight size={14} aria-hidden="true" /></Link></div>

      {section !== "account" && <>
        <div className="sp-p2-scope" data-studio-p2-scope="deck"><span className="sp-p2-scope-pill"><FileText size={16} aria-hidden="true" />{STUDIO_DETAILS_WORDS.scope}</span></div>
        <p className="sp-p2-scope-note" role="status" data-studio-p2-scope-note={deck.status}>{scope}</p>
      </>}

      <div className="sp-p2-tabs" role="tablist" aria-label="Your details sections" data-studio-p2-tabs="true">
        {SECTIONS.map(({ id, label, Icon }, index) => <button key={id} id={`${baseId}-${id}-tab`} type="button" role="tab" aria-selected={section === id} aria-controls={`${baseId}-panel`} tabIndex={section === id ? 0 : -1} onClick={() => setSection(id)} onKeyDown={event => moveTab(event, index)}><Icon size={15} aria-hidden="true" />{label}</button>)}
      </div>

      <div className="sp-details-layout" id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-${section}-tab`}>
        <section className="sp-details-form sp-p2-form" aria-label="Your account and presentation details">
          <div className="sp-account-pane" hidden={section !== "account"}><AccountProfileEditor /></div>
          {section === "profile" ? <div className="sp-form-section" data-studio-p2-card="profile">
            <div className="sp-form-intro"><h2>Presenter</h2><p>Your professional title is separate from a presentation&rsquo;s title.</p></div>
            <div className="sp-field-grid">
              {FIELDS.map(field => <label key={field.key} className="sp-field"><span>{field.label}</span><input value={draft[field.key]} maxLength={field.max} placeholder={field.placeholder} autoComplete="off" onChange={event => change(field.key, event.target.value)} /></label>)}
              <label className="sp-field sp-field-wide"><span>Logo URL</span><input value={draft.logoUrl} placeholder="https://…" inputMode="url" autoComplete="off" aria-invalid={!check.logo} onChange={event => { setLogoBroken(""); change("logoUrl", event.target.value) }} />{!check.logo && <p className="sp-error" role="alert">{STUDIO_DETAILS_WORDS.logoInvalid}</p>}{logoBroken && logoBroken === logoUrl && <p className="sp-error" role="alert">This logo could not be loaded from that address.</p>}</label>
            </div>
            <small className="sp-p2-hint">Contact details only appear when included in the footer.</small>
          </div> : section === "slides" ? <div className="sp-form-section" data-studio-p2-card="slides">
            <div className="sp-p2-card-head"><div className="sp-form-intro"><h2>Across your slides</h2></div><label className="sp-p2-check"><input type="checkbox" checked={draft.showFooter} onChange={event => change("showFooter", event.target.checked)} />Show footer</label></div>
            <label className="sp-field"><span>Footer template</span><input value={draft.footer} maxLength={400} disabled={!draft.showFooter} aria-label="Footer template" aria-invalid={!check.footer} onChange={event => change("footer", event.target.value)} /></label>
            <div className="sp-p2-presets" data-studio-p2-presets="true">{STUDIO_DETAILS_FOOTER_PRESETS.map(preset => <button key={preset.label} type="button" className="sp-button" disabled={!draft.showFooter} aria-pressed={draft.footer === preset.value} onClick={() => change("footer", preset.value)}>{preset.label}</button>)}</div>
            <details className="sp-p2-fields"><summary>Insert a field</summary><div className="sp-p2-tokens" data-studio-p2-tokens="true">{STUDIO_DETAILS_FIELD_TOKENS.map(key => <button key={key} type="button" disabled={!draft.showFooter} onClick={() => change("footer", `${draft.footer}${draft.footer ? " · " : ""}{${key}}`)}>{`{${key}}`}</button>)}</div></details>
            {!check.footer && <p className="sp-error" role="alert">{STUDIO_DETAILS_WORDS.footerLong}</p>}
            <label className="sp-field"><span>Date</span><input value={draft.date} maxLength={40} placeholder="Auto · current month and year" onChange={event => change("date", event.target.value)} /></label>
            <small className="sp-p2-hint">Empty personal fields are omitted. The presentation title and page numbers come from each deck.</small>
          </div> : null}
        </section>

        <AccountIdentityPreview active={section === "account"} name={accountName} email={accountEmail} image={accountImage} onPresenterPreview={() => setSection("profile")} />
        <aside className="sp-identity-preview" hidden={section === "account"} aria-label="Sample slide preview">
          <div className="sp-preview-heading"><span>SLIDE PREVIEW</span><div className="sp-preview-switcher" role="group" aria-label="Sample slide"><button type="button" aria-pressed={preview === "title"} onClick={() => setPreview("title")}>Title</button><button type="button" aria-pressed={preview === "content"} onClick={() => setPreview("content")}>Content</button></div></div>
          <div className="sp-sample-slide" data-preview-slide={preview}>
            <div className="sp-sample-slide-top"><span>{draft.company.trim() || "YOUR ORGANIZATION"}</span>{logoUrl && <img key={logoUrl} src={logoUrl} alt={draft.company.trim() ? `${draft.company.trim()} logo` : "Presentation logo"} referrerPolicy="no-referrer" onError={() => setLogoBroken(logoUrl)} />}</div>
            <div className="sp-sample-slide-body">
              {preview === "title" ? <><div className="sp-sample-line" /><h2>{sampleTitle}</h2><div className="sp-sample-byline"><strong>{draft.author.trim() || "Your name"}</strong><span>{[draft.role.trim(), draft.company.trim()].filter(Boolean).join(" · ") || "Your professional introduction"}</span></div></> : <><p className="sp-sample-kicker">A SHARED PERSPECTIVE</p><h2>One idea.<br />A lasting impression.</h2><div className="sp-sample-content"><span /><span /><span /></div><small className="sp-sample-content-label">Illustrative content</small></>}
            </div>
            <div className="sp-sample-footer"><span /><span data-studio-p2-footer="true">{footer}</span></div>
          </div>
          <p className="sp-preview-caption">Sample deck · {page} of 8 <span>Preview only</span></p>
          <div className="sp-current-path"><span className="sp-task-icon"><LayoutTemplate size={19} strokeWidth={1.6} aria-hidden="true" /></span><div><strong>Working on a real presentation?</strong><p>Open Master in Studio for the current deck’s footer, author, and logo.</p><StudioWorkflowAction action="master" className="sp-button">Open deck details in Studio</StudioWorkflowAction></div></div>
        </aside>
      </div>

      {section !== "account" && <div className="sp-draft-actions" data-studio-p2-actions="true">
        <div><p id="sp-details-save-note"><Info size={15} aria-hidden="true" /> {deck.status === "ready" ? STUDIO_DETAILS_WORDS.saveNote : STUDIO_DETAILS_WORDS.noteNone}</p><span className="sp-feedback" role="status">{status}</span></div>
        <div className="sp-action-buttons"><button className="sp-button" type="button" disabled={!dirty || saving} onClick={reset}><RotateCcw size={14} aria-hidden="true" /> Reset draft</button><button className="sp-button sp-button-save" type="button" disabled={!canSave} aria-describedby="sp-details-save-note" onClick={() => void save()}><Save size={14} aria-hidden="true" /> {saving ? STUDIO_DETAILS_WORDS.saving : STUDIO_DETAILS_WORDS.save}</button></div>
      </div>}
      <p className="sp-later-note">Presenter avatars and voice are optional later additions.</p>
      <StudioIntroReplay screen="details" autoStart={true} targetSelector='[data-studio-intro-surface="details"]' className="studio-destination-intro-replay" />
    </main>
  )
}
