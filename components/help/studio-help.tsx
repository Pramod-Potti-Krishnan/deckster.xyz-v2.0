"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { Copy, Mail } from "lucide-react"
import { StudioRail } from "@/components/layout/studio-rail"
import { BackToBuilderButton } from "@/components/layout/app-header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import "./studio-help.css"

export function supportEmailDraftHref(subject: string, message: string) {
  return `mailto:support@deckster.xyz?subject=${encodeURIComponent(subject || "Deckster support")}&body=${encodeURIComponent(message)}`
}

export function supportEmailDraftText(subject: string, message: string) {
  return `To: support@deckster.xyz\nSubject: ${subject || "Deckster support"}\n\n${message}`
}

export function StudioHelpFrame({ signedIn, accountLoading = false, children }: { signedIn: boolean; accountLoading?: boolean; children: ReactNode }) {
  return (
    <div data-studio-v4-shell="true" data-studio-help="true">
      {signedIn && <StudioRail studioEntry={<BackToBuilderButton rail />} />}
      <div data-studio-v4-shell-column="true">
        <header data-studio-v4-shell-header="true" data-studio-help-part="header">
          <div><strong>Help</strong><nav aria-label="Help navigation">{accountLoading ? <span role="status">Loading account…</span> : signedIn ? <BackToBuilderButton /> : <Link href="/auth/signin">Sign in</Link>}</nav></div>
        </header>
        <main data-studio-v4-shell-workspace="true">{children}</main>
      </div>
    </div>
  )
}

export function StudioSupportDraft({ subject, message, onSubjectChange, onMessageChange }: {
  subject: string
  message: string
  onSubjectChange: (value: string) => void
  onMessageChange: (value: string) => void
}) {
  const emailDraft = supportEmailDraftHref(subject, message)
  const copyText = supportEmailDraftText(subject, message)
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle')
  const currentDraft = useRef(copyText)
  currentDraft.current = copyText
  const mounted = useRef(true)
  const copyBusy = useRef(false)
  const copyRequest = useRef(0)

  useEffect(() => {
    mounted.current = true
    setCopyState('idle')
    return () => { mounted.current = false; copyRequest.current += 1; copyBusy.current = false }
  }, [])
  useEffect(() => { if (!copyBusy.current) setCopyState('idle') }, [copyText])

  async function copyDraft() {
    if (!mounted.current || copyBusy.current || copyText !== currentDraft.current) return
    const request = ++copyRequest.current
    copyBusy.current = true
    setCopyState('copying')
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(copyText)
      if (mounted.current && request === copyRequest.current) setCopyState(copyText === currentDraft.current ? 'copied' : 'idle')
    } catch {
      if (mounted.current && request === copyRequest.current) setCopyState(copyText === currentDraft.current ? 'failed' : 'idle')
    } finally {
      if (request === copyRequest.current) copyBusy.current = false
    }
  }
  return (
    <div data-studio-help-part="support-draft">
      <p data-studio-help-part="support-notice">Write a support draft, then open your email app to review and send it. This page does not submit a ticket or send your message.</p>
      <div>
        <Label htmlFor="studio-support-subject">Subject</Label>
        <Input id="studio-support-subject" placeholder="Brief description of your issue" value={subject} onChange={event => onSubjectChange(event.target.value)} />
      </div>
      <div>
        <Label htmlFor="studio-support-message">Message</Label>
        <Textarea id="studio-support-message" placeholder="Describe your issue in detail..." rows={6} value={message} onChange={event => onMessageChange(event.target.value)} />
      </div>
      <div data-studio-help-part="support-actions">
        <a data-studio-help-part="email-draft" href={emailDraft}><Mail size={15} aria-hidden="true" />Open email draft</a>
        <button type="button" data-studio-help-part="copy-draft" onClick={() => void copyDraft()} disabled={copyState === 'copying'}><Copy size={15} aria-hidden="true" />{copyState === 'copying' ? 'Copying…' : 'Copy support draft'}</button>
      </div>
      {copyState === 'copied' && <p data-studio-help-part="copy-status" role="status">Draft copied. Paste it into an email and review before sending.</p>}
      {copyState === 'failed' && <p data-studio-help-part="copy-error" role="alert">Copy was unavailable. Select the draft below and copy it manually.</p>}
      <details data-studio-help-part="manual-draft" open={copyState === 'failed' ? true : undefined}>
        <summary>Copy manually</summary>
        <Textarea aria-label="Support draft to copy manually" value={copyText} readOnly rows={6} onFocus={event => event.currentTarget.select()} />
      </details>
      <p data-studio-help-part="draft-hint">Opening the draft does not send it. Your text remains here while you browse Help.</p>
    </div>
  )
}
