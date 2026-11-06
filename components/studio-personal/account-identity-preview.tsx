"use client"

import { useState } from "react"
import { Check, LayoutTemplate, RefreshCw, UserRound } from "lucide-react"
import { StudioWorkflowAction } from "@/components/studio-libraries/studio-workflow-action"

/** Reads confirmed session fields only; account form drafts are never passed here. */
export function AccountIdentityPreview({ active, name, email, image, onPresenterPreview }: {
  active: boolean
  name: string
  email?: string | null
  image?: string | null
  onPresenterPreview: () => void
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const imageFailed = Boolean(image && failedImage === image)
  return <aside className="sp-account-preview" hidden={!active} aria-label="Confirmed account identity">
    <div className="sp-preview-heading"><span>YOUR ACCOUNT IDENTITY</span><span className="sp-profile-loaded"><Check size={12} aria-hidden="true" />Loaded profile</span></div>
    <div className="sp-confirmed-profile">
      <p className="sp-eyebrow">THE PERSON BEHIND THE WORK</p>
      <div className="sp-confirmed-avatar">{image && !imageFailed ? <img src={image} alt={`${name || "Your"} account photo`} onError={() => setFailedImage(image)} /> : <UserRound size={54} strokeWidth={1.3} aria-hidden="true" />}</div>
      <h2>{name || "Display name not set"}</h2>
      <p className="sp-confirmed-email">{email || "Email unavailable in this session"}</p>
      {imageFailed ? <div className="sp-profile-image-error" role="status"><p>Your saved account photo could not be displayed.</p><button type="button" className="sp-button" onClick={() => setFailedImage(null)}><RefreshCw size={13} aria-hidden="true" />Retry photo</button></div> : !image && <p className="sp-confirmed-photo-note">No saved account photo</p>}
      <div className="sp-profile-confirmation"><strong>Your current account profile</strong><p>Unsaved name edits stay in the form. Saved names and uploaded photos appear here after a confirmed account-session refresh.</p></div>
      <button type="button" className="sp-button" onClick={onPresenterPreview}>Explore presenter preview</button>
    </div>
    <div className="sp-current-path"><span className="sp-task-icon"><LayoutTemplate size={19} strokeWidth={1.6} aria-hidden="true" /></span><div><strong>Details for your presentation</strong><p>Open Master in Studio for the current deck’s footer, author, and logo.</p><StudioWorkflowAction action="master" className="sp-button">Open deck details in Studio</StudioWorkflowAction></div></div>
  </aside>
}
